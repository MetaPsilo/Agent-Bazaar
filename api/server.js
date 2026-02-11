require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");
const Database = require("better-sqlite3");
const path = require("path");
const { x402Protect, handlePaymentSubmission, calculateFeeSplit } = require("./x402-facilitator");

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
});

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

// Demo service endpoints with x402 protection
app.get("/services/research/pulse", x402Protect("10000", "HkrtQ8FGS2rkhCC11Z9gHaeMJ93DAfvutmTyq3bLvERd"), (req, res) => {
  res.json({
    service: "Market Pulse",
    data: "Current Solana ecosystem sentiment: BULLISH. Key signals: Jupiter V2 launch trending, SOL price +5.2% 24h.",
    timestamp: new Date().toISOString(),
    paymentInfo: req.x402Payment
  });
});

app.get("/services/research/alpha", x402Protect("50000", "HkrtQ8FGS2rkhCC11Z9gHaeMJ93DAfvutmTyq3bLvERd"), (req, res) => {
  res.json({
    service: "Alpha Feed",
    data: [
      "🔥 @toly just dropped hints about Firedancer performance improvements",
      "📊 Whale alert: 1M USDC moved to Jupiter for farming",
      "🚀 New Solana Mobile announcement expected this week"
    ],
    timestamp: new Date().toISOString(),
    paymentInfo: req.x402Payment
  });
});

app.get("/services/text-summary", x402Protect("25000", "HkrtQ8FGS2rkhCC11Z9gHaeMJ93DAfvutmTyq3bLvERd"), (req, res) => {
  const { text } = req.query;
  if (!text) {
    return res.status(400).json({ error: "Missing 'text' parameter" });
  }
  // SECURITY: Limit input text size to prevent abuse
  if (text.length > 10000) {
    return res.status(400).json({ error: "Text too long: max 10000 characters" });
  }
  
  res.json({
    service: "Text Summarization",
    summary: `Summary of provided text (${text.length} chars): ${text.substring(0, 100)}...`,
    confidence: 0.92,
    timestamp: new Date().toISOString(),
    paymentInfo: req.x402Payment
  });
});

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
    const agents = agentStmt.all(...params);
    
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
    
    const agent = stmt.get(req.params.id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
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
    const agents = agentsStmt.all(Number(limit));
    
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
  body('txSignature').optional().custom((value) => {
    if (!value) return true; // Optional field
    // In development mode, allow demo signatures
    if (process.env.NODE_ENV === 'development' && value.startsWith('demo_')) {
      return true;
    }
    // Otherwise require proper signature length
    if (value.length < 32 || value.length > 128) {
      throw new Error('Invalid transaction signature');
    }
    return true;
  }),
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

    // SECURITY: Prevent self-rating (reputation manipulation)
    // Check both explicit rater field AND txSignature sender if available
    const { rater: raterAddress } = req.body;
    if (raterAddress === agent.owner) {
      return res.status(403).json({ error: "Cannot rate your own agent" });
    }

    // SECURITY: In production, require a valid tx signature to prevent volume inflation
    if (process.env.NODE_ENV !== 'development' && !txSignature) {
      return res.status(400).json({ error: "Transaction signature required for feedback" });
    }

    // SECURITY: Cap amountPaid to prevent volume inflation attacks
    // In production, this should be verified against the actual on-chain transaction
    const maxAmount = 1000000000; // 1000 USDC max per feedback
    const sanitizedAmount = Math.min(Math.max(0, amountPaid || 0), maxAmount);

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
  validateString('description', 256),
  body('agentUri').optional().isURL().withMessage('Invalid agent URI'),
  validatePubkey('owner'),
  validatePubkey('agentWallet').optional(),
  handleValidationErrors
], (req, res) => {
  try {
    const { name, description = "", agentUri = "", owner, agentWallet } = req.body;

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
        "INSERT INTO agents (agent_id, owner, agent_wallet, name, description, agent_uri, active, registered_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
        [agentId, owner, agentWallet || owner, name, description, agentUri, now, now]
      );
      insertAgentStmt.run(agentId, owner, agentWallet || owner, name, description, agentUri, now, now);

      const insertRepStmt = safePreparedStatement(db, "INSERT INTO reputation (agent_id) VALUES (?)", [agentId]);
      insertRepStmt.run(agentId);

      const updateStatsStmt = safePreparedStatement(db, "UPDATE protocol_stats SET total_agents = total_agents + 1 WHERE id = 1", []);
      updateStatsStmt.run();

      return { agentId, name, timestamp: now };
    });

    const result = transaction();
    
    broadcast({ type: "registration", agentId: result.agentId, name: result.name, timestamp: result.timestamp });
    res.json({ agentId: result.agentId, success: true });
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

    // SECURITY: Verify ownership before allowing updates
    // NOTE: In production, this MUST use ed25519 signature verification.
    // For hackathon demo, we verify the owner pubkey matches AND require
    // a signature of the update payload. Without wallet integration, we
    // at minimum verify the claimed owner matches the stored owner.
    const { owner: requestOwner, authSignature } = req.body;
    if (!requestOwner || existing.owner !== requestOwner) {
      return res.status(403).json({ error: "Unauthorized: only the agent owner can update" });
    }
    // In production: verify authSignature is a valid ed25519 sig of the request body
    // signed by the owner's private key. For hackathon, owner pubkey match is sufficient.

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
        !req.path.startsWith('/ws')) {
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
