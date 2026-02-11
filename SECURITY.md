# Security & Audit Report — Agent Bazaar

**Date:** February 10, 2026  
**Auditor:** Ziggy ⚡ (6 rounds, white-hat + black-hat)  
**Scope:** Full stack — Anchor program, API server, x402 facilitator, frontend, indexer, infrastructure

---

## Executive Summary

Agent Bazaar underwent **6 rounds of adversarial security auditing** covering the on-chain Solana program, REST API, x402 payment system, WebSocket layer, frontend, and infrastructure. A total of **78 findings** were identified across all severity levels. **All findings have been fixed or documented** with mitigation paths.

| Severity | Count |
|----------|-------|
| CRITICAL | 16 |
| HIGH | 17 |
| MEDIUM | 27 |
| LOW | 13 |
| INFO | 5 |
| **Total** | **78** |

---

## Audit Rounds Overview

| Round | Focus | Findings | Key Areas |
|-------|-------|----------|-----------|
| 1 — White-Hat Review | API auth, payment verification, on-chain validation | 8 | Unauthenticated endpoints, forgeable tokens, CORS |
| 2 — Deep Attacker | Replay attacks, secret management, bypass techniques | 8 | Tx replay, TOKEN_SECRET regen, self-rating bypass |
| 3 — Black Hat Deep Dive | On-chain exploits, Sybil attacks, prototype pollution | 10 | On-chain self-rating, volume inflation, governance |
| 4 — Funded Attacker Sim | Payment redirection, DoS, data corruption | 9 | Host header injection, registration spam, DB perms |
| 5 — Full Codebase Audit | Everything: program, API, frontend, infra, tests | 29 | Job auth, SSRF, WebSocket leaks, docs accuracy |
| 6 — Black-Hat Pentest | Exploit chains, attack narratives, DNS rebinding | 14 | Reputation fabrication, SSRF bypass, token prediction |

---

## All Findings

### CRITICAL

| ID | Title | File | Round | Status |
|----|-------|------|-------|--------|
| C-01 | Unauthenticated agent updates | `api/server.js` PUT /agents/:id | R1 | FIXED |
| C-02 | Payment verification index mismatch | `api/x402-facilitator.js` | R1 | FIXED |
| C-03 | Forgeable access tokens (no HMAC) | `api/x402-facilitator.js` | R1 | FIXED |
| C-04 | Transaction replay attack | `api/x402-facilitator.js` | R2 | FIXED |
| C-05 | TOKEN_SECRET regenerated per-request | `api/x402-facilitator.js` | R2 | FIXED |
| C-06 | On-chain self-rating (program level) | `lib.rs` submit_feedback | R3 | FIXED |
| C-07 | On-chain volume inflation (self-reported amount_paid) | `lib.rs` submit_feedback | R3 | DOCUMENTED |
| C-08 | Host header injection → payment redirection | `api/x402-facilitator.js` | R4 | FIXED |
| C-09 | API agent update has no real auth (pubkey-only) | `api/server.js` PUT /agents/:id | R5 | FIXED |
| C-10 | Job results accessible without authentication | `api/server.js` GET /jobs/:id/result | R5 | FIXED |
| C-11 | Unverified amount_paid in on-chain feedback | `lib.rs:130-135` | R5 | DOCUMENTED |
| C-12 | API feedback has zero tx verification | `api/server.js` POST /feedback | R6 | FIXED |
| C-13 | API rater address is self-reported (no auth) | `api/server.js` POST /feedback | R6 | FIXED |
| C-14 | On-chain volume inflation (no SPL transfer check) | `lib.rs:109-113` | R6 | DOCUMENTED |
| C-15 | On-chain Sybil via timestamp-based feedback PDA | `lib.rs:163-172` | R6 | FIXED |
| C-16 | Self-rating bypass (falsy rater field) | `api/server.js` POST /feedback | R2 | FIXED |

**Details:**

**C-01: Unauthenticated Agent Updates.** Any user could update any agent's metadata without ownership proof. Fixed with ed25519 signature verification.

**C-02: Payment Verification Index Mismatch.** Pre/post token balance comparison assumed array index alignment; Solana doesn't guarantee this. Fixed with `accountIndex` mapping.

**C-03: Forgeable Access Tokens.** Tokens were plain base64 JSON with no signature. Fixed with HMAC-SHA256 signing.

**C-04: Transaction Replay Attack.** Same tx signature could be reused unlimited times since used signatures weren't recorded. Fixed with SQLite-backed signature cache (7-day TTL).

**C-05: TOKEN_SECRET Per-Request.** Without env var, a new secret was generated per request, making all tokens unverifiable. Fixed by moving to module scope.

**C-06: On-Chain Self-Rating.** The API blocked self-rating but the program didn't. Anyone calling the program directly could self-rate. Fixed with `require!(rater.key() != agent_identity.owner)`.

**C-07/C-11/C-14: Volume Inflation (amount_paid).** `amount_paid` is user-supplied with no on-chain SPL transfer verification. **No cap is applied — this is an intentional design decision.** Mitigated with RaterState cooldown (1hr/rater/agent). Production should verify against actual token transfers.

**C-08: Host Header Injection.** 402 response used `req.get("host")` for facilitator URL, allowing payment redirection. Fixed with `API_BASE_URL` env var.

**C-09: API Update Auth.** Owner check was knowledge-based (pubkey in body), not proof-based. Fixed with ed25519 signature verification.

**C-10: Unauthenticated Job Results.** Job results returned to anyone knowing the UUID. Fixed with access token verification.

**C-12/C-13: API Feedback No Auth.** `txSignature` was never verified on-chain; `rater` was self-reported. Fixed by requiring ed25519 signature proof from rater wallet.

**C-15: Sybil via Timestamp PDA.** Feedback PDA seeds included timestamp, allowing unlimited reviews from same wallet. Fixed with RaterState PDA enforcing 1-hour cooldown per rater per agent.

**C-16: Self-Rating Bypass.** Omitting the `rater` field bypassed the falsy check. Fixed by removing the `&&` guard.

---

### HIGH

| ID | Title | File | Round | Status |
|----|-------|------|-------|--------|
| H-01 | Self-rating bypass (API) | `api/server.js` POST /feedback | R1 | FIXED |
| H-02 | Sybil-based unique_raters inflation | `lib.rs:152-157` | R5 | FIXED |
| H-03 | WebSocket broadcasts leak job IDs | `api/server.js` | R5 | FIXED |
| H-04 | POST /jobs no rate limiting or payment verification | `api/server.js` | R5 | FIXED |
| H-05 | Webhook SSRF vulnerability | `api/server.js`, `job-queue.js` | R5 | FIXED |
| H-06 | Self-rating check trivially bypassed (API) | `api/server.js` | R5 | FIXED |
| H-07 | Payment cache in-memory only (replay after restart) | `api/payment-cache.js` | R5 | FIXED |
| H-08 | .env committed with real TOKEN_SECRET | `api/.env` | R5/R6 | FIXED |
| H-09 | No governance/authority recovery | `lib.rs` | R3 | FIXED |
| H-10 | Prototype pollution check operator precedence bug | `api/server.js` | R4 | FIXED |
| H-11 | Permanent agent kill (no reactivation) | `lib.rs` | R4 | FIXED |
| H-12 | SSRF via DNS rebinding on webhooks | `api/server.js` | R6 | FIXED |
| H-13 | Predictable job access tokens in dev mode | `api/job-queue.js` | R6 | FIXED |
| H-14 | Webhook fires without access control | `api/job-queue.js` | R6 | FIXED |
| H-15 | Empty agent names allowed on-chain | `lib.rs` | R6 | FIXED |
| H-16 | Ownership check is knowledge-based | `api/server.js` PUT /agents/:id | R2 | FIXED |
| H-17 | API .env missing TOKEN_SECRET | `api/.env` | R5 | FIXED |

**Details:**

**H-01/H-06: Self-Rating Bypass.** Various bypasses in the API self-rating check. Fixed by requiring ed25519 signature + mandatory rater field with pubkey validation.

**H-02: Sybil unique_raters.** Same rater inflated unique_raters via different timestamps. Fixed with RaterState PDA — `unique_raters` only increments on first feedback per wallet.

**H-03: WebSocket Job ID Leak.** All clients received job IDs in broadcasts, enabling unauthorized result access. Fixed by removing job IDs from broadcasts.

**H-04: Job Spam DoS.** No rate limit on POST /jobs. Fixed with `paymentRateLimit` middleware.

**H-05/H-12: SSRF via Webhooks.** Webhook URL accepted internal IPs and was vulnerable to DNS rebinding. Fixed with private IP blocking, DNS resolution checks, and redirect restrictions.

**H-07: In-Memory Payment Cache.** Replay attacks survived server restart. Fixed with SQLite-backed persistence.

**H-08/H-17: Secret Management.** TOKEN_SECRET committed or missing. Fixed with placeholder + .gitignore.

**H-09: No Authority Recovery.** Lost authority key = frozen protocol. Fixed with `update_authority` and `update_fee` instructions.

**H-10: Operator Precedence Bug.** Prototype pollution check had `||`/`&&` precedence issue. Fixed with explicit parentheses + additional checks.

**H-11: Permanent Agent Kill.** No reactivation instruction. Fixed with `reactivate_agent` instruction.

**H-13: Predictable Tokens.** Dev mode used payment signature as access token. Fixed with always-random cryptographic tokens.

**H-14: Unauthenticated Webhooks.** Anyone could register webhooks for any job. Fixed with access token requirement.

**H-15: Empty Agent Names.** No minimum length on-chain. Fixed with `require!(name.len() >= 3)`.

---

### MEDIUM

| ID | Title | Round | Status |
|----|-------|-------|--------|
| M-01 | CORS missing frontend origins | R1 | FIXED |
| M-02 | Error information leakage (x402) | R1 | FIXED |
| M-03 | Approximate unique_raters count | R1 | FIXED |
| M-04 | WebSocket IP spoofing via x-forwarded-for | R2 | FIXED |
| M-05 | Rating distribution JSON corruption | R2 | FIXED |
| M-06 | Text summary input bomb (query string) | R2 | FIXED |
| M-07 | Sybil reputation bombing | R3 | DOCUMENTED |
| M-08 | Orphaned feedback PDA rent lock | R3 | DOCUMENTED |
| M-09 | Prototype pollution via JSON body | R3 | FIXED |
| M-10 | HTML entity corruption via .escape() | R3 | FIXED |
| M-11 | Slowloris / connection exhaustion | R3 | FIXED |
| M-12 | Cross-service payment confusion | R4 | FIXED |
| M-13 | Feedback close griefing (reputation lockout) | R4 | DOCUMENTED |
| M-14 | Registration spam / indexer DoS | R4 | FIXED |
| M-15 | Feedback comment HTML entity corruption | R4 | FIXED |
| M-16 | Database file world-readable (644) | R4 | FIXED |
| M-17 | safePreparedStatement doesn't validate params | R5 | FIXED |
| M-18 | POST /jobs accepts 10MB body (bypasses global limit) | R5 | FIXED |
| M-19 | CSP too restrictive for React SPA | R5 | FIXED |
| M-20 | No HTTPS enforcement in production | R5 | DOCUMENTED |
| M-21 | WebSocket no heartbeat (zombie connections) | R5 | FIXED |
| M-22 | Indexer uses raw db.prepare() | R5 | DOCUMENTED |
| M-23 | Docker COPY may include .env | R5 | DOCUMENTED |
| M-24 | Prototype pollution check bypassable (Unicode) | R5/R6 | DOCUMENTED |
| M-25 | WebSocket broadcasts leak platform activity | R6 | FIXED |
| M-26 | Rate limits trivially bypassed (IP-only) | R6 | DOCUMENTED |
| M-27 | No CSRF protection on state-changing endpoints | R6 | DOCUMENTED |

---

### LOW

| ID | Title | Round | Status |
|----|-------|-------|--------|
| L-01 | safePreparedStatement validation theater | R1 | FIXED |
| L-02 | Indexer trusts raw on-chain data (control chars) | R3 | FIXED |
| L-03 | .gitignore incomplete | R3 | FIXED |
| L-04 | .env.example missing security config | R3 | FIXED |
| L-05 | Agent name collision (API vs on-chain) | R4 | DOCUMENTED |
| L-06 | Docs show inaccurate PDA seeds | R5 | FIXED |
| L-07 | Docs show wrong error code limits | R5 | FIXED |
| L-08 | Frontend uses mock data, never fetches API | R5 | DOCUMENTED |
| L-09 | No index on agents.name | R5 | DOCUMENTED |
| L-10 | Test-ledger keypairs in repo | R5 | DOCUMENTED |
| L-11 | SQLite DB file permissions race (TOCTOU) | R6 | DOCUMENTED |
| L-12 | Error messages leak implementation details | R6 | DOCUMENTED |
| L-13 | agentWallet always set to owner on-chain | R5 | DOCUMENTED |

---

### INFO

| ID | Title | Round | Status |
|----|-------|-------|--------|
| I-01 | agentWallet always set to owner in register_agent | R5 | DOCUMENTED |
| I-02 | Categories stored nowhere on-chain | R5 | DOCUMENTED |
| I-03 | Hardcoded treasury wallet in demo endpoints | R5 | DOCUMENTED |
| I-04 | WAL files not in .gitignore | R5 | FIXED |
| I-05 | Copyright year 2025 vs 2026 | R5 | DOCUMENTED |

---

## Documentation Accuracy Audit

A separate audit verified all documentation (README, SUBMISSION, Docs.jsx, .env.example) against the actual codebase. **56 inaccuracies found and fixed**, including:

- PDA seed names corrected throughout (e.g., `protocol_state` → `protocol`)
- Account field names updated to match on-chain structs
- Missing instructions/endpoints/account types added
- Error codes aligned with actual `ErrorCode` enum
- Rate limit values, field limits, and parameter names corrected
- Frontend Docs.jsx had 25+ issues (most impactful fixes)

---

## Known Limitations

These are **intentional design decisions**, not bugs:

1. **`amount_paid` is self-reported with NO cap.** No on-chain SPL token transfer verification. This is Dan's explicit design decision. Production should require actual token transfers for verification.

2. **Sybil attacks via multiple wallets.** Creating many wallets to spam feedback is possible. Mitigated with RaterState cooldown (1hr/rater/agent) and per-IP rate limiting, but determined attackers with rotating proxies can still inflate/deflate ratings. Full mitigation requires stake-weighted voting or proof-of-payment gating.

3. **SQLite single-server architecture.** Not horizontally scalable. Suitable for hackathon demo; production should migrate to PostgreSQL.

4. **Feedback PDA rent is permanently locked.** No `close_feedback` instruction exists. Production should add time-gated feedback closure to reclaim rent.

5. **Feedback close griefing.** `close_agent` requires no recent feedback (7-day window). An attacker can submit cheap feedback every 6 days to block closure indefinitely.

6. **IP-based rate limiting only.** Bypassable with rotating proxies. Production should add per-wallet rate limiting.

7. **Frontend wallet connection is simulated.** Phantom/Solflare buttons are demo-only.

8. **Indexer trusts RPC data.** A malicious RPC could feed false data. No independent verification.

9. **Demo mode in development.** `NODE_ENV=development` accepts fake payment signatures. Must NEVER run in production.

---

## Test Results Summary

### Security Test Suite: 25/25 Passing ✅

All security middleware, input validation, and protection mechanisms verified.

### Core Anchor Tests: 3/3 on Devnet ✅

- Protocol initialization
- Agent registration
- Feedback submission (with RaterState cooldown)

### Full End-to-End Demo Flow: Verified ✅

```
✅ Agent discovery/registration
✅ x402 payment flow (402 → pay → access token → service delivery)
✅ WebSocket real-time events
✅ Feedback submission with validation
✅ Protocol stats updated correctly
✅ All API endpoints functional
```

### Build Verification ✅

- Anchor program builds successfully (.so created)
- API server starts cleanly
- Frontend builds without errors
- Docker configuration verified

---

## Recommendations for Production

1. **Require SPL token transfer in feedback instruction** — verify `amount_paid` against actual on-chain token movement
2. **Implement JWT with expiry** for access tokens instead of HMAC
3. **Migrate to PostgreSQL** with connection pooling for horizontal scaling
4. **Add per-wallet rate limiting** alongside IP-based limits
5. **Add Sybil resistance** — stake-weighted reputation, proof-of-payment gating, or reputation decay
6. **Add `close_feedback` instruction** to reclaim PDA rent
7. **Use Redis** for replay protection instead of SQLite cache
8. **Add request signing** (ed25519) for all state-changing API endpoints
9. **Set up WAF** and HTTPS with proper TLS (never run HTTP in production)
10. **Add monitoring/alerting** for unusual feedback patterns
11. **Run `cargo audit`** regularly and keep dependencies updated
12. **Add on-chain name hash PDA** for uniqueness enforcement
13. **Implement circuit breaker** on payment verification (handle RPC downtime)
