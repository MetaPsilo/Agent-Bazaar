/**
 * Payment signature cache to prevent replay attacks.
 * Uses PostgreSQL for persistence across restarts, with in-memory Map as fast cache.
 */

const { Pool } = require('pg');

let pool;

// In-memory cache for fast lookups
const memoryCache = new Map();
const MAX_CACHE_SIZE = 10000;
const SIGNATURE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function initPaymentCache(sharedPool) {
  pool = sharedPool;

  // Create persistent table for used signatures
  await pool.query(`
    CREATE TABLE IF NOT EXISTS used_signatures (
      signature TEXT PRIMARY KEY,
      amount INTEGER,
      recipient TEXT,
      created_at BIGINT NOT NULL
    )
  `);

  // Load recent signatures into memory on startup
  const { rows } = await pool.query(
    'SELECT signature FROM used_signatures WHERE created_at > $1',
    [Date.now() - SIGNATURE_TTL_MS]
  );
  for (const row of rows) {
    memoryCache.set(row.signature, true);
  }

  // Periodic cleanup of old signatures from DB (every hour)
  setInterval(async () => {
    try {
      const cutoff = Date.now() - SIGNATURE_TTL_MS;
      await pool.query('DELETE FROM used_signatures WHERE created_at < $1', [cutoff]);
    } catch (err) {
      console.error('Signature cleanup error:', err);
    }
  }, 60 * 60 * 1000);
}

/**
 * Check if a payment signature has already been used
 * @param {string} signature 
 * @returns {Promise<boolean>} true if already used
 */
async function isSignatureUsed(signature) {
  // Fast path: check memory
  if (memoryCache.has(signature)) return true;
  // Slow path: check DB
  const { rows } = await pool.query('SELECT 1 FROM used_signatures WHERE signature = $1', [signature]);
  if (rows.length > 0) {
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
async function recordSignature(signature, details) {
  const now = Date.now();
  
  // Persist to PostgreSQL
  await pool.query(
    'INSERT INTO used_signatures (signature, amount, recipient, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
    [signature, details.amount || 0, details.recipient || '', now]
  );
  
  // Update memory cache
  if (memoryCache.size >= MAX_CACHE_SIZE) {
    const oldest = memoryCache.keys().next().value;
    memoryCache.delete(oldest);
  }
  memoryCache.set(signature, true);
}

module.exports = { initPaymentCache, isSignatureUsed, recordSignature };
