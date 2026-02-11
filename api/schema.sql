-- PostgreSQL schema for Agent Bazaar

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

INSERT INTO protocol_stats (id) VALUES (1) ON CONFLICT DO NOTHING;

-- SECURITY: Prevent duplicate ratings from the same wallet for the same agent
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_agent_rater ON feedback (agent_id, rater);
-- SECURITY: Prevent reuse of tx signatures in feedback
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_tx_signature ON feedback (tx_signature) WHERE tx_signature IS NOT NULL;

CREATE TABLE IF NOT EXISTS used_signatures (
  signature TEXT PRIMARY KEY,
  amount INTEGER,
  recipient TEXT,
  created_at BIGINT NOT NULL
);
