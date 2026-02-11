/**
 * Async Job Queue for Agent Bazaar
 * Supports long-running tasks with status polling and result delivery.
 * 
 * Flow:
 * 1. Client pays via x402 → gets access token
 * 2. Client POSTs job with input data + access token → gets job ID
 * 3. Client polls GET /jobs/:id/status (free, no payment)
 * 4. When complete, client fetches GET /jobs/:id/result with access token
 * 
 * Jobs support arbitrary input (text, JSON, base64 files) and output
 * (JSON, binary files, URLs).
 */

const crypto = require('crypto');

// In-memory job store (production: use Redis or DB)
const jobs = new Map();

// Job statuses
const STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

// Max jobs in memory (prevent OOM)
const MAX_JOBS = 10000;
// Job TTL: 24 hours
const JOB_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Create a new job
 * @param {string} serviceId - The service being requested
 * @param {string} agentId - The agent processing the job
 * @param {object} input - Input data from the client
 * @param {object} paymentInfo - x402 payment details
 * @returns {object} Job object
 */
function createJob(serviceId, agentId, input, paymentInfo) {
  // Enforce max jobs
  if (jobs.size >= MAX_JOBS) {
    // Evict oldest completed/failed jobs
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (job.status === STATUS.COMPLETED || job.status === STATUS.FAILED || now - job.createdAt > JOB_TTL_MS) {
        jobs.delete(id);
      }
      if (jobs.size < MAX_JOBS * 0.8) break;
    }
  }

  const jobId = crypto.randomUUID();
  const job = {
    id: jobId,
    serviceId,
    agentId,
    status: STATUS.QUEUED,
    progress: 0,
    progressMessage: 'Job queued',
    input,
    result: null,
    error: null,
    paymentInfo,
    createdAt: Date.now(),
    startedAt: null,
    completedAt: null,
    // Access control: only the original payer can fetch results
    accessToken: paymentInfo?.signature || crypto.randomBytes(16).toString('hex'),
    // Webhook URL for push notification (optional)
    webhookUrl: input?.webhookUrl || null,
    // Result content type (set by agent when completing)
    resultContentType: 'application/json',
    // Binary result (Buffer) for file responses
    resultBuffer: null,
    // Result filename for file downloads
    resultFilename: null,
  };

  jobs.set(jobId, job);
  return job;
}

/**
 * Get a job by ID
 */
function getJob(jobId) {
  return jobs.get(jobId) || null;
}

/**
 * Update job status and progress
 */
function updateJobProgress(jobId, progress, message) {
  const job = jobs.get(jobId);
  if (!job) return null;
  job.progress = Math.min(100, Math.max(0, progress));
  job.progressMessage = message || job.progressMessage;
  if (job.status === STATUS.QUEUED) {
    job.status = STATUS.PROCESSING;
    job.startedAt = Date.now();
  }
  return job;
}

/**
 * Complete a job with result
 * @param {string} jobId
 * @param {object|Buffer} result - JSON result or binary data
 * @param {object} options - { contentType, filename }
 */
function completeJob(jobId, result, options = {}) {
  const job = jobs.get(jobId);
  if (!job) return null;
  
  job.status = STATUS.COMPLETED;
  job.progress = 100;
  job.progressMessage = 'Complete';
  job.completedAt = Date.now();

  if (Buffer.isBuffer(result)) {
    job.resultBuffer = result;
    job.resultContentType = options.contentType || 'application/octet-stream';
    job.resultFilename = options.filename || 'result';
  } else {
    job.result = result;
    job.resultContentType = options.contentType || 'application/json';
  }

  // Fire webhook if configured
  if (job.webhookUrl) {
    fireWebhook(job).catch(err => console.error('Webhook failed:', err.message));
  }

  return job;
}

/**
 * Fail a job with error
 */
function failJob(jobId, errorMessage) {
  const job = jobs.get(jobId);
  if (!job) return null;
  job.status = STATUS.FAILED;
  job.error = errorMessage;
  job.completedAt = Date.now();
  job.progressMessage = 'Failed';
  return job;
}

/**
 * Fire webhook notification when job completes
 */
async function fireWebhook(job) {
  if (!job.webhookUrl) return;
  
  // Validate URL
  try {
    const url = new URL(job.webhookUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return;
  } catch {
    return;
  }

  try {
    await fetch(job.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: job.id,
        status: job.status,
        serviceId: job.serviceId,
        completedAt: job.completedAt,
        // Don't include result in webhook — client should fetch it
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error(`Webhook to ${job.webhookUrl} failed:`, err.message);
  }
}

/**
 * Get public job status (safe to return to any caller)
 */
function getJobStatus(job) {
  return {
    id: job.id,
    serviceId: job.serviceId,
    status: job.status,
    progress: job.progress,
    progressMessage: job.progressMessage,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    error: job.error,
    resultContentType: job.status === STATUS.COMPLETED ? job.resultContentType : undefined,
    resultFilename: job.status === STATUS.COMPLETED ? job.resultFilename : undefined,
    duration: job.completedAt ? job.completedAt - (job.startedAt || job.createdAt) : null,
  };
}

/**
 * Cleanup expired jobs (call periodically)
 */
function cleanupExpiredJobs() {
  const now = Date.now();
  let cleaned = 0;
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) {
      jobs.delete(id);
      cleaned++;
    }
  }
  if (cleaned > 0) console.log(`Cleaned up ${cleaned} expired jobs`);
}

// Run cleanup every hour
setInterval(cleanupExpiredJobs, 60 * 60 * 1000);

module.exports = {
  STATUS,
  createJob,
  getJob,
  updateJobProgress,
  completeJob,
  failJob,
  getJobStatus,
};
