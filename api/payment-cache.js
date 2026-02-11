/**
 * Payment signature cache to prevent replay attacks.
 * Uses SQLite for persistence across restarts, with in-memory Map as fast cache.
 */

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'bazaar.db'));

// Create persistent table for used signatures
db.exec(`
  CREATE TABLE IF NOT EXISTS used_signatures (
    signature TEXT PRIMARY KEY,
    amount INTEGER,
    recipient TEXT,
    created_at INTEGER NOT NULL
  )
`);

// In-memory cache for fast lookups
const memoryCache = new Map();
const MAX_CACHE_SIZE = 10000;
const SIGNATURE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Load recent signatures into memory on startup
const recentSigs = db.prepare(
  'SELECT signature FROM used_signatures WHERE created_at > ?'
).all(Date.now() - SIGNATURE_TTL_MS);
for (const row of recentSigs) {
  memoryCache.set(row.signature, true);
}

/**
 * Check if a payment signature has already been used
 * @param {string} signature 
 * @returns {boolean} true if already used
 */
function isSignatureUsed(signature) {
  // Fast path: check memory
  if (memoryCache.has(signature)) return true;
  // Slow path: check DB
  const row = db.prepare('SELECT 1 FROM used_signatures WHERE signature = ?').get(signature);
  if (row) {
    memoryCache.set(signature, true);
    return true;
  }
  return false;
}

/**
 * Record a payment signature as used
 * @param {string} signature 
 * @param {object} details 
 */
function recordSignature(signature, details) {
  const now = Date.now();
  
  // Persist to SQLite
  db.prepare(
    'INSERT OR IGNORE INTO used_signatures (signature, amount, recipient, created_at) VALUES (?, ?, ?, ?)'
  ).run(signature, details.amount || 0, details.recipient || '', now);
  
  // Update memory cache
  if (memoryCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest from memory (DB retains all)
    const oldest = memoryCache.keys().next().value;
    memoryCache.delete(oldest);
  }
  memoryCache.set(signature, true);
}

// Periodic cleanup of old signatures from DB (every hour)
setInterval(() => {
  const cutoff = Date.now() - SIGNATURE_TTL_MS;
  db.prepare('DELETE FROM used_signatures WHERE created_at < ?').run(cutoff);
}, 60 * 60 * 1000);

module.exports = { isSignatureUsed, recordSignature };
