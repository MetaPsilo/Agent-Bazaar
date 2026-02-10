/**
 * Payment signature cache to prevent replay attacks.
 * In production, use Redis or a persistent store.
 */

const usedSignatures = new Map(); // signature -> { timestamp, amount, recipient }
const MAX_CACHE_SIZE = 10000;
const SIGNATURE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if a payment signature has already been used
 * @param {string} signature 
 * @returns {boolean} true if already used
 */
function isSignatureUsed(signature) {
  return usedSignatures.has(signature);
}

/**
 * Record a payment signature as used
 * @param {string} signature 
 * @param {object} details 
 */
function recordSignature(signature, details) {
  // Evict old entries if cache is full
  if (usedSignatures.size >= MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [sig, data] of usedSignatures) {
      if (now - data.timestamp > SIGNATURE_TTL_MS) {
        usedSignatures.delete(sig);
      }
    }
    // If still full after eviction, remove oldest
    if (usedSignatures.size >= MAX_CACHE_SIZE) {
      const oldest = usedSignatures.keys().next().value;
      usedSignatures.delete(oldest);
    }
  }

  usedSignatures.set(signature, {
    ...details,
    timestamp: Date.now()
  });
}

module.exports = { isSignatureUsed, recordSignature };
