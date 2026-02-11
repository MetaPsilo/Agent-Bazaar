# Documentation Accuracy Audit

**Date:** 2026-02-10  
**Scope:** All documentation files vs. actual codebase  

## Summary

| File | Issues Found | Fixed |
|------|-------------|-------|
| README.md | 8 | ✅ |
| SUBMISSION.md | 9 | ✅ |
| SECURITY-AUDIT.md | 5 | ✅ |
| AUDIT-ROUND5.md | 3 | ✅ |
| BLACKHAT-AUDIT.md | 3 | ✅ |
| Docs.jsx | 25+ | ✅ |
| .env.example | 3 | ✅ |
| Dockerfile | 0 | — |
| railway.json | 0 | — |

---

## README.md

1. **Architecture diagram references `@x402/express + @x402/svm`** — These packages aren't used. The x402 facilitator is custom-built (`x402-facilitator.js`). Fixed.
2. **Missing instructions in diagram** — Only shows `initialize`, `register_agent`, `update_agent`, `deactivate_agent`, `submit_feedback`. Missing: `reactivate_agent`, `close_agent`, `update_authority`, `update_fee`. Fixed.
3. **Missing RaterState PDA** — PDA seeds table missing `RaterState` with seeds `["rater_state", agent_id, rater]`. Fixed.
4. **Missing async job system endpoints** — No mention of `POST /jobs`, `GET /jobs/:id/status`, `GET /jobs/:id/result`, `POST /jobs/:id/webhook`. Fixed.
5. **Missing Ed25519 signature verification** — No mention of wallet signature auth on agent updates and feedback. Fixed.
6. **Missing security audit mention** — 6 rounds of security audits not mentioned. Fixed.
7. **"Phase 2 Status" section outdated** — Still references Phase 2 tasks. Updated to reflect current state. Fixed.
8. **On-chain program section says 4 account types** — Actually 5: ProtocolState, AgentIdentity, AgentReputation, Feedback, RaterState. Fixed.

## SUBMISSION.md

1. **Says "5 instructions"** — Actually 9. Fixed.
2. **Says "4 account types"** — Actually 5 (missing RaterState). Fixed.
3. **Missing security features** — Ed25519 auth, rater_state cooldown, SQLite payment cache, SSRF protection, etc. Fixed.
4. **Missing async job system** — Major feature not mentioned. Fixed.
5. **Missing security audit summary** — 6 rounds, 50+ findings. Fixed.
6. **Repository structure outdated** — Missing security audit files, frontend dir. Fixed.
7. **Not compelling enough** — Rewritten to be more impactful for judges. Fixed.
8. **Demo results outdated** — Updated. Fixed.
9. **Copyright/attribution** — Updated. Fixed.

## SECURITY-AUDIT.md

1. **Round 3 C2 mentions "Capped amount_paid to 1,000,000,000"** — Cap was intentionally REMOVED by Dan. Updated to note this. Fixed.
2. **Summary table only shows 4 rounds** — Updated to reference all 6. Fixed.
3. **Round 2 says "in-memory signature cache"** — Now SQLite-backed. Updated. Fixed.
4. **"Known Limitations" section outdated** — Several items fixed (ed25519 auth, unique_raters tracking). Updated. Fixed.
5. **Round 1 item 7 says unique_raters has no fix** — Now tracked via RaterState PDA. Updated. Fixed.

## AUDIT-ROUND5.md

1. **C1 references "1B cap"** — Cap was removed. Updated note. Fixed.
2. **H1 says "Changed feedback PDA seeds to remove timestamp"** — Actually, timestamp is still in feedback seeds. Fix was adding RaterState PDA with 1-hour cooldown. Corrected. Fixed.
3. **C2 says "no real authentication"** — Already marked as fixed with ed25519, which is correct. No change needed.

## BLACKHAT-AUDIT.md

1. **CRITICAL-03 says "No amount_paid Cap"** — Cap was intentionally removed. Updated to note Dan's decision. Fixed.
2. **Fix section says "Added MAX_AMOUNT_PER_FEEDBACK constant"** — This was removed. Updated. Fixed.
3. **CRITICAL-04 fix description accurate** — rater_state PDA is correct.

## Docs.jsx (Frontend Developer Docs) — MAJOR ISSUES

1. **PDA seeds wrong** — `protocol_state` → `protocol`, `agent_identity` → `agent`, `agent_reputation` → `reputation`. Fixed.
2. **ProtocolState fields wrong** — `fee_basis_points` → `platform_fee_bps`, `fee_recipient` → `fee_vault`, `total_agents` → `agent_count`. Fixed.
3. **AgentIdentity fields wrong** — `is_active` → `active`, `created_at` → `registered_at`. Fixed.
4. **AgentReputation missing fields** — Missing `unique_raters`, `rating_distribution`, `last_rated_at`. Fixed.
5. **Feedback fields wrong** — Shows `comment: String` but actual has `comment_hash: [u8; 32]`, `tx_signature: [u8; 64]`, `amount_paid: u64`. Fixed.
6. **Missing RaterState account** — Added. Fixed.
7. **Instruction args wrong throughout** — `register_agent` takes `categories` not `agent_wallet`, `submit_feedback` takes `agent_id, rating, comment_hash, amount_paid, timestamp`, `initialize` only takes `platform_fee_bps`. Fixed.
8. **`update_fee` says max 1000 bps** — Actual max is 10000. Fixed.
9. **Error codes wrong** — Don't match actual `ErrorCode` enum. Fixed to match all 20 error codes.
10. **No `/search` endpoint** — Search is via `GET /agents?q=...`. Fixed.
11. **Stats response uses wrong field names** — `totalAgents` → `total_agents`, etc. Fixed.
12. **Health response shows nonexistent `uptime` field**. Fixed.
13. **Missing endpoints** — POST /feedback, POST /jobs, job status/result, POST /x402/pay, GET /agents/:id/feedback. Fixed.
14. **Leaderboard missing `metric` param**. Fixed.
15. **Agents endpoint missing `q`, `sort`, `minRating` params**. Fixed.
16. **Rate limit says 100/min** — Actually 100/15 min. Fixed.
17. **Default limit 20 not 50, max 100 not 200**. Fixed.
18. **`agentWallet` is optional** not required. Fixed.
19. **WebSocket event format wrong** — Uses `type` not `event`. Types: `registration`, `feedback`, `job_created`, `job_progress`, `job_completed`. Fixed.
20. **Security section rate limits inaccurate**. Fixed.
21. **Comment max says 512** — Actual API allows 1000. Fixed.
22. **Timestamp window says 5 min** — On-chain is 24 hours. Fixed.
23. **402 response format doesn't match actual** — Actual wraps in `x402` object with `version`, `split`, etc. Fixed.
24. **PUT /agents/:id example missing required auth fields** (`owner`, `authSignature`, `authMessage`). Fixed.
25. **SDK examples use wrong PDA seed strings**. Fixed.

## .env.example

1. **Has `FACILITATOR_WALLET`** — Not used in code. Removed. Fixed.
2. **Missing `TRUST_PROXY`**. Added. Fixed.
3. **Missing `API_BASE_URL`**. Added. Fixed.

## Dockerfile — Correct ✅

## railway.json — Correct ✅
