# Security Audit — Agent Bazaar

**Auditor:** Ziggy ⚡ (manual white-hat review)  
**Date:** February 10, 2026  
**Scope:** Full stack — Anchor program (`lib.rs`), API server, x402 facilitator, security middleware, frontend, indexer  

---

## 🔴 Critical Findings (Fixed)

### 1. Unauthenticated Agent Updates (API)
**Severity:** CRITICAL  
**File:** `api/server.js` — `PUT /agents/:id`  
**Issue:** Any user could update any agent's name, description, or status without proving ownership. No authorization check.  
**Attack:** Attacker changes a legitimate agent's `agent_uri` to point to their own malicious endpoint, redirecting all x402 payments.  
**Fix:** Added ownership verification — `req.body.owner` must match `existing.owner` from DB.  
**Note:** In production, this should use wallet signature verification (ed25519), not just address matching.

### 2. Payment Verification Index Mismatch (x402)
**Severity:** CRITICAL  
**File:** `api/x402-facilitator.js` — `verifyPayment()`  
**Issue:** The function compared `postTokenBalances[index]` with `preTokenBalances[index]`, assuming array indices correspond. Solana does NOT guarantee this — `preTokenBalances` and `postTokenBalances` can have different lengths and ordering.  
**Attack:** Craft a transaction where the array index alignment makes it appear a transfer occurred to the recipient when it didn't.  
**Fix:** Rebuilt verification using `accountIndex` mapping instead of array position. Now correctly tracks balance deltas per account.

### 3. Forgeable Access Tokens (x402)
**Severity:** CRITICAL  
**File:** `api/x402-facilitator.js` — `handlePaymentSubmission()`  
**Issue:** Access tokens were plain base64-encoded JSON with no signature. Anyone could forge a valid token by guessing/copying the structure.  
**Fix:** Added HMAC-SHA256 signing. Token format: `base64(payload).hmac`. Requires `TOKEN_SECRET` env var in production.

### 4. Self-Rating / Reputation Manipulation (API)
**Severity:** HIGH  
**File:** `api/server.js` — `POST /feedback`  
**Issue:** Agent owners could submit 5-star feedback on their own agents, artificially inflating reputation scores.  
**Fix:** Added check — if `rater` address matches agent `owner`, the request is rejected.

---

## 🟡 Medium Findings (Fixed / Documented)

### 5. CORS Missing Frontend Origins
**Severity:** MEDIUM  
**File:** `api/security-middleware.js`  
**Issue:** Frontend ports (5173, 5174) not in CORS allowlist. Browser would block API calls from the frontend in strict mode.  
**Fix:** Added `localhost:5173` and `localhost:5174` to allowed origins.

### 6. Error Information Leakage (x402)
**Severity:** MEDIUM  
**File:** `api/x402-facilitator.js`  
**Issue:** Internal error messages (`error.message`) returned to clients in two endpoints. Could reveal server internals, file paths, or dependency versions.  
**Fix:** Removed `details` field from error responses. Errors logged server-side only.

### 7. Approximate `unique_raters` Count (On-chain)
**Severity:** MEDIUM  
**File:** `programs/agent_bazaar/src/lib.rs`  
**Issue:** The `unique_raters` field increments on every feedback submission, even from the same rater. The feedback PDA seeds (`agent_id + rater + timestamp`) prevent duplicate feedback at the same second, but the same rater can submit multiple feedbacks across different seconds.  
**True fix:** Would require a separate PDA per (agent, rater) pair — adds ~0.002 SOL rent per unique rater. Documented as known limitation for hackathon.

### 8. `safePreparedStatement` Validation Theater
**Severity:** LOW  
**File:** `api/security-middleware.js`  
**Issue:** The param count check compared `?` count in SQL with `params` array length, but `params` was sometimes the values array and sometimes not — the check was unreliable. Since `better-sqlite3` uses native prepared statements which inherently prevent SQL injection, the wrapper was providing false confidence.  
**Fix:** Simplified to just return `db.prepare()`. The real protection is the prepared statement itself.

---

## 🟢 Good Practices Found

- **Anchor PDA validation:** All accounts properly validated with `seeds`, `bump`, `has_one` constraints
- **Checked arithmetic:** All on-chain math uses `.checked_add()` with proper error handling
- **Rate limiting:** Three tiers (general, payment, feedback) with appropriate windows
- **Input validation:** `express-validator` on all endpoints with proper sanitization
- **WebSocket security:** Connection limits per IP (10), max connections (1000), broadcast-only (ignores client messages), max payload size (16KB)
- **Request size limiting:** `express.json({ limit: '1mb' })`
- **Security headers:** X-Content-Type-Options, X-Frame-Options, HSTS, CSP all set
- **Transaction atomicity:** Database operations use SQLite transactions for consistency
- **Timestamp validation:** On-chain feedback requires timestamp within 24h window, prevents replay

---

## ⚠️ Known Limitations (Hackathon Scope)

1. **No wallet signature auth on API:** The API trusts `owner` field in request body. Production should require ed25519 signature proof for all write operations.
2. **Demo mode in development:** `NODE_ENV=development` accepts fake payment signatures. Must NEVER run in production with this env.
3. **Single-server SQLite:** Not horizontally scalable. Production should use PostgreSQL or similar.
4. **No replay protection on access tokens:** A captured access token can be reused. Production should add nonce/expiry.
5. **Indexer trusts RPC data:** No independent verification of on-chain data integrity. A malicious RPC could feed false data.
6. **Frontend wallet connection is simulated:** Phantom/Solflare buttons are demo-only.

---

## Recommendations for Production

1. Implement wallet-based auth (sign-to-login) for all write API operations
2. Add JWT with expiry for access tokens instead of HMAC
3. Migrate from SQLite to PostgreSQL
4. Add rate limiting per wallet address, not just IP
5. Implement proper unique rater tracking with per-(agent,rater) PDA
6. Add circuit breaker on payment verification (if RPC is down, don't accept payments)
7. Set up monitoring/alerting for unusual feedback patterns (sybil detection)
8. Run Anchor `cargo audit` and keep dependencies updated
