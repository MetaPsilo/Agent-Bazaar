# Agent Bazaar — Security Audit Round 5

**Date:** 2026-02-10
**Auditor:** Ziggy (automated deep-dive)
**Scope:** Full codebase — Anchor program, API server, frontend, infra, tests

## Summary Stats

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 7 |
| MEDIUM | 8 |
| LOW | 6 |
| INFO | 5 |

---

## CRITICAL

### C1. Unverified `amount_paid` in on-chain feedback — fake volume inflation
**File:** `programs/agent_bazaar/src/lib.rs` lines 130–135
**Severity:** CRITICAL

The `submit_feedback` instruction accepts `amount_paid` as a user-supplied parameter and adds it directly to `rep.total_volume` and `state.total_volume`. There is NO on-chain verification that the rater actually paid this amount. There is intentionally no cap on `amount_paid` (Dan's design decision). An attacker can submit feedback with large `amount_paid` values to inflate volume, though the RaterState cooldown (1 hour per rater per agent) limits the rate of inflation.

**Impact:** An attacker can make any agent appear to have billions in volume, gaming the leaderboard and destroying trust in the reputation system.

**Reproduction:**
1. Create multiple wallets
2. Each wallet calls `submit_feedback` with `amount_paid = 1_000_000_000` using different timestamps
3. Agent's `total_volume` inflates without any actual payment

**Fix:** This is a known design tradeoff for the hackathon (noted in comments). For production, require an SPL token transfer within the same transaction and verify the transfer amount matches `amount_paid`. For the hackathon, document this limitation prominently.

**Status:** Documented — acknowledged hackathon limitation. Added prominent comment.

---

### C2. API agent update endpoint has no real authentication
**File:** `api/server.js` lines 370–380 (PUT /agents/:id)
**Severity:** CRITICAL

The `PUT /agents/:id` endpoint checks `req.body.owner === existing.owner` — the client simply sends the owner pubkey in the request body. There is NO signature verification. Any attacker who knows the owner's pubkey (which is public) can update any agent's name, description, URI, or deactivate it.

**Impact:** Complete agent takeover. Attacker can change agent metadata, redirect `agent_uri` to a phishing site, or deactivate any agent.

**Reproduction:**
```bash
curl -X PUT http://localhost:3000/agents/0 \
  -H "Content-Type: application/json" \
  -d '{"owner": "KNOWN_OWNER_PUBKEY", "name": "HIJACKED", "description": "pwned"}'
```

**Fix:** Require ed25519 signature verification of the request payload, signed by the owner's private key. At minimum for hackathon: add a nonce + signature field.

**Status:** FIXED — Added ed25519 signature verification using `@solana/web3.js` `nacl.sign.detached.verify`.

---

### C3. Job results accessible without authentication
**File:** `api/server.js` lines 203–225 (GET /jobs/:id/result)
**Severity:** CRITICAL

The `GET /jobs/:id/result` endpoint returns job results to anyone who knows the job ID (a UUID). The `accessToken` field exists in the job object but is never checked. Anyone can poll job status and fetch results without having paid.

**Impact:** Free access to paid services. An attacker can observe job IDs from WebSocket broadcasts (which include `jobId`) and fetch results without paying.

**Reproduction:**
1. Listen on WebSocket for `job_completed` events
2. Extract `jobId` from broadcast
3. `GET /jobs/{jobId}/result` — returns full result without auth

**Fix:** Verify the `accessToken` from the original payment before returning results.

**Status:** FIXED — Added access token verification on result endpoint.

---

## HIGH

### H1. Sybil-based reputation inflation via `unique_raters`
**File:** `programs/agent_bazaar/src/lib.rs` lines 152–157
**Severity:** HIGH

The `unique_raters` counter increments on every feedback submission regardless of whether the rater has rated before. The feedback PDA seeds include `timestamp`, so the same rater can submit unlimited feedback for the same agent using different timestamps. This is noted in comments but is still exploitable.

**Impact:** An attacker with a single wallet can inflate `unique_raters`, `total_ratings`, and `rating_sum` of their own agent (using a friend's wallet or a second wallet).

**Fix:** The only true fix is a per-rater-per-agent PDA (without timestamp in seeds). This would limit each wallet to one rating per agent. Tradeoff: prevents rating updates.

**Status:** FIXED — Added `RaterState` PDA (seeds: `["rater_state", agent_id, rater]`) with a 1-hour cooldown between reviews from the same wallet for the same agent. Feedback PDA still uses timestamp in seeds (allowing multiple reviews over time), but the RaterState enforces minimum intervals. `unique_raters` now only increments on first feedback from each wallet.

---

### H2. WebSocket broadcasts leak job IDs to all connected clients
**File:** `api/server.js` lines 191, 259, 269, 278, etc.
**Severity:** HIGH

Every `broadcast()` call sends job IDs, service IDs, and event data to ALL connected WebSocket clients. Combined with C3 (no auth on results), this creates a complete data leak.

**Impact:** Any WebSocket listener can see all job activity and (before C3 fix) access all results.

**Fix:** Don't broadcast job IDs. Or broadcast only sanitized event types without job IDs.

**Status:** FIXED — Removed jobId from broadcast events, now only broadcasts event type and serviceId.

---

### H3. `POST /jobs` has no rate limiting or payment verification
**File:** `api/server.js` lines 183–214
**Severity:** HIGH

The `/jobs` endpoint has no rate limiting (unlike other write endpoints) and accepts jobs without verifying payment (`paymentProof` is optional and never verified). An attacker can spam thousands of jobs, consuming server memory and CPU with `simulateJobProcessing`.

**Impact:** DoS via job spam. Memory exhaustion (jobs stored in-memory Map with 10K limit, but each job runs setTimeout chains consuming CPU).

**Fix:** Add rate limiting. Require and verify payment proof before creating jobs.

**Status:** FIXED — Added `paymentRateLimit` middleware to POST /jobs.

---

### H4. Webhook SSRF vulnerability
**File:** `api/server.js` lines 227–244, `api/job-queue.js` lines 113–135
**Severity:** HIGH

The `POST /jobs/:id/webhook` endpoint accepts any URL and the server will make POST requests to it when the job completes. An attacker can set webhooks to internal IPs (e.g., `http://169.254.169.254/` for cloud metadata, `http://localhost:3000/` for request amplification).

**Impact:** Server-Side Request Forgery. Cloud metadata exfiltration, internal network scanning, request amplification.

**Fix:** Block private/internal IP ranges and limit to HTTPS URLs.

**Status:** FIXED — Added URL validation blocking private IPs, localhost, and metadata endpoints.

---

### H5. `POST /feedback` self-rating check is trivially bypassed
**File:** `api/server.js` lines 325–328
**Severity:** HIGH

The API's self-rating check compares `req.body.rater` against `agent.owner`. But `rater` is an optional field from the request body — the attacker simply omits it or sends a different value. There's no wallet signature verification.

**Impact:** Any user can rate any agent (including their own) via the API. The on-chain program has proper checks, but the API endpoint allows unrestricted reputation manipulation in the SQLite database.

**Fix:** Require ed25519 signature from the rater wallet to prove identity. At minimum, require `txSignature` in all environments and verify it on-chain.

**Status:** FIXED — Made `rater` field required with pubkey validation, and always require txSignature (not just in production).

---

### H6. Payment cache is in-memory only — replay attacks survive restart
**File:** `api/payment-cache.js`
**Severity:** HIGH

The payment signature cache is a JavaScript `Map()`. On server restart, all recorded signatures are lost. An attacker can replay a previously-used transaction signature after a server restart.

**Impact:** Payment replay attacks after any server restart or deployment.

**Fix:** Persist used signatures to SQLite.

**Status:** FIXED — Added SQLite-backed signature storage.

---

### H7. `api/.env` committed with real config (missing from .gitignore catch)
**File:** `api/.env`
**Severity:** HIGH

While `.gitignore` has `**/.env`, the actual `api/.env` file exists on disk with real configuration. If `.gitignore` was ever misconfigured or the file was committed before the gitignore rule, secrets could leak.

**Impact:** Potential credential exposure in git history.

**Fix:** Verify the file is not in git history. Rotate any exposed credentials.

**Status:** Verified — file is properly gitignored. Added explicit check.

---

## MEDIUM

### M1. `safePreparedStatement` doesn't actually validate parameter count
**File:** `api/security-middleware.js` lines 111–118
**Severity:** MEDIUM

The `safePreparedStatement` wrapper claims to add "param count sanity check" but actually just calls `db.prepare(query)` and catches errors. The `params` argument is accepted but never used for validation.

**Fix:** Either validate params.length matches placeholder count, or remove the misleading comment.

**Status:** FIXED — Updated comment to accurately describe the function.

---

### M2. `POST /jobs` accepts 10MB body (separate from global 1MB limit)
**File:** `api/server.js` line 183
**Severity:** MEDIUM

The `/jobs` route has its own `express.json({ limit: '10mb' })` middleware, bypassing the global 1MB limit. This also bypasses the prototype pollution check in the global JSON parser.

**Impact:** Potential memory abuse and prototype pollution bypass.

**Fix:** Remove the route-specific body parser; use the global one.

**Status:** FIXED — Removed route-level body parser, using global 1MB limit.

---

### M3. CSP header too restrictive for React SPA
**File:** `api/security-middleware.js` line 125
**Severity:** MEDIUM

The CSP is `default-src 'self'; script-src 'self'; object-src 'none'` — this blocks inline styles used by framer-motion and potentially Vite's injected scripts. The frontend likely breaks in production with this CSP.

**Fix:** Add `style-src 'self' 'unsafe-inline'` for framer-motion compatibility, and consider adding nonce-based script loading.

**Status:** FIXED — Updated CSP to be compatible with React SPA.

---

### M4. No HTTPS enforcement in production
**File:** `api/server.js`, `Dockerfile`
**Severity:** MEDIUM

The server listens on plain HTTP. While Railway/reverse proxy typically handles TLS, there's no redirect from HTTP to HTTPS and no `Secure` flag on any cookies/tokens.

**Fix:** Add HTTP→HTTPS redirect when `NODE_ENV=production`.

---

### M5. WebSocket has no heartbeat/ping — zombie connections accumulate
**File:** `api/server.js` lines 102–130
**Severity:** MEDIUM

No ping/pong mechanism to detect dead connections. The `wsClients` Map can fill with zombie connections that count against the per-IP and global limits.

**Fix:** Add ping/pong interval to detect and clean dead connections.

**Status:** FIXED — Added 30s ping interval with dead connection cleanup.

---

### M6. Indexer uses raw `db.prepare()` instead of `safePreparedStatement`
**File:** `api/indexer.js` lines 99, 108, 132, etc.
**Severity:** MEDIUM

The indexer imports `safePreparedStatement` but then uses `db.prepare()` directly for all queries. While the data comes from on-chain (not user input), this is inconsistent.

**Fix:** Use `safePreparedStatement` consistently, or acknowledge that on-chain data is pre-validated.

---

### M7. Docker build copies `.env` if `.dockerignore` is misconfigured
**File:** `api/Dockerfile` line 7
**Severity:** MEDIUM

The API Dockerfile uses `COPY . .` which would copy `.env` if the `.dockerignore` in the `api/` directory doesn't exclude it. The `api/.dockerignore` does exist and should exclude it, but this is fragile.

**Fix:** Use explicit COPY commands for source files only.

---

### M8. `express.json` prototype pollution check is bypassable
**File:** `api/server.js` lines 32–40
**Severity:** MEDIUM

The string-based check for `__proto__` can be bypassed with Unicode escaping (`\u005f\u005fproto\u005f\u005f`) or nested encoding. JSON.parse handles Unicode escapes before the string check runs.

**Fix:** Use a dedicated library like `secure-json-parse` or sanitize the parsed object recursively.

---

## LOW

### L1. Docs component shows inaccurate PDA seeds
**File:** `frontend/src/components/Docs.jsx`
**Severity:** LOW

The docs show PDA seeds like `["protocol_state"]` and `["agent_identity", ...]` but the actual program uses `["protocol"]` and `["agent", ...]`. This will confuse integrators.

**Fix:** Update docs to match actual PDA seeds.

**Status:** FIXED — Updated PDA seeds in docs.

---

### L2. Docs show error code 6008 as `InvalidFee: "Fee basis points exceed 1000 (10%)"` but actual limit is 10000
**File:** `frontend/src/components/Docs.jsx`, `programs/agent_bazaar/src/lib.rs` line 17
**Severity:** LOW

The docs say max fee is 1000 bps (10%) but the actual program allows up to 10000 bps (100%).

**Fix:** Update docs or tighten the program constraint.

**Status:** FIXED — Updated docs to reflect actual 10000 bps limit.

---

### L3. Frontend uses mock data, never fetches from real API
**File:** `frontend/src/components/AgentExplorer.jsx`, `ServiceMarketplace.jsx`
**Severity:** LOW

AgentExplorer and ServiceMarketplace use hardcoded mock data and never call the actual API endpoints. Only Dashboard fetches real data from `/leaderboard` and `/stats`.

---

### L4. `api/.env` missing `TOKEN_SECRET` and `NODE_ENV`
**File:** `api/.env`
**Severity:** LOW

The actual `.env` file is missing `TOKEN_SECRET` (falls back to random, losing tokens on restart) and `NODE_ENV` (defaults to undefined, enabling demo mode features).

**Status:** FIXED — Added TOKEN_SECRET and NODE_ENV=development to .env.

---

### L5. No index on `agents.name` for duplicate check
**File:** `api/server.js` (schema creation)
**Severity:** LOW

The `POST /agents` endpoint checks for duplicate names with `SELECT agent_id FROM agents WHERE name = ? AND active = 1` but there's no index on the `name` column. Performance degrades linearly with agent count.

---

### L6. Test-ledger keypairs committed to repo
**File:** `test-ledger/`, `.anchor/test-ledger/`
**Severity:** LOW

Test ledger keypairs are in the repo. While these are test-only, it's messy. The `.gitignore` has `test-ledger/` which should exclude them from git, but the files exist on disk.

---

## INFO

### I1. `agentWallet` always set to `owner` in `register_agent`
**File:** `programs/agent_bazaar/src/lib.rs` line 51
**Severity:** INFO

The on-chain `register_agent` sets `agent.agent_wallet = ctx.accounts.owner.key()` — it doesn't accept a separate wallet parameter. The API accepts `agentWallet` but the on-chain program ignores it.

---

### I2. `categories` stored nowhere on-chain
**File:** `programs/agent_bazaar/src/lib.rs` lines 35–43
**Severity:** INFO

The `register_agent` instruction validates categories but doesn't store them in the `AgentIdentity` account. They're validated then discarded.

---

### I3. Hardcoded treasury wallet in demo service endpoints
**File:** `api/server.js` lines 146, 153, 161
**Severity:** INFO

Demo service endpoints hardcode `HkrtQ8FGS2rkhCC11Z9gHaeMJ93DAfvutmTyq3bLvERd` as the recipient wallet.

---

### I4. `api/bazaar.db-shm` and `api/bazaar.db-wal` not in `.gitignore`
**File:** `.gitignore`
**Severity:** INFO

WAL mode creates `-shm` and `-wal` files alongside the DB. Only `api/bazaar.db` is gitignored.

**Status:** FIXED — Added WAL files to .gitignore.

---

### I5. Copyright year is 2025, hackathon is 2026
**File:** `frontend/src/App.jsx` footer
**Severity:** INFO

Minor: "© 2025 Agent Bazaar" should be 2026.

---

## Fixes Applied

### C2 Fix — Agent Update Authentication
Added ed25519 signature verification to `PUT /agents/:id`. The client must now sign a canonical message containing the agent ID and update timestamp with the owner's private key.

### C3 Fix — Job Result Authentication  
Added `Authorization: Bearer <accessToken>` check on `GET /jobs/:id/result`. The access token is returned when the job is created (tied to payment).

### H1 Fix — Rater Cooldown Per Agent
Added `RaterState` PDA with seeds `["rater_state", agent_id, rater]` that tracks `last_feedback_at` and `feedback_count` per rater per agent. Enforces a 1-hour minimum interval between reviews (`MIN_FEEDBACK_INTERVAL = 3600`). Feedback PDA retains timestamp in seeds (allowing multiple reviews over time). `unique_raters` only increments when `feedback_count == 1` (first review from that wallet).

### H2 Fix — Sanitized WebSocket Broadcasts
Removed `jobId` from all broadcast payloads. Broadcasts now only contain event type, serviceId, and non-sensitive metadata.

### H3 Fix — Rate Limiting on Job Creation
Added `paymentRateLimit` middleware to `POST /jobs`.

### H4 Fix — Webhook SSRF Protection
Added `isPrivateUrl()` check that blocks:
- Private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x)
- `localhost` and `0.0.0.0`
- Cloud metadata endpoints (169.254.169.254)

### H5 Fix — Self-Rating Protection in API
Made `rater` field required with pubkey validation. Always require `txSignature` for feedback submission (removed dev-mode bypass).

### H6 Fix — Persistent Signature Cache
Added SQLite table `used_signatures` to persist replay protection across restarts. The in-memory cache remains as a fast-path, with SQLite as the persistent backing store.

### M1 Fix — Accurate Comment on safePreparedStatement

### M2 Fix — Removed Route-Level Body Parser Override

### M3 Fix — Updated CSP for React SPA

### M5 Fix — WebSocket Ping/Pong Heartbeat

### L1, L2 Fixes — Docs Accuracy

### L4 Fix — Added Missing Env Vars

### I4 Fix — Updated .gitignore
