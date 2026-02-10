require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// SQLite setup
const dbPath = path.join(__dirname, "bazaar.db");
const db = new Database(dbPath);

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

// WebSocket setup
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const wsClients = new Set();

wss.on("connection", (ws) => {
  wsClients.add(ws);
  ws.on("close", () => wsClients.delete(ws));
});

function broadcast(event) {
  const data = JSON.stringify(event);
  for (const client of wsClients) {
    if (client.readyState === 1) client.send(data);
  }
}

// Routes

// GET /agents - list/search agents
app.get("/agents", (req, res) => {
  const { category, minRating, sort = "rating", limit = 20, offset = 0, q } = req.query;
  
  let query = `
    SELECT a.*, r.total_ratings, r.rating_sum, r.total_volume, r.rating_distribution,
           CASE WHEN r.total_ratings > 0 THEN CAST(r.rating_sum AS REAL) / r.total_ratings ELSE 0 END as avg_rating
    FROM agents a
    LEFT JOIN reputation r ON a.agent_id = r.agent_id
    WHERE a.active = 1
  `;
  const params = [];

  if (q) {
    query += ` AND (a.name LIKE ? OR a.description LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }
  if (minRating) {
    query += ` AND (CASE WHEN r.total_ratings > 0 THEN CAST(r.rating_sum AS REAL) / r.total_ratings ELSE 0 END) >= ?`;
    params.push(Number(minRating));
  }

  const sortMap = {
    rating: "avg_rating DESC",
    transactions: "r.total_ratings DESC",
    volume: "r.total_volume DESC",
    newest: "a.registered_at DESC",
  };
  query += ` ORDER BY ${sortMap[sort] || "avg_rating DESC"}`;
  query += ` LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const agents = db.prepare(query).all(...params);
  const total = db.prepare("SELECT COUNT(*) as c FROM agents WHERE active = 1").get().c;

  res.json({ agents, total, offset: Number(offset), limit: Number(limit) });
});

// GET /agents/:id
app.get("/agents/:id", (req, res) => {
  const agent = db.prepare(`
    SELECT a.*, r.total_ratings, r.rating_sum, r.total_volume, r.unique_raters, r.rating_distribution,
           CASE WHEN r.total_ratings > 0 THEN CAST(r.rating_sum AS REAL) / r.total_ratings ELSE 0 END as avg_rating
    FROM agents a
    LEFT JOIN reputation r ON a.agent_id = r.agent_id
    WHERE a.agent_id = ?
  `).get(req.params.id);

  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json(agent);
});

// GET /agents/:id/feedback
app.get("/agents/:id/feedback", (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const feedbacks = db.prepare(
    "SELECT * FROM feedback WHERE agent_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).all(req.params.id, Number(limit), Number(offset));
  res.json(feedbacks);
});

// GET /stats
app.get("/stats", (req, res) => {
  const stats = db.prepare("SELECT * FROM protocol_stats WHERE id = 1").get();
  const activeAgents = db.prepare("SELECT COUNT(*) as c FROM agents WHERE active = 1").get().c;
  res.json({ ...stats, activeAgents });
});

// GET /leaderboard
app.get("/leaderboard", (req, res) => {
  const { metric = "rating", limit = 20 } = req.query;
  const sortMap = {
    rating: "avg_rating DESC",
    transactions: "r.total_ratings DESC",
    volume: "r.total_volume DESC",
  };
  const agents = db.prepare(`
    SELECT a.*, r.total_ratings, r.rating_sum, r.total_volume, r.rating_distribution,
           CASE WHEN r.total_ratings > 0 THEN CAST(r.rating_sum AS REAL) / r.total_ratings ELSE 0 END as avg_rating
    FROM agents a
    LEFT JOIN reputation r ON a.agent_id = r.agent_id
    WHERE a.active = 1
    ORDER BY ${sortMap[metric] || "avg_rating DESC"}
    LIMIT ?
  `).all(Number(limit));
  res.json(agents);
});

// POST /feedback - submit feedback (simplified, stores in DB)
app.post("/feedback", (req, res) => {
  const { agentId, rating, comment, txSignature, amountPaid } = req.body;
  if (!agentId === undefined || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Invalid feedback" });
  }

  const commentHash = comment ? require("crypto").createHash("sha256").update(comment).digest("hex") : null;
  const now = Math.floor(Date.now() / 1000);

  db.prepare(
    "INSERT INTO feedback (agent_id, rater, rating, comment_hash, amount_paid, created_at, tx_signature) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(agentId, "api-user", rating, commentHash, amountPaid || 0, now, txSignature || null);

  // Update reputation
  const rep = db.prepare("SELECT * FROM reputation WHERE agent_id = ?").get(agentId);
  if (rep) {
    const dist = JSON.parse(rep.rating_distribution);
    dist[rating - 1]++;
    db.prepare(`
      UPDATE reputation SET
        total_ratings = total_ratings + 1,
        rating_sum = rating_sum + ?,
        total_volume = total_volume + ?,
        unique_raters = unique_raters + 1,
        rating_distribution = ?,
        last_rated_at = ?
      WHERE agent_id = ?
    `).run(rating, amountPaid || 0, JSON.stringify(dist), now, agentId);
  }

  // Update protocol stats
  db.prepare("UPDATE protocol_stats SET total_transactions = total_transactions + 1, total_volume = total_volume + ? WHERE id = 1").run(amountPaid || 0);

  broadcast({ type: "feedback", agentId, rating, amountPaid, timestamp: now });
  res.json({ success: true });
});

// POST /agents - register agent via API (stores in DB, for demo)
app.post("/agents", (req, res) => {
  const { name, description, agentUri, owner, agentWallet } = req.body;
  if (!name || !owner) return res.status(400).json({ error: "name and owner required" });

  const stats = db.prepare("SELECT * FROM protocol_stats WHERE id = 1").get();
  const agentId = stats.total_agents;
  const now = Math.floor(Date.now() / 1000);

  db.prepare(
    "INSERT INTO agents (agent_id, owner, agent_wallet, name, description, agent_uri, active, registered_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)"
  ).run(agentId, owner, agentWallet || owner, name, description || "", agentUri || "", now, now);

  db.prepare(
    "INSERT INTO reputation (agent_id) VALUES (?)"
  ).run(agentId);

  db.prepare("UPDATE protocol_stats SET total_agents = total_agents + 1 WHERE id = 1").run();

  broadcast({ type: "registration", agentId, name, timestamp: now });
  res.json({ agentId, success: true });
});

// Health
app.get("/health", (_, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Agent Bazaar API running on port ${PORT}`);
  console.log(`WebSocket server on ws://localhost:${PORT}/ws`);
});
