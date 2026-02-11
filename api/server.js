require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const http = require("http");
const { WebSocketServer } = require("ws");
const { Pool } = require("pg");
const path = require("path");
const { x402Protect, handlePaymentSubmission, calculateFeeSplit } = require("./x402-facilitator");
const { createJob, getJob, updateJobProgress, completeJob, failJob, getJobStatus, STATUS } = require("./job-queue");
const { initPaymentCache } = require("./payment-cache");

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
  securityHeaders,
} = require("./security-middleware");

const { query, body } = require("express-validator");

// PostgreSQL setup — require DATABASE_URL (Railway provides this)
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required. Add a PostgreSQL addon in Railway.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

const app = express();

// Security middleware
app.use(securityHeaders);
app.use(cors(corsConfig));
// SECURITY: Reject prototype pollution payloads
app.use(express.json({ 
  limit: '1mb',
  verify: (req, res, buf) => {
    const str = buf.toString();
    if (str.includes('__proto__') || 
        (str.includes('constructor') && str.includes('prototype')) ||
        str.includes('__defineGetter__') ||
        str.includes('__defineSetter__')) {
      throw new Error('Forbidden payload');
    }
  }
}));
app.use(generalRateLimit);

// Initialize database schema
async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agents (
      agent_id SERIAL PRIMARY KEY,
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
      total_volume REAL DEFAULT 0,
      unique_raters INTEGER DEFAULT 0,
      rating_distribution TEXT DEFAULT '[0,0,0,0,0]',
      last_rated_at INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
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
      total_volume REAL DEFAULT 0,
      platform_fee_bps INTEGER DEFAULT 250
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      service_name TEXT,
      amount REAL DEFAULT 0,
      caller TEXT,
      created_at INTEGER
    );

    INSERT INTO protocol_stats (id) VALUES (1) ON CONFLICT DO NOTHING;
  `);

  // Migrations — add columns if they don't exist
  const migrations = [
    `DO $$ BEGIN ALTER TABLE agents ADD COLUMN services_json TEXT DEFAULT '[]'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
    `DO $$ BEGIN ALTER TABLE agents ADD COLUMN callback_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
    `DO $$ BEGIN ALTER TABLE agents ADD COLUMN callback_secret TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_agent_rater ON feedback (agent_id, rater);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_tx_signature ON feedback (tx_signature) WHERE tx_signature IS NOT NULL;`,
    `DO $$ BEGIN ALTER TABLE agents ADD COLUMN last_seen_at INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
    `DO $$ BEGIN ALTER TABLE reputation ALTER COLUMN total_volume TYPE REAL USING total_volume::REAL; EXCEPTION WHEN others THEN NULL; END $$;`,
    `DO $$ BEGIN ALTER TABLE protocol_stats ALTER COLUMN total_volume TYPE REAL USING total_volume::REAL; EXCEPTION WHEN others THEN NULL; END $$;`,
    `UPDATE protocol_stats SET total_transactions = GREATEST(total_transactions, 2), total_volume = GREATEST(total_volume, 0.02) WHERE id = 1;`,
    // Seed historical transactions from pre-tracking service calls
    // Seed historical test transactions — use recent timestamps
    // Re-seed test transactions with correct timestamps on each boot
    `UPDATE transactions SET created_at = EXTRACT(EPOCH FROM NOW())::INTEGER - 3600 WHERE caller = 'test-client' AND service_name = 'Solana Pulse';`,
    `UPDATE transactions SET created_at = EXTRACT(EPOCH FROM NOW())::INTEGER - 3540 WHERE caller = 'test-client' AND service_name = 'Deep Research';`,
    `INSERT INTO transactions (agent_id, service_name, amount, caller, created_at) SELECT 1, 'Solana Pulse', 0.01, 'test-client', EXTRACT(EPOCH FROM NOW())::INTEGER - 3600 WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE caller = 'test-client' AND service_name = 'Solana Pulse');`,
    `INSERT INTO transactions (agent_id, service_name, amount, caller, created_at) SELECT 1, 'Deep Research', 0.01, 'test-client', EXTRACT(EPOCH FROM NOW())::INTEGER - 3540 WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE caller = 'test-client' AND service_name = 'Deep Research');`,
    `UPDATE reputation SET total_volume = GREATEST(total_volume, 0.02) WHERE agent_id = 1;`,
  ];
  for (const m of migrations) {
    await pool.query(m);
  }

  // Initialize payment cache
  await initPaymentCache(pool);

  // Start periodic agent health checks
  startHealthChecks();
}

// ============================================================
// AGENT HEALTH CHECK SYSTEM
// Periodically pings callback URLs to determine online/offline
// ============================================================
function computeAgentStatus(agent) {
  if (!agent.active) return 'offline';
  if (!agent.last_seen_at) return 'offline';
  const age = Math.floor(Date.now() / 1000) - agent.last_seen_at;
  if (age < 120) return 'online';    // Seen in last 2 min
  if (age < 600) return 'busy';      // Seen in last 10 min (might be slow)
  return 'offline';
}

function mapAgent(a) {
  const { callback_secret, services_json, ...safe } = a;
  return {
    ...safe,
    services: (() => { try { return JSON.parse(services_json || '[]'); } catch { return []; } })(),
    status: computeAgentStatus(a),
  };
}

async function checkAgentHealth(agent) {
  if (!agent.callback_url) return false;
  try {
    // Hit the root of the callback server (not /fulfill) for a lightweight health check
    const baseUrl = new URL(agent.callback_url);
    const healthUrl = `${baseUrl.protocol}//${baseUrl.host}/health`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

function startHealthChecks() {
  // Run every 60 seconds
  setInterval(async () => {
    try {
      const { rows: agents } = await pool.query(
        "SELECT agent_id, callback_url FROM agents WHERE active = 1 AND callback_url IS NOT NULL"
      );
      const now = Math.floor(Date.now() / 1000);
      for (const agent of agents) {
        const alive = await checkAgentHealth(agent);
        if (alive) {
          await pool.query("UPDATE agents SET last_seen_at = $1 WHERE agent_id = $2", [now, agent.agent_id]);
        }
      }
    } catch (err) {
      console.error("Health check error:", err.message);
    }
  }, 60000);

  // Run immediately on startup
  setTimeout(async () => {
    try {
      const { rows: agents } = await pool.query(
        "SELECT agent_id, callback_url FROM agents WHERE active = 1 AND callback_url IS NOT NULL"
      );
      const now = Math.floor(Date.now() / 1000);
      for (const agent of agents) {
        const alive = await checkAgentHealth(agent);
        if (alive) {
          await pool.query("UPDATE agents SET last_seen_at = $1 WHERE agent_id = $2", [now, agent.agent_id]);
        }
      }
    } catch (err) {
      console.error("Initial health check error:", err.message);
    }
  }, 5000);
}

// WebSocket setup with security
const server = http.createServer(app);
const wss = new WebSocketServer({ 
  server, 
  path: "/ws",
  maxPayload: 16 * 1024,
  perMessageDeflate: false,
});

const wsClients = new Map();
const MAX_CONNECTIONS = 1000;

wss.on("connection", (ws, req) => {
  const clientIP = process.env.TRUST_PROXY === 'true' 
    ? (req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection.remoteAddress)
    : req.connection.remoteAddress;
  const connectionsFromIP = Array.from(wsClients.values()).filter(meta => meta.ip === clientIP).length;
  
  if (connectionsFromIP > 10) {
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
      if (client.readyState === 1) {
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

async function callAgentCallback(callbackUrl, agent, service, prompt, timeoutSeconds = 60) {
  try {
    // SECURITY: Re-validate callbackUrl at call time (in case DB was manipulated)
    const urlCheck = validateCallbackUrl(callbackUrl);
    if (!urlCheck.valid) {
      console.error(`Blocked SSRF attempt to ${callbackUrl}: ${urlCheck.error}`);
      return { error: "Agent callback URL is invalid", fallback: true };
    }

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

async function callAgent(agent, service, prompt) {
  if (!agent.callback_url) {
    return { error: "Agent has no callback URL configured", fallback: true };
  }
  return callAgentCallback(agent.callback_url, agent, service, prompt);
}

// GET /services/agent/:agentId/:serviceIndex
app.get("/services/agent/:agentId/:serviceIndex", async (req, res) => {
  try {
    const { agentId, serviceIndex } = req.params;
    const { prompt } = req.query;
    
    const { rows } = await pool.query("SELECT * FROM agents WHERE agent_id = $1 AND active = 1", [Number(agentId)]);
    const agent = rows[0];
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    
    let services = [];
    try { services = JSON.parse(agent.services_json || "[]"); } catch {}
    const service = services[Number(serviceIndex)];
    if (!service) return res.status(404).json({ error: "Service not found" });
    
    const priceUsdc = parseFloat(service.price) || 0.01;
    const priceSubunits = String(Math.round(priceUsdc * 1000000));
    
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
    
    // Track transaction in protocol stats, reputation, and transactions table
    try {
      const now = Math.floor(Date.now() / 1000);
      await pool.query(
        "UPDATE protocol_stats SET total_transactions = total_transactions + 1, total_volume = total_volume + $1 WHERE id = 1",
        [priceUsdc]
      );
      await pool.query(
        "UPDATE reputation SET total_volume = total_volume + $1 WHERE agent_id = $2",
        [priceUsdc, Number(agentId)]
      );
      await pool.query(
        "INSERT INTO transactions (agent_id, service_name, amount, caller, created_at) VALUES ($1, $2, $3, $4, $5)",
        [Number(agentId), service.name, priceUsdc, 'x402-client', now]
      );
      broadcast({ type: 'payment', agentName: agent.name, agentId: agent.agent_id, amount: priceUsdc, serviceName: service.name, timestamp: Math.floor(Date.now() / 1000) });
    } catch (statsErr) {
      console.error("Stats tracking error (non-fatal):", statsErr);
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

// SECURITY: Validate callback URLs against SSRF
function validateCallbackUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: "URL must use HTTP or HTTPS" };
    }
    if (parsed.username || parsed.password) {
      return { valid: false, error: "URL cannot contain credentials" };
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '127.0.0.1' ||
        hostname === '[::1]' || hostname === '[0:0:0:0:0:0:0:1]' ||
        hostname.endsWith('.localhost') || hostname === '0177.0.0.1' ||
        hostname === '0x7f000001' || hostname === '0x7f.0.0.1' ||
        hostname.startsWith('10.') || hostname.startsWith('192.168.') ||
        hostname.startsWith('169.254.') ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
        hostname.includes('::ffff:') ||
        hostname === 'metadata.google.internal' ||
        hostname === 'metadata.internal' ||
        /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
        /^\[/.test(hostname)) {
      return { valid: false, error: "URL cannot target private/internal networks or IP addresses" };
    }
    return { valid: true, parsed };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

// Test a callback URL before registration
app.post("/test-callback", generalRateLimit, async (req, res) => {
  const { callbackUrl } = req.body;
  if (!callbackUrl) return res.status(400).json({ error: "Missing callbackUrl" });
  
  const urlCheck = validateCallbackUrl(callbackUrl);
  if (!urlCheck.valid) {
    return res.json({ success: false, error: urlCheck.error });
  }
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-AgentBazaar-Signature": "test",
        "X-AgentBazaar-Timestamp": new Date().toISOString(),
      },
      body: JSON.stringify({
        agentId: -1,
        agentName: "Test Agent",
        serviceName: "Connectivity Test",
        serviceDescription: "Testing callback URL connectivity",
        prompt: "This is a test request from Agent Bazaar to verify your callback URL is reachable. Respond with any JSON.",
        timestamp: new Date().toISOString(),
        test: true,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    res.json({ success: response.ok, status: response.status });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Legacy hardcoded endpoints
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

app.post("/jobs", paymentRateLimit, (req, res) => {
  try {
    const { serviceId, agentId, input, paymentProof } = req.body;

    if (!serviceId) {
      return res.status(400).json({ error: "Missing serviceId" });
    }

    // SECURITY: Require payment proof (demo sigs only in development)
    if (!paymentProof?.signature) {
      return res.status(402).json({ error: "Payment proof required. Submit a payment via /x402/pay first." });
    }
    if (process.env.NODE_ENV !== 'development' && paymentProof.signature.startsWith('demo_')) {
      return res.status(402).json({ error: "Demo signatures not accepted in production" });
    }

    const job = createJob(serviceId, agentId || 'demo', input || {}, {
      signature: paymentProof.signature,
      amount: paymentProof?.amount || 0,
    });

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

app.get("/jobs/:id/status", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  res.json(getJobStatus(job));
});

app.get("/jobs/:id/result", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

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

  if (job.resultBuffer) {
    res.setHeader('Content-Type', job.resultContentType);
    res.setHeader('Content-Disposition', `attachment; filename="${job.resultFilename}"`);
    return res.send(job.resultBuffer);
  }

  res.json({
    jobId: job.id,
    serviceId: job.serviceId,
    result: job.result,
    duration: job.completedAt - (job.startedAt || job.createdAt),
    completedAt: job.completedAt,
  });
});

app.post("/jobs/:id/webhook", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "Missing webhook url" });
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return res.status(400).json({ error: "Webhook URL must use HTTPS" });
    }
    if (parsed.username || parsed.password) {
      return res.status(400).json({ error: "Webhook URL cannot contain credentials" });
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '127.0.0.1' ||
        hostname === '[::1]' || hostname === '[0:0:0:0:0:0:0:1]' ||
        hostname.endsWith('.localhost') || hostname === '0177.0.0.1' ||
        hostname === '0x7f000001' || hostname === '0x7f.0.0.1' ||
        hostname.startsWith('10.') || hostname.startsWith('192.168.') ||
        hostname.startsWith('169.254.') ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
        hostname.includes('::ffff:') ||
        hostname === 'metadata.google.internal' ||
        hostname === 'metadata.internal' ||
        /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
        /^\[/.test(hostname)) {
      return res.status(400).json({ error: "Webhook URL cannot target private/internal networks or IP addresses" });
    }
  } catch {
    return res.status(400).json({ error: "Invalid webhook URL" });
  }
  
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

function simulateJobProcessing(job) {
  const { serviceId, input } = job;

  setTimeout(() => {
    updateJobProgress(job.id, 10, 'Processing started');
    broadcast({ type: 'job_progress', progress: 10 });
  }, 500);

  switch (serviceId) {
    case 'document-generation': {
      const text = input?.text || input?.content || 'No content provided';
      const title = input?.title || 'Generated Document';
      const format = input?.format || 'markdown';

      setTimeout(() => updateJobProgress(job.id, 30, 'Analyzing content'), 1000);
      setTimeout(() => updateJobProgress(job.id, 60, 'Generating document'), 2500);
      setTimeout(() => updateJobProgress(job.id, 80, 'Formatting output'), 4000);
      setTimeout(() => {
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
], async (req, res) => {
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
    let paramIndex = 1;

    if (q) {
      queryStr += ` AND (a.name LIKE $${paramIndex} OR a.description LIKE $${paramIndex + 1})`;
      params.push(`%${q}%`, `%${q}%`);
      paramIndex += 2;
    }
    if (minRating) {
      queryStr += ` AND (CASE WHEN r.total_ratings > 0 THEN CAST(r.rating_sum AS REAL) / r.total_ratings ELSE 0 END) >= $${paramIndex}`;
      params.push(Number(minRating));
      paramIndex++;
    }

    const sortMap = {
      rating: "avg_rating DESC",
      transactions: "r.total_ratings DESC",
      volume: "r.total_volume DESC",
      newest: "a.registered_at DESC",
    };
    queryStr += ` ORDER BY ${sortMap[sort]}`;
    queryStr += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const { rows: agents } = await pool.query(queryStr, params);
    const mapped = agents.map(mapAgent);
    
    const { rows: countRows } = await pool.query("SELECT COUNT(*) as c FROM agents WHERE active = 1");
    const total = parseInt(countRows[0].c);

    res.json({ agents: mapped, total, offset: Number(offset), limit: Number(limit) });
  } catch (error) {
    console.error("Agents query error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /agents/:id
app.get("/agents/:id", [
  validateAgentId,
  handleValidationErrors
], async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, r.total_ratings, r.rating_sum, r.total_volume, r.unique_raters, r.rating_distribution,
             CASE WHEN r.total_ratings > 0 THEN CAST(r.rating_sum AS REAL) / r.total_ratings ELSE 0 END as avg_rating
      FROM agents a
      LEFT JOIN reputation r ON a.agent_id = r.agent_id
      WHERE a.agent_id = $1
    `, [req.params.id]);
    
    const raw = rows[0];
    if (!raw) return res.status(404).json({ error: "Agent not found" });
    res.json(mapAgent(raw));
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
], async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    const { rows } = await pool.query(
      "SELECT * FROM feedback WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
      [req.params.id, Number(limit), Number(offset)]
    );
    
    res.json(rows);
  } catch (error) {
    console.error("Feedback fetch error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /stats
app.get("/stats", async (req, res) => {
  try {
    const { rows: statsRows } = await pool.query("SELECT * FROM protocol_stats WHERE id = 1");
    const stats = statsRows[0];
    
    const { rows: countRows } = await pool.query("SELECT COUNT(*) as c FROM agents WHERE active = 1");
    const activeAgents = parseInt(countRows[0].c);
    const { rows: totalRows } = await pool.query("SELECT COUNT(*) as c FROM agents");
    const totalAgents = parseInt(totalRows[0].c);
    const { rows: ratingRows } = await pool.query("SELECT COALESCE(SUM(total_ratings), 0) as c FROM reputation");
    const totalRatings = parseInt(ratingRows[0].c);
    
    res.json({ ...stats, total_agents: totalAgents, activeAgents, totalRatings });
  } catch (error) {
    console.error("Stats fetch error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /activity - recent platform activity (registrations, payments, feedback)
app.get("/activity", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const activities = [];

    // Recent registrations
    const { rows: regs } = await pool.query(
      "SELECT agent_id, name, registered_at FROM agents ORDER BY registered_at DESC LIMIT $1", [limit]
    );
    regs.forEach(r => activities.push({
      type: 'registration', agent: r.name, agentId: r.agent_id, timestamp: r.registered_at
    }));

    // Recent transactions
    const { rows: txs } = await pool.query(
      `SELECT t.agent_id, t.service_name, t.amount, t.caller, t.created_at, a.name FROM transactions t
       JOIN agents a ON a.agent_id = t.agent_id ORDER BY t.created_at DESC LIMIT $1`, [limit]
    );
    txs.forEach(t => activities.push({
      type: 'payment', agent: t.name, agentId: t.agent_id, amount: t.amount,
      from: t.caller?.slice(0, 8) + '...', to: t.name, serviceName: t.service_name, timestamp: t.created_at
    }));

    // Recent feedback
    const { rows: fbs } = await pool.query(
      `SELECT f.agent_id, f.rating, f.rater, f.created_at, a.name FROM feedback f 
       JOIN agents a ON a.agent_id = f.agent_id ORDER BY f.created_at DESC LIMIT $1`, [limit]
    );
    fbs.forEach(f => activities.push({
      type: 'feedback', agent: f.name, agentId: f.agent_id, rating: f.rating, 
      from: f.rater?.slice(0, 8) + '...', timestamp: f.created_at
    }));

    // Sort by timestamp descending, return top N
    activities.sort((a, b) => b.timestamp - a.timestamp);
    res.json(activities.slice(0, limit));
  } catch (error) {
    console.error("Activity fetch error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /leaderboard
app.get("/leaderboard", [
  query('metric').optional().isIn(['rating', 'transactions', 'volume']).withMessage('Invalid metric'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  handleValidationErrors
], async (req, res) => {
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
      LIMIT $1
    `;
    
    const { rows } = await pool.query(queryStr, [Number(limit)]);
    const agents = rows.map(mapAgent);
    
    res.json(agents);
  } catch (error) {
    console.error("Leaderboard fetch error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /feedback
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
], async (req, res) => {
  try {
    const { agentId, rating, comment, txSignature, amountPaid = 0 } = req.body;

    const { rows: agentRows } = await pool.query("SELECT active, owner FROM agents WHERE agent_id = $1", [agentId]);
    const agent = agentRows[0];
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
      if (!feedbackAuthMsg.includes(`feedback:${agentId}:`)) {
        return res.status(403).json({ error: "Signature message must contain the agent ID" });
      }
      const msgParts = feedbackAuthMsg.split(':');
      const msgTimestamp = parseInt(msgParts[2]);
      const nowSec = Math.floor(Date.now() / 1000);
      if (isNaN(msgTimestamp) || Math.abs(nowSec - msgTimestamp) > 300) {
        return res.status(403).json({ error: "Signature expired or timestamp invalid" });
      }
    } catch (sigError) {
      return res.status(403).json({ error: "Signature verification failed: " + sigError.message });
    }

    // SECURITY: Prevent self-rating
    if (raterAddress === agent.owner) {
      return res.status(403).json({ error: "Cannot rate your own agent" });
    }

    // SECURITY: Prevent duplicate ratings from the same wallet
    const { rows: existingFeedback } = await pool.query(
      "SELECT id FROM feedback WHERE agent_id = $1 AND rater = $2 LIMIT 1",
      [agentId, raterAddress]
    );
    if (existingFeedback.length > 0) {
      return res.status(409).json({ error: "You have already rated this agent. One rating per wallet per agent." });
    }

    const sanitizedAmount = Math.max(0, amountPaid || 0);
    const commentHash = comment ? require("crypto").createHash("sha256").update(comment).digest("hex") : null;
    const now = Math.floor(Date.now() / 1000);

    // Use transaction for atomicity
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // SECURITY: Prevent duplicate tx_signature (additional replay protection at DB level)
      if (txSignature) {
        const { rows: existingTx } = await client.query(
          "SELECT id FROM feedback WHERE tx_signature = $1 LIMIT 1", [txSignature]
        );
        if (existingTx.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: "Transaction signature already used for feedback" });
        }
      }

      // Insert feedback
      await client.query(
        "INSERT INTO feedback (agent_id, rater, rating, comment_hash, amount_paid, created_at, tx_signature) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [agentId, raterAddress, rating, commentHash, sanitizedAmount, now, txSignature]
      );

      // Update reputation
      const { rows: repRows } = await client.query("SELECT * FROM reputation WHERE agent_id = $1", [agentId]);
      const rep = repRows[0];
      if (rep) {
        let dist;
        try {
          dist = JSON.parse(rep.rating_distribution);
          if (!Array.isArray(dist) || dist.length !== 5) throw new Error('invalid');
        } catch {
          dist = [0, 0, 0, 0, 0];
        }
        dist[rating - 1]++;
        
        await client.query(`
          UPDATE reputation SET
            total_ratings = total_ratings + 1,
            rating_sum = rating_sum + $1,
            total_volume = total_volume + $2,
            unique_raters = unique_raters + 1,
            rating_distribution = $3,
            last_rated_at = $4
          WHERE agent_id = $5
        `, [rating, sanitizedAmount, JSON.stringify(dist), now, agentId]);
      }

      // Update protocol stats
      await client.query(
        "UPDATE protocol_stats SET total_transactions = total_transactions + 1, total_volume = total_volume + $1 WHERE id = 1",
        [sanitizedAmount]
      );

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    broadcast({ type: "feedback", agentId, rating, amountPaid: sanitizedAmount, timestamp: now });
    res.json({ success: true });
  } catch (error) {
    console.error("Feedback submission error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /agents - register agent
app.post("/agents", registrationRateLimit, [
  validateString('name', 64),
  validateString('description', 512),
  body('agentUri').optional().isURL().withMessage('Invalid agent URI'),
  body('callbackUrl').isURL({ require_tld: false }).withMessage('Callback URL is required and must be a valid URL'),
  body('services').optional().isArray({ max: 20 }).withMessage('Services must be an array (max 20)'),
  validatePubkey('owner'),
  validatePubkey('agentWallet').optional(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { name, description = "", agentUri = "", callbackUrl = "", owner, agentWallet, services = [], authMessage, authSignature } = req.body;
    
    // SECURITY: Verify ed25519 signature proving caller controls owner wallet
    if (!authSignature || !authMessage) {
      return res.status(400).json({ 
        error: "Wallet ownership proof required",
        required: { authMessage: "register-agent:<wallet>:<timestamp>", authSignature: "base58-encoded ed25519 signature" }
      });
    }
    try {
      const nacl = require('tweetnacl');
      const ownerPubkey = new (require('@solana/web3.js').PublicKey)(owner);
      const messageBytes = new TextEncoder().encode(authMessage);
      const signatureBytes = bs58.decode(authSignature);
      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, ownerPubkey.toBytes());
      if (!isValid) {
        return res.status(403).json({ error: "Invalid wallet signature — ownership proof failed" });
      }
      // Check timestamp freshness (5 min window)
      const parts = authMessage.split(':');
      const msgTimestamp = parseInt(parts[parts.length - 1]);
      if (isNaN(msgTimestamp) || Math.abs(Math.floor(Date.now() / 1000) - msgTimestamp) > 300) {
        return res.status(403).json({ error: "Signature expired — must be within 5 minutes" });
      }
    } catch (sigErr) {
      return res.status(403).json({ error: "Signature verification failed: " + sigErr.message });
    }

    // SECURITY: Validate callbackUrl against SSRF
    if (callbackUrl) {
      const urlCheck = validateCallbackUrl(callbackUrl);
      if (!urlCheck.valid) {
        return res.status(400).json({ error: `Invalid callback URL: ${urlCheck.error}` });
      }
    }

    const callbackSecret = crypto.randomBytes(32).toString("hex");
    
    const sanitizedServices = services.slice(0, 20).map(s => ({
      name: String(s.name || '').slice(0, 64),
      description: String(s.description || '').slice(0, 256),
      price: String(s.price || '').slice(0, 20),
    })).filter(s => s.name.length > 0);
    const servicesJson = JSON.stringify(sanitizedServices);

    // Check for duplicate names
    const { rows: existingRows } = await pool.query("SELECT agent_id FROM agents WHERE name = $1 AND active = 1", [name]);
    if (existingRows.length > 0) {
      return res.status(409).json({ error: "Agent name already exists" });
    }

    // Use transaction for atomicity
    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');

      const { rows: statsRows } = await client.query("SELECT * FROM protocol_stats WHERE id = 1");
      const stats = statsRows[0];
      const agentId = stats.total_agents;
      const now = Math.floor(Date.now() / 1000);

      await client.query(
        "INSERT INTO agents (agent_id, owner, agent_wallet, name, description, agent_uri, callback_url, callback_secret, services_json, active, registered_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, $11)",
        [agentId, owner, agentWallet || owner, name, description, agentUri, callbackUrl, callbackSecret, servicesJson, now, now]
      );

      await client.query("INSERT INTO reputation (agent_id) VALUES ($1)", [agentId]);

      await client.query("UPDATE protocol_stats SET total_agents = total_agents + 1 WHERE id = 1");

      await client.query('COMMIT');
      result = { agentId, name, timestamp: now };
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
    
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
], async (req, res) => {
  try {
    const agentId = req.params.id;
    const { name, description, agentUri, active } = req.body;

    const { rows: existingRows } = await pool.query("SELECT * FROM agents WHERE agent_id = $1", [agentId]);
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // SECURITY: Verify ownership via ed25519 signature
    const { owner: requestOwner, authSignature, authMessage } = req.body;
    if (!requestOwner || existing.owner !== requestOwner) {
      return res.status(403).json({ error: "Unauthorized: only the agent owner can update" });
    }
    
    if (!authSignature || !authMessage) {
      return res.status(403).json({ 
        error: "Signature required. Sign a message containing the agent ID and current timestamp with your owner wallet.",
        required: { authMessage: "update:<agentId>:<timestamp>", authSignature: "base58-encoded ed25519 signature" }
      });
    }
    
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
      if (!authMessage.includes(`update:${agentId}:`)) {
        return res.status(403).json({ error: "Signature message must contain the agent ID" });
      }
      const msgParts = authMessage.split(':');
      const msgTimestamp = parseInt(msgParts[2]);
      const now = Math.floor(Date.now() / 1000);
      if (isNaN(msgTimestamp) || Math.abs(now - msgTimestamp) > 300) {
        return res.status(403).json({ error: "Signature expired or timestamp invalid" });
      }
    } catch (sigError) {
      return res.status(403).json({ error: "Signature verification failed" });
    }

    // Extract additional updatable fields
    const { callbackUrl, services } = req.body;

    // Validate callback URL if provided
    if (callbackUrl !== undefined && callbackUrl) {
      const urlCheck = validateCallbackUrl(callbackUrl);
      if (!urlCheck.valid) {
        return res.status(400).json({ error: `Invalid callback URL: ${urlCheck.error}` });
      }
    }

    // Validate and sanitize services if provided
    let servicesJson;
    if (services !== undefined) {
      if (!Array.isArray(services)) {
        return res.status(400).json({ error: "Services must be an array" });
      }
      if (services.length > 20) {
        return res.status(400).json({ error: "Maximum 20 services allowed" });
      }
      const sanitized = services.map(s => ({
        name: String(s.name || '').slice(0, 64),
        description: String(s.description || '').slice(0, 256),
        price: String(s.price || '').slice(0, 20),
      })).filter(s => s.name.length > 0);
      for (const s of sanitized) {
        if (isNaN(parseFloat(s.price)) && s.price !== '') {
          return res.status(400).json({ error: `Invalid price for service "${s.name}"` });
        }
      }
      servicesJson = JSON.stringify(sanitized);
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (agentUri !== undefined) {
      updates.push(`agent_uri = $${paramIndex++}`);
      values.push(agentUri);
    }
    if (active !== undefined) {
      updates.push(`active = $${paramIndex++}`);
      values.push(active ? 1 : 0);
    }
    if (callbackUrl !== undefined) {
      updates.push(`callback_url = $${paramIndex++}`);
      values.push(callbackUrl || null);
    }
    if (servicesJson !== undefined) {
      updates.push(`services_json = $${paramIndex++}`);
      values.push(servicesJson);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(Math.floor(Date.now() / 1000));
    values.push(agentId);

    const updateQuery = `UPDATE agents SET ${updates.join(", ")} WHERE agent_id = $${paramIndex}`;
    await pool.query(updateQuery, values);

    res.json({ success: true, agentId: Number(agentId) });
  } catch (error) {
    console.error("Agent update error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// PUT /agents/:id/services - update agent services
app.put("/agents/:id/services", [
  validateAgentId,
  handleValidationErrors
], async (req, res) => {
  try {
    const agentId = req.params.id;
    const { owner: requestOwner, authSignature, authMessage, services } = req.body;

    const { rows: existingRows } = await pool.query("SELECT * FROM agents WHERE agent_id = $1", [agentId]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Agent not found" });

    // Verify ownership via ed25519
    if (!requestOwner || existing.owner !== requestOwner) {
      return res.status(403).json({ error: "Unauthorized: only the agent owner can update" });
    }
    if (!authSignature || !authMessage) {
      return res.status(403).json({ error: "Signature required", required: { authMessage: "update:<agentId>:<timestamp>", authSignature: "base58-encoded ed25519 signature" } });
    }
    try {
      const { PublicKey } = require('@solana/web3.js');
      const nacl = require('tweetnacl');
      const bs58 = require('bs58');
      const ownerPubkey = new PublicKey(requestOwner);
      const messageBytes = new TextEncoder().encode(authMessage);
      const signatureBytes = bs58.decode(authSignature);
      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, ownerPubkey.toBytes());
      if (!isValid) return res.status(403).json({ error: "Invalid signature" });
      if (!authMessage.includes(`update:${agentId}:`)) return res.status(403).json({ error: "Signature message must contain the agent ID" });
      const msgTimestamp = parseInt(authMessage.split(':')[2]);
      const now = Math.floor(Date.now() / 1000);
      if (isNaN(msgTimestamp) || Math.abs(now - msgTimestamp) > 300) return res.status(403).json({ error: "Signature expired or timestamp invalid" });
    } catch (sigError) {
      return res.status(403).json({ error: "Signature verification failed" });
    }

    // Validate services
    if (!Array.isArray(services)) return res.status(400).json({ error: "Services must be an array" });
    if (services.length > 20) return res.status(400).json({ error: "Maximum 20 services allowed" });

    const sanitized = services.map(s => ({
      name: String(s.name || '').slice(0, 64),
      description: String(s.description || '').slice(0, 256),
      price: String(s.price || '').slice(0, 20),
    })).filter(s => s.name.length > 0);

    for (const s of sanitized) {
      if (isNaN(parseFloat(s.price)) && s.price !== '') {
        return res.status(400).json({ error: `Invalid price for service "${s.name}"` });
      }
    }

    const now = Math.floor(Date.now() / 1000);
    await pool.query("UPDATE agents SET services_json = $1, updated_at = $2 WHERE agent_id = $3", [JSON.stringify(sanitized), now, agentId]);
    res.json({ success: true, agentId: Number(agentId), services: sanitized });
  } catch (error) {
    console.error("Services update error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// ============================================================
// ADMIN ENDPOINTS (protected by TOKEN_SECRET)
// ============================================================
app.patch("/admin/agents/:id", async (req, res) => {
  try {
    const adminToken = req.headers["x-admin-token"];
    if (!adminToken || adminToken !== process.env.TOKEN_SECRET) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const agentId = parseInt(req.params.id);
    if (isNaN(agentId) || agentId < 0) {
      return res.status(400).json({ error: "Invalid agent ID" });
    }
    
    const allowedFields = ["callback_url", "name", "description", "agent_uri", "active", "agent_wallet", "services_json"];
    const updates = [];
    const values = [];
    let paramIdx = 1;
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIdx++}`);
        values.push(req.body[field]);
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }
    
    updates.push(`updated_at = $${paramIdx++}`);
    values.push(Math.floor(Date.now() / 1000));
    values.push(agentId);
    
    const result = await pool.query(
      `UPDATE agents SET ${updates.join(", ")} WHERE agent_id = $${paramIdx} RETURNING agent_id, name, callback_url`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }
    
    res.json({ success: true, agent: result.rows[0] });
  } catch (error) {
    console.error("Admin update error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// Health
app.get("/health", (_, res) => res.json({ status: "ok" }));

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));
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

// SECURITY: Connection timeouts
server.timeout = 30000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
server.maxHeadersCount = 50;

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  clearInterval(wsHeartbeat);
  wss.close();
  server.close();
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  clearInterval(wsHeartbeat);
  wss.close();
  server.close();
  await pool.end();
  process.exit(0);
});

const PORT = process.env.PORT || 3000;

// Initialize database then start server
initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Agent Bazaar API running on port ${PORT}`);
    console.log(`WebSocket server on ws://localhost:${PORT}/ws`);
  });
}).catch(err => {
  console.error("❌ Failed to initialize database:", err);
  process.exit(1);
});
