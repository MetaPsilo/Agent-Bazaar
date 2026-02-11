require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const http = require("http");
const { WebSocketServer } = require("ws");
const Database = require("better-sqlite3");
const path = require("path");
const { x402Protect, handlePaymentSubmission, calculateFeeSplit } = require("./x402-facilitator");
const { createJob, getJob, updateJobProgress, completeJob, failJob, getJobStatus, STATUS } = require("./job-queue");

const {
  generalRateLimit,
  paymentRateLimit,
  registrationRateLimit,
  feedbackRateLimit,
  validateAgentId,
  validateRating,
  validateAmount,
  validateString,
  validatePubkey,
  validatePaginationQuery,
  validateSearchQuery,
  validateMinRating,
  handleValidationErrors,
  corsConfig,
  safePreparedStatement,
  securityHeaders,
} = require("./security-middleware");

const { query, body } = require("express-validator");

const app = express();

// Security middleware
app.use(securityHeaders);
app.use(cors(corsConfig));
// SECURITY: Reject prototype pollution payloads
app.use(express.json({ 
  limit: '1mb',
  verify: (req, res, buf) => {
    const str = buf.toString();
    // Check for all known prototype pollution vectors
    // Fixed operator precedence: use explicit parentheses
    if (str.includes('__proto__') || 
        (str.includes('constructor') && str.includes('prototype')) ||
        str.includes('__defineGetter__') ||
        str.includes('__defineSetter__')) {
      throw new Error('Forbidden payload');
    }
  }
}));
app.use(generalRateLimit);

// SQLite setup
const fs = require('fs');
const dbPath = path.join(__dirname, "bazaar.db");

// SECURITY: Ensure DB file has restrictive permissions
if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  const mode = (stats.mode & 0o777).toString(8);
  if (mode !== '600') {
    console.warn(`⚠️  DB file has permissive permissions (${mode}). Setting to 600.`);
    fs.chmodSync(dbPath, 0o600);
  }
}

const db = new Database(dbPath);
// SECURITY: Enable WAL mode for better concurrent read performance + crash recovery
db.pragma('journal_mode = WAL');
// SECURITY: Enable foreign keys
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    agent_id INTEGER PRIMARY KEY,
    owner TEXT NOT NULL,
    agent_wallet TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    agent_uri TEXT,
    callback_url TEXT,
    callback_secret TEXT,
    services_json TEXT DEFAULT '[]',
    active INTEGER DEFAULT 1,
    registered_at INTEGER,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS reputation (
    agent_id INTEGER PRIMARY KEY,
    total_ratings INTEGER DEFAULT 0,
    rating_sum INTEGER DEFAULT 0,
    total_volume INTEGER DEFAULT 0,
    unique_raters INTEGER DEFAULT 0,
    rating_distribution TEXT DEFAULT '[0,0,0,0,0]',
    last_rated_at INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    rater TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment_hash TEXT,
    amount_paid INTEGER DEFAULT 0,
    created_at INTEGER,
    tx_signature TEXT
  );

  CREATE TABLE IF NOT EXISTS protocol_stats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_agents INTEGER DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    total_volume INTEGER DEFAULT 0,
    platform_fee_bps INTEGER DEFAULT 250
  );

  INSERT OR IGNORE INTO protocol_stats (id) VALUES (1);
`);

// Migrations
try { db.exec(`ALTER TABLE agents ADD COLUMN services_json TEXT DEFAULT '[]'`); } catch {}
try { db.exec(`ALTER TABLE agents ADD COLUMN callback_url TEXT`); } catch {}
try { db.exec(`ALTER TABLE agents ADD COLUMN callback_secret TEXT`); } catch {}

// WebSocket setup with security
const server = http.createServer(app);
const wss = new WebSocketServer({ 
  server, 
  path: "/ws",
  maxPayload: 16 * 1024, // 16KB max message size
  perMessageDeflate: false, // Disable compression to prevent attacks
});

const wsClients = new Map(); // Use Map to track connection metadata
const MAX_CONNECTIONS = 1000; // Prevent resource exhaustion

wss.on("connection", (ws, req) => {
  // Rate limit connections per IP
  // SECURITY: Only trust x-forwarded-for behind a reverse proxy (TRUST_PROXY env var)
  const clientIP = process.env.TRUST_PROXY === 'true' 
    ? (req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection.remoteAddress)
    : req.connection.remoteAddress;
  const connectionsFromIP = Array.from(wsClients.values()).filter(meta => meta.ip === clientIP).length;
  
  if (connectionsFromIP > 10) { // Max 10 connections per IP
    ws.close(1008, "Too many connections from this IP");
    return;
  }

  if (wsClients.size >= MAX_CONNECTIONS) {
    ws.close(1013, "Server overloaded");
    return;
  }

  wsClients.set(ws, { ip: clientIP, connectedAt: Date.now() });
  
  ws.on("close", () => wsClients.delete(ws));
  
  ws.on("message", (data) => {
    // Ignore client messages to prevent abuse
    // This is a broadcast-only WebSocket
    console.log("Ignoring client message on broadcast-only WebSocket");
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    wsClients.delete(ws);
  });

  ws.on("pong", () => {
    const meta = wsClients.get(ws);
    if (meta) meta.alive = true;
  });
});

// Ping/pong to detect dead connections
const wsHeartbeat = setInterval(() => {
  for (const [ws, meta] of wsClients) {
    if (meta.alive === false) {
      wsClients.delete(ws);
      ws.terminate();
      continue;
    }
    meta.alive = false;
    ws.ping();
  }
}, 30000);

function broadcast(event) {
  if (wsClients.size === 0) return;
  
  try {
    const data = JSON.stringify(event);
    const deadClients = [];
    
    for (const [client, metadata] of wsClients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(data);
        } catch (error) {
          console.error("Broadcast send error:", error);
          deadClients.push(client);
        }
      } else {
        deadClients.push(client);
      }
    }
    
    // Clean up dead connections
    deadClients.forEach(client => wsClients.delete(client));
  } catch (error) {
    console.error("Broadcast error:", error);
  }
}

// Routes

// x402 Payment endpoints with rate limiting
app.post("/x402/pay", paymentRateLimit, handlePaymentSubmission);

// ============================================================
// LIVE AGENT SERVICE ENDPOINTS (powered by OpenClaw AI gateway)
// ============================================================

const OPENCLAW_GATEWAY = process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789";
const OPENCLAW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";

// Helper: call an agent's callback URL to fulfill a service request
async function callAgentCallback(callbackUrl, agent, service, prompt, timeoutSeconds = 60) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
    
    const timestamp = new Date().toISOString();
    const body = JSON.stringify({
      agentId: agent.agent_id,
      agentName: agent.name,
      serviceName: service.name,
      serviceDescription: service.description,
      prompt,
      timestamp,
    });
    
    // Sign the request with the agent's callback secret
    const signature = agent.callback_secret
      ? crypto.createHmac("sha256", agent.callback_secret).update(`${timestamp}.${body}`).digest("hex")
      : "";
    
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-AgentBazaar-Signature": signature,
        "X-AgentBazaar-Timestamp": timestamp,
      },
      body,
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.error(`Agent callback ${callbackUrl} returned ${response.status}`);
      return { error: "Agent returned an error", fallback: true };
    }
    
    const result = await response.json();
    return {
      content: result.content || result.data || result.result || result.message || JSON.stringify(result),
      agentName: agent.name,
      serviceName: service.name,
      fulfilledBy: "agent-callback",
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Agent callback failed:", error.message);
    return { error: "Agent unreachable or timed out", fallback: true };
  }
}

// Helper: fallback — call OpenClaw gateway for agents without a callback URL
async function callAgentViaGateway(agentName, serviceName, prompt, timeoutSeconds = 120) {
  if (!OPENCLAW_TOKEN) {
    return { error: "No callback URL and no gateway configured", fallback: true };
  }
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
    
    const response = await fetch(`${OPENCLAW_GATEWAY}/api/v1/sessions/spawn`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENCLAW_TOKEN}`,
      },
      body: JSON.stringify({
        task: `You are ${agentName}, an AI agent on Agent Bazaar. A customer has paid for your "${serviceName}" service via x402 micropayment. Fulfill their request professionally and thoroughly.\n\nCustomer request: ${prompt}\n\nRespond with the service output only — no meta-commentary about being an agent or receiving payment. Be concise but comprehensive.`,
        model: "anthropic/claude-sonnet-4",
        runTimeoutSeconds: timeoutSeconds,
        cleanup: "delete",
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return { error: "Gateway unavailable", fallback: true };
    }
    
    const result = await response.json();
    return { 
      content: result.result || result.message || result.output || "Agent completed task.",
      agentName,
      serviceName,
      fulfilledBy: "platform-gateway",
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Gateway call failed:", error.message);
    return { error: "Gateway timeout or unavailable", fallback: true };
  }
}

// Unified agent caller: tries callback URL first, then gateway fallback
async function callAgent(agent, service, prompt) {
  // 1. If agent has a callback URL, call it directly
  if (agent.callback_url) {
    const result = await callAgentCallback(agent.callback_url, agent, service, prompt);
    if (!result.fallback) return result;
    // Callback failed — don't fall back to gateway (agent owns their fulfillment)
    return result;
  }
  
  // 2. No callback URL — use platform gateway as fallback
  return callAgentViaGateway(agent.name, service.name, prompt);
}

// GET /services/agent/:agentId/:serviceIndex — Generic agent service endpoint
// Looks up agent + service from DB, calls AI to fulfill
app.get("/services/agent/:agentId/:serviceIndex", async (req, res) => {
  try {
    const { agentId, serviceIndex } = req.params;
    const { prompt } = req.query;
    
    // Look up agent
    const agentStmt = safePreparedStatement(db, "SELECT * FROM agents WHERE agent_id = ? AND active = 1", [agentId]);
    const agent = agentStmt.get(Number(agentId));
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    
    // Parse services
    let services = [];
    try { services = JSON.parse(agent.services_json || "[]"); } catch {}
    const service = services[Number(serviceIndex)];
    if (!service) return res.status(404).json({ error: "Service not found" });
    
    // Calculate price in USDC subunits (6 decimals)
    const priceUsdc = parseFloat(service.price) || 0.01;
    const priceSubunits = String(Math.round(priceUsdc * 1000000));
    
    // Check x402 payment
    const paymentHeader = req.headers["authorization"] || req.headers["x-payment"];
    if (!paymentHeader || !paymentHeader.startsWith("x402 ")) {
      return res.status(402).json({
        type: "x402",
        version: "1",
        description: `Payment required for ${agent.name} — ${service.name}`,
        price: priceSubunits,
        currency: "USDC",
        network: "solana",
        recipient: agent.agent_wallet,
        agentId: agent.agent_id,
        agentName: agent.name,
        serviceName: service.name,
        serviceDescription: service.description,
      });
    }
    
    // Payment provided — call the agent
    const result = await callAgent(
      agent,
      service,
      prompt || `Provide the ${service.name} service. ${service.description}`,
    );
    
    if (result.fallback) {
      return res.json({
        service: service.name,
        agent: agent.name,
        status: "agent_offline",
        message: agent.callback_url 
          ? "Agent's callback URL is unreachable. The agent may be temporarily offline."
          : "No callback URL configured and platform gateway unavailable.",
        timestamp: new Date().toISOString(),
      });
    }
    
    res.json({
      service: service.name,
      agent: agent.name,
      ...result,
      paymentInfo: { price: priceUsdc, currency: "USDC" },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Agent service error:", error);
    res.status(500).json({ error: "Service error" });
  }
});

// Legacy hardcoded endpoints (redirect to agent service system)
app.get("/services/research/pulse", (req, res) => {
  req.params = { agentId: "0", serviceIndex: "0" };
  req.query.prompt = req.query.prompt || "Generate a daily alpha briefing on the Solana ecosystem";
  res.redirect(307, `/services/agent/0/0?prompt=${encodeURIComponent(req.query.prompt)}`);
});

app.get("/services/research/alpha", (req, res) => {
  res.redirect(307, `/services/agent/0/1?prompt=${encodeURIComponent(req.query.prompt || "Generate a deep research report on the current state of Solana")}`);
});

app.get("/services/text-summary", (req, res) => {
  const { text } = req.query;
  if (!text) return res.status(400).json({ error: "Missing 'text' parameter" });
  if (text.length > 10000) return res.status(400).json({ error: "Text too long: max 10000 characters" });
  res.redirect(307, `/services/agent/0/2?prompt=${encodeURIComponent(`Provide a real-time ecosystem pulse. Context: ${text.substring(0, 5000)}`)}`);
});

// ============================================================
// ASYNC JOB SYSTEM
// ============================================================

// POST /jobs - Submit an async job (requires x402 payment)
// Client sends input data + payment proof, gets back a job ID to poll
app.post("/jobs", paymentRateLimit, (req, res) => {
  try {
    const { serviceId, agentId, input, paymentProof } = req.body;

    if (!serviceId) {
      return res.status(400).json({ error: "Missing serviceId" });
    }

    // For demo: create job without payment verification
    // In production: verify paymentProof first via x402
    const job = createJob(serviceId, agentId || 'demo', input || {}, {
      signature: paymentProof?.signature || `demo_${Date.now()}`,
      amount: paymentProof?.amount || 0,
    });

    // Simulate async processing for demo services
    simulateJobProcessing(job);

    broadcast({ type: 'job_created', serviceId, timestamp: Date.now() });

    res.json({
      jobId: job.id,
      status: job.status,
      message: 'Job created. Poll GET /jobs/:id/status for progress.',
      statusUrl: `/jobs/${job.id}/status`,
      resultUrl: `/jobs/${job.id}/result`,
    });
  } catch (error) {
    console.error("Job creation error:", error);
    res.status(500).json({ error: "Failed to create job" });
  }
});

// GET /jobs/:id/status - Poll job status (free, no auth required)
app.get("/jobs/:id/status", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  res.json(getJobStatus(job));
});

// GET /jobs/:id/result - Fetch job result (requires original access token)
app.get("/jobs/:id/result", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  // SECURITY: Verify access token to prevent unauthorized result access
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Authorization required. Include Bearer <accessToken> header." });
  }
  const providedToken = authHeader.substring(7);
  if (providedToken !== job.accessToken) {
    return res.status(403).json({ error: "Invalid access token" });
  }

  if (job.status !== STATUS.COMPLETED) {
    return res.status(202).json({
      error: "Job not complete",
      status: job.status,
      progress: job.progress,
      progressMessage: job.progressMessage,
    });
  }

  // Return binary result (file download)
  if (job.resultBuffer) {
    res.setHeader('Content-Type', job.resultContentType);
    res.setHeader('Content-Disposition', `attachment; filename="${job.resultFilename}"`);
    return res.send(job.resultBuffer);
  }

  // Return JSON result
  res.json({
    jobId: job.id,
    serviceId: job.serviceId,
    result: job.result,
    duration: job.completedAt - (job.startedAt || job.createdAt),
    completedAt: job.completedAt,
  });
});

// POST /jobs/:id/webhook - Register a webhook for job completion
app.post("/jobs/:id/webhook", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "Missing webhook url" });
  }
  // URL validation with comprehensive SSRF protection
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return res.status(400).json({ error: "Webhook URL must use HTTPS" });
    }
    // Reject URLs with auth info (user:pass@host)
    if (parsed.username || parsed.password) {
      return res.status(400).json({ error: "Webhook URL cannot contain credentials" });
    }
    // Block private/internal IPs (comprehensive)
    const hostname = parsed.hostname.toLowerCase();
    // Block localhost variants
    if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '127.0.0.1' ||
        hostname === '[::1]' || hostname === '[0:0:0:0:0:0:0:1]' ||
        hostname.endsWith('.localhost') || hostname === '0177.0.0.1' ||
        hostname === '0x7f000001' || hostname === '0x7f.0.0.1' ||
        // Block private ranges
        hostname.startsWith('10.') || hostname.startsWith('192.168.') ||
        hostname.startsWith('169.254.') ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
        // Block IPv6 mapped IPv4
        hostname.includes('::ffff:') ||
        // Block cloud metadata endpoints
        hostname === 'metadata.google.internal' ||
        hostname === 'metadata.internal' ||
        // Block any IP address (only allow domain names)
        /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
        /^\[/.test(hostname)) {
      return res.status(400).json({ error: "Webhook URL cannot target private/internal networks or IP addresses" });
    }
  } catch {
    return res.status(400).json({ error: "Invalid webhook URL" });
  }
  
  // SECURITY: Require access token to register webhooks (prevent unauthorized registration)
  const webhookAuth = req.headers['authorization'];
  if (!webhookAuth || !webhookAuth.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Authorization required to register webhooks" });
  }
  const webhookToken = webhookAuth.substring(7);
  if (webhookToken !== job.accessToken) {
    return res.status(403).json({ error: "Invalid access token" });
  }
  job.webhookUrl = url;
  res.json({ success: true, message: "Webhook registered" });
});

/**
 * Simulate async job processing for demo services.
 * In production, this would dispatch to the actual agent's processing pipeline.
 */
function simulateJobProcessing(job) {
  const { serviceId, input } = job;

  // Start processing after a short delay
  setTimeout(() => {
    updateJobProgress(job.id, 10, 'Processing started');
    broadcast({ type: 'job_progress', progress: 10 });
  }, 500);

  switch (serviceId) {
    case 'document-generation': {
      // Simulate PDF-like document generation
      const text = input?.text || input?.content || 'No content provided';
      const title = input?.title || 'Generated Document';
      const format = input?.format || 'markdown';

      setTimeout(() => updateJobProgress(job.id, 30, 'Analyzing content'), 1000);
      setTimeout(() => updateJobProgress(job.id, 60, 'Generating document'), 2500);
      setTimeout(() => updateJobProgress(job.id, 80, 'Formatting output'), 4000);
      setTimeout(() => {
        // Generate a markdown document (in production: actual PDF via puppeteer/etc)
        const doc = `# ${title}\n\n*Generated by Agent Bazaar*\n*${new Date().toISOString()}*\n\n---\n\n${text}\n\n---\n\n*This document was generated by an AI agent on the Agent Bazaar marketplace.*`;
        
        completeJob(job.id, Buffer.from(doc, 'utf-8'), {
          contentType: format === 'pdf' ? 'application/pdf' : 'text/markdown',
          filename: `${title.toLowerCase().replace(/\s+/g, '-')}.${format === 'pdf' ? 'pdf' : 'md'}`,
        });
        broadcast({ type: 'job_completed', serviceId });
      }, 5000);
      break;
    }

    case 'deep-research': {
      // Simulate a longer research task
      const topic = input?.topic || input?.query || 'general analysis';

      setTimeout(() => updateJobProgress(job.id, 15, 'Gathering sources'), 2000);
      setTimeout(() => updateJobProgress(job.id, 35, `Researching: ${topic}`), 5000);
      setTimeout(() => updateJobProgress(job.id, 55, 'Cross-referencing data'), 8000);
      setTimeout(() => updateJobProgress(job.id, 75, 'Synthesizing findings'), 11000);
      setTimeout(() => updateJobProgress(job.id, 90, 'Writing report'), 14000);
      setTimeout(() => {
        completeJob(job.id, {
          topic,
          summary: `Comprehensive research report on "${topic}". This is a demo response — in production, the agent would perform real research using its tools and data sources.`,
          keyFindings: [
            'Finding 1: Market analysis indicates growth potential',
            'Finding 2: Competitive landscape is fragmented',
            'Finding 3: Technical feasibility confirmed',
          ],
          sources: [
            { title: 'Source 1', url: 'https://example.com/source1' },
            { title: 'Source 2', url: 'https://example.com/source2' },
          ],
          confidence: 0.85,
          wordCount: 2500,
        });
        broadcast({ type: 'job_completed', serviceId });
      }, 16000);
      break;
    }

    case 'code-audit': {
      // Simulate code analysis
      const code = input?.code || input?.repositoryUrl || 'No code provided';

      setTimeout(() => updateJobProgress(job.id, 20, 'Parsing code'), 1000);
      setTimeout(() => updateJobProgress(job.id, 50, 'Running security analysis'), 3000);
      setTimeout(() => updateJobProgress(job.id, 75, 'Generating report'), 5000);
      setTimeout(() => {
        completeJob(job.id, {
          service: 'Code Audit',
          vulnerabilities: [
            { severity: 'medium', description: 'Unchecked arithmetic in line 42', recommendation: 'Use checked_add/checked_sub' },
            { severity: 'low', description: 'Missing input validation', recommendation: 'Add require! checks' },
          ],
          score: 82,
          summary: 'Overall code quality is good with minor improvements suggested.',
          linesAnalyzed: typeof code === 'string' ? code.split('\n').length : 0,
        });
        broadcast({ type: 'job_completed', serviceId });
      }, 7000);
      break;
    }

    default: {
      // Generic async task
      setTimeout(() => updateJobProgress(job.id, 50, 'Processing'), 2000);
      setTimeout(() => {
        completeJob(job.id, {
          service: serviceId,
          message: 'Task completed',
          input: Object.keys(input || {}),
          timestamp: new Date().toISOString(),
        });
        broadcast({ type: 'job_completed', serviceId });
      }, 4000);
    }
  }
}

// ============================================================
// AGENT REGISTRY & DATA ENDPOINTS
// ============================================================

// GET /agents - list/search agents
app.get("/agents", [
  validatePaginationQuery,
  validateSearchQuery,
  validateMinRating,
  query('sort').optional().isIn(['rating', 'transactions', 'volume', 'newest']).withMessage('Invalid sort parameter'),
  handleValidationErrors
], (req, res) => {
  try {
    const { category, minRating, sort = "rating", limit = 20, offset = 0, q } = req.query;
    
    let queryStr = `
      SELECT a.*, r.total_ratings, r.rating_sum, r.total_volume, r.rating_distribution,
             CASE WHEN r.total_ratings > 0 THEN CAST(r.rating_sum AS REAL) / r.total_ratings ELSE 0 END as avg_rating
      FROM agents a
      LEFT JOIN reputation r ON a.agent_id = r.agent_id
      WHERE a.active = 1
    `;
    const params = [];

    if (q) {
      queryStr += ` AND (a.name LIKE ? OR a.description LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }
    if (minRating) {
      queryStr += ` AND (CASE WHEN r.total_ratings > 0 THEN CAST(r.rating_sum AS REAL) / r.total_ratings ELSE 0 END) >= ?`;
      params.push(Number(minRating));
    }

    const sortMap = {
      rating: "avg_rating DESC",
      transactions: "r.total_ratings DESC",
      volume: "r.total_volume DESC",
      newest: "a.registered_at DESC",
    };
    queryStr += ` ORDER BY ${sortMap[sort]}`;
    queryStr += ` LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const agentStmt = safePreparedStatement(db, queryStr, params);
    const agents = agentStmt.all(...params).map(a => {
      const { callback_secret, services_json, ...safe } = a;
      return { ...safe, services: (() => { try { return JSON.parse(services_json || '[]'); } catch { return []; } })() };
    });
    
    const countStmt = safePreparedStatement(db, "SELECT COUNT(*) as c FROM agents WHERE active = 1", []);
    const total = countStmt.get().c;

    res.json({ agents, total, offset: Number(offset), limit: Number(limit) });
  } catch (error) {
    console.error("Agents query error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /agents/:id
app.get("/agents/:id", [
  validateAgentId,
  handleValidationErrors
], (req, res) => {
  try {
    const stmt = safePreparedStatement(db, `
      SELECT a.*, r.total_ratings, r.rating_sum, r.total_volume, r.unique_raters, r.rating_distribution,
             CASE WHEN r.total_ratings > 0 THEN CAST(r.rating_sum AS REAL) / r.total_ratings ELSE 0 END as avg_rating
      FROM agents a
      LEFT JOIN reputation r ON a.agent_id = r.agent_id
      WHERE a.agent_id = ?
    `, [req.params.id]);
    
    const raw = stmt.get(req.params.id);
    if (!raw) return res.status(404).json({ error: "Agent not found" });
    const { callback_secret, services_json, ...agent } = raw;
    agent.services = (() => { try { return JSON.parse(services_json || '[]'); } catch { return []; } })();
    res.json(agent);
  } catch (error) {
    console.error("Agent fetch error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /agents/:id/feedback
app.get("/agents/:id/feedback", [
  validateAgentId,
  validatePaginationQuery,
  handleValidationErrors
], (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    const feedbackStmt = safePreparedStatement(db,
      "SELECT * FROM feedback WHERE agent_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [req.params.id, limit, offset]
    );
    const feedbacks = feedbackStmt.all(req.params.id, Number(limit), Number(offset));
    
    res.json(feedbacks);
  } catch (error) {
    console.error("Feedback fetch error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /stats
app.get("/stats", (req, res) => {
  try {
    const statsStmt = safePreparedStatement(db, "SELECT * FROM protocol_stats WHERE id = 1", []);
    const stats = statsStmt.get();
    
    const activeAgentsStmt = safePreparedStatement(db, "SELECT COUNT(*) as c FROM agents WHERE active = 1", []);
    const activeAgents = activeAgentsStmt.get().c;
    
    res.json({ ...stats, activeAgents });
  } catch (error) {
    console.error("Stats fetch error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /leaderboard
app.get("/leaderboard", [
  query('metric').optional().isIn(['rating', 'transactions', 'volume']).withMessage('Invalid metric'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  handleValidationErrors
], (req, res) => {
  try {
    const { metric = "rating", limit = 20 } = req.query;
    const sortMap = {
      rating: "avg_rating DESC",
      transactions: "r.total_ratings DESC",
      volume: "r.total_volume DESC",
    };
    
    const queryStr = `
      SELECT a.*, r.total_ratings, r.rating_sum, r.total_volume, r.rating_distribution,
             CASE WHEN r.total_ratings > 0 THEN CAST(r.rating_sum AS REAL) / r.total_ratings ELSE 0 END as avg_rating
      FROM agents a
      LEFT JOIN reputation r ON a.agent_id = r.agent_id
      WHERE a.active = 1
      ORDER BY ${sortMap[metric]}
      LIMIT ?
    `;
    
    const agentsStmt = safePreparedStatement(db, queryStr, [limit]);
    const agents = agentsStmt.all(Number(limit)).map(a => {
      const { callback_secret, services_json, ...safe } = a;
      return { ...safe, services: (() => { try { return JSON.parse(services_json || '[]'); } catch { return []; } })() };
    });
    
    res.json(agents);
  } catch (error) {
    console.error("Leaderboard fetch error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /feedback - submit feedback (simplified, stores in DB)
app.post("/feedback", [
  feedbackRateLimit,
  body('agentId').isInt({ min: 0 }).withMessage('Invalid agent ID').toInt(),
  validateRating,
  validateAmount,
  body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Comment too long')
    .customSanitizer(value => value ? value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') : value),
  body('rater').isLength({ min: 32, max: 44 }).matches(/^[1-9A-HJ-NP-Za-km-z]+$/)
    .withMessage('rater must be a valid Solana public key'),
  body('txSignature').isLength({ min: 32, max: 128 }).withMessage('Transaction signature required'),
  body('authSignature').isLength({ min: 32, max: 256 }).withMessage('Wallet signature required for authentication'),
  body('authMessage').isLength({ min: 10, max: 256 }).withMessage('Signed message required'),
  handleValidationErrors
], (req, res) => {
  try {
    const { agentId, rating, comment, txSignature, amountPaid = 0 } = req.body;

    // Check if agent exists and is active
    const agentStmt = safePreparedStatement(db, "SELECT active, owner FROM agents WHERE agent_id = ?", [agentId]);
    const agent = agentStmt.get(agentId);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    if (!agent.active) {
      return res.status(400).json({ error: "Agent is not active" });
    }

    // SECURITY: Verify ed25519 signature proving caller controls rater wallet
    const { rater: raterAddress, authSignature: feedbackAuthSig, authMessage: feedbackAuthMsg } = req.body;
    
    if (!feedbackAuthSig || !feedbackAuthMsg) {
      return res.status(403).json({ 
        error: "Wallet signature required. Sign a message containing 'feedback:<agentId>:<timestamp>' with your rater wallet.",
      });
    }

    try {
      const { PublicKey } = require('@solana/web3.js');
      const nacl = require('tweetnacl');
      const bs58 = require('bs58');
      const raterPubkey = new PublicKey(raterAddress);
      const messageBytes = new TextEncoder().encode(feedbackAuthMsg);
      const signatureBytes = bs58.decode(feedbackAuthSig);
      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, raterPubkey.toBytes());
      if (!isValid) {
        return res.status(403).json({ error: "Invalid wallet signature" });
      }
      // Verify message contains the correct agent ID
      if (!feedbackAuthMsg.includes(`feedback:${agentId}:`)) {
        return res.status(403).json({ error: "Signature message must contain the agent ID" });
      }
      // Verify timestamp is recent (within 5 minutes)
      const msgParts = feedbackAuthMsg.split(':');
      const msgTimestamp = parseInt(msgParts[2]);
      const nowSec = Math.floor(Date.now() / 1000);
      if (isNaN(msgTimestamp) || Math.abs(nowSec - msgTimestamp) > 300) {
        return res.status(403).json({ error: "Signature expired or timestamp invalid" });
      }
    } catch (sigError) {
      return res.status(403).json({ error: "Signature verification failed: " + sigError.message });
    }

    // SECURITY: Prevent self-rating (now verified via cryptographic proof)
    if (raterAddress === agent.owner) {
      return res.status(403).json({ error: "Cannot rate your own agent" });
    }

    // Note: amount_paid is self-reported. In production, verify against actual on-chain SPL transfer.
    const sanitizedAmount = Math.max(0, amountPaid || 0);

    const commentHash = comment ? require("crypto").createHash("sha256").update(comment).digest("hex") : null;
    const now = Math.floor(Date.now() / 1000);

    // Use transaction for atomicity
    const transaction = db.transaction(() => {
      // Insert feedback
      const insertFeedbackStmt = safePreparedStatement(db,
        "INSERT INTO feedback (agent_id, rater, rating, comment_hash, amount_paid, created_at, tx_signature) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [agentId, raterAddress || "api-user", rating, commentHash, sanitizedAmount, now, txSignature || null]
      );
      insertFeedbackStmt.run(agentId, raterAddress || "api-user", rating, commentHash, sanitizedAmount, now, txSignature || null);

      // Update reputation
      const repStmt = safePreparedStatement(db, "SELECT * FROM reputation WHERE agent_id = ?", [agentId]);
      const rep = repStmt.get(agentId);
      if (rep) {
        let dist;
        try {
          dist = JSON.parse(rep.rating_distribution);
          if (!Array.isArray(dist) || dist.length !== 5) throw new Error('invalid');
        } catch {
          dist = [0, 0, 0, 0, 0]; // Reset if corrupted
        }
        dist[rating - 1]++;
        
        const updateRepStmt = safePreparedStatement(db, `
          UPDATE reputation SET
            total_ratings = total_ratings + 1,
            rating_sum = rating_sum + ?,
            total_volume = total_volume + ?,
            unique_raters = unique_raters + 1,
            rating_distribution = ?,
            last_rated_at = ?
          WHERE agent_id = ?
        `, [rating, amountPaid, JSON.stringify(dist), now, agentId]);
        updateRepStmt.run(rating, sanitizedAmount, JSON.stringify(dist), now, agentId);
      }

      // Update protocol stats
      const updateStatsStmt = safePreparedStatement(db, 
        "UPDATE protocol_stats SET total_transactions = total_transactions + 1, total_volume = total_volume + ? WHERE id = 1",
        [amountPaid]
      );
      updateStatsStmt.run(sanitizedAmount);
    });

    transaction();

    broadcast({ type: "feedback", agentId, rating, amountPaid: sanitizedAmount, timestamp: now });
    res.json({ success: true });
  } catch (error) {
    console.error("Feedback submission error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /agents - register agent via API (stores in DB, for demo)
app.post("/agents", registrationRateLimit, [
  validateString('name', 64),
  validateString('description', 512),
  body('agentUri').optional().isURL().withMessage('Invalid agent URI'),
  body('callbackUrl').optional().isURL().withMessage('Invalid callback URL'),
  body('services').optional().isArray({ max: 20 }).withMessage('Services must be an array (max 20)'),
  validatePubkey('owner'),
  validatePubkey('agentWallet').optional(),
  handleValidationErrors
], (req, res) => {
  try {
    const { name, description = "", agentUri = "", callbackUrl = "", owner, agentWallet, services = [] } = req.body;
    
    // Generate callback secret for webhook signature verification
    const callbackSecret = crypto.randomBytes(32).toString("hex");
    
    // Sanitize services array
    const sanitizedServices = services.slice(0, 20).map(s => ({
      name: String(s.name || '').slice(0, 64),
      description: String(s.description || '').slice(0, 256),
      price: String(s.price || '').slice(0, 20),
    })).filter(s => s.name.length > 0);
    const servicesJson = JSON.stringify(sanitizedServices);

    // Check for duplicate names
    const existingStmt = safePreparedStatement(db, "SELECT agent_id FROM agents WHERE name = ? AND active = 1", [name]);
    const existing = existingStmt.get(name);
    if (existing) {
      return res.status(409).json({ error: "Agent name already exists" });
    }

    const transaction = db.transaction(() => {
      const statsStmt = safePreparedStatement(db, "SELECT * FROM protocol_stats WHERE id = 1", []);
      const stats = statsStmt.get();
      const agentId = stats.total_agents;
      const now = Math.floor(Date.now() / 1000);

      const insertAgentStmt = safePreparedStatement(db,
        "INSERT INTO agents (agent_id, owner, agent_wallet, name, description, agent_uri, callback_url, callback_secret, services_json, active, registered_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
        [agentId, owner, agentWallet || owner, name, description, agentUri, callbackUrl, callbackSecret, servicesJson, now, now]
      );
      insertAgentStmt.run(agentId, owner, agentWallet || owner, name, description, agentUri, callbackUrl, callbackSecret, servicesJson, now, now);

      const insertRepStmt = safePreparedStatement(db, "INSERT INTO reputation (agent_id) VALUES (?)", [agentId]);
      insertRepStmt.run(agentId);

      const updateStatsStmt = safePreparedStatement(db, "UPDATE protocol_stats SET total_agents = total_agents + 1 WHERE id = 1", []);
      updateStatsStmt.run();

      return { agentId, name, timestamp: now };
    });

    const result = transaction();
    
    broadcast({ type: "registration", agentId: result.agentId, name: result.name, timestamp: result.timestamp });
    res.json({ 
      agentId: result.agentId, 
      success: true,
      callbackSecret: callbackSecret,
      message: "Save your callback secret — it's shown only once. Use it to verify that webhook requests come from Agent Bazaar.",
    });
  } catch (error) {
    console.error("Agent registration error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// PUT /agents/:id - update agent
app.put("/agents/:id", [
  validateAgentId,
  validateString('name', 64).optional(),
  validateString('description', 256).optional(),
  body('agentUri').optional().isURL().withMessage('Invalid agent URI'),
  body('active').optional().isBoolean().withMessage('Active must be boolean'),
  handleValidationErrors
], (req, res) => {
  try {
    const agentId = req.params.id;
    const { name, description, agentUri, active } = req.body;

    // Check if agent exists
    const existingStmt = safePreparedStatement(db, "SELECT * FROM agents WHERE agent_id = ?", [agentId]);
    const existing = existingStmt.get(agentId);
    if (!existing) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // SECURITY: Verify ownership via ed25519 signature
    const { owner: requestOwner, authSignature, authMessage } = req.body;
    if (!requestOwner || existing.owner !== requestOwner) {
      return res.status(403).json({ error: "Unauthorized: only the agent owner can update" });
    }
    
    // Require signature proof of ownership
    if (!authSignature || !authMessage) {
      return res.status(403).json({ 
        error: "Signature required. Sign a message containing the agent ID and current timestamp with your owner wallet.",
        required: { authMessage: "update:<agentId>:<timestamp>", authSignature: "base58-encoded ed25519 signature" }
      });
    }
    
    // Verify ed25519 signature
    try {
      const { PublicKey } = require('@solana/web3.js');
      const nacl = require('tweetnacl');
      const bs58 = require('bs58');
      const ownerPubkey = new PublicKey(requestOwner);
      const messageBytes = new TextEncoder().encode(authMessage);
      const signatureBytes = bs58.decode(authSignature);
      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, ownerPubkey.toBytes());
      if (!isValid) {
        return res.status(403).json({ error: "Invalid signature" });
      }
      // Verify message contains the correct agent ID
      if (!authMessage.includes(`update:${agentId}:`)) {
        return res.status(403).json({ error: "Signature message must contain the agent ID" });
      }
      // Verify timestamp is recent (within 5 minutes)
      const msgParts = authMessage.split(':');
      const msgTimestamp = parseInt(msgParts[2]);
      const now = Math.floor(Date.now() / 1000);
      if (isNaN(msgTimestamp) || Math.abs(now - msgTimestamp) > 300) {
        return res.status(403).json({ error: "Signature expired or timestamp invalid" });
      }
    } catch (sigError) {
      return res.status(403).json({ error: "Signature verification failed" });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      values.push(description);
    }
    if (agentUri !== undefined) {
      updates.push("agent_uri = ?");
      values.push(agentUri);
    }
    if (active !== undefined) {
      updates.push("active = ?");
      values.push(active ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updates.push("updated_at = ?");
    values.push(Math.floor(Date.now() / 1000));
    values.push(agentId);

    const updateQuery = `UPDATE agents SET ${updates.join(", ")} WHERE agent_id = ?`;
    const updateStmt = safePreparedStatement(db, updateQuery, values);
    updateStmt.run(...values);

    res.json({ success: true, agentId: Number(agentId) });
  } catch (error) {
    console.error("Agent update error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// Health
app.get("/health", (_, res) => res.json({ status: "ok" }));

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));
  // SPA fallback — serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/agents') && !req.path.startsWith('/stats') && 
        !req.path.startsWith('/leaderboard') && !req.path.startsWith('/search') &&
        !req.path.startsWith('/services') && !req.path.startsWith('/health') &&
        !req.path.startsWith('/ws') && !req.path.startsWith('/jobs') &&
        !req.path.startsWith('/x402') && !req.path.startsWith('/feedback') &&
        !req.path.startsWith('/assets') && !req.path.endsWith('.js') &&
        !req.path.endsWith('.css') && !req.path.endsWith('.png') &&
        !req.path.endsWith('.svg') && !req.path.endsWith('.ico')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
}

// SECURITY: Connection timeouts to prevent Slowloris attacks
server.timeout = 30000; // 30s request timeout
server.headersTimeout = 10000; // 10s to send headers
server.keepAliveTimeout = 5000; // 5s keep-alive
server.maxHeadersCount = 50; // Limit header count

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Agent Bazaar API running on port ${PORT}`);
  console.log(`WebSocket server on ws://localhost:${PORT}/ws`);
});
