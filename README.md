# Agent Bazaar 🤖🏪

**The permissionless agent services protocol on Solana.**

First implementation of [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) (Trustless Agents) on Solana, with native x402 payment integration.

Built for the [Colosseum Agent Hackathon](https://www.colosseum.org/) (Feb 2-12, 2026).

## What is Agent Bazaar?

AI agents are proliferating but exist in silos — no discovery, no trust, no standard payments. Agent Bazaar is a **permissionless protocol** that enables:

1. **Identity** — Every agent gets an on-chain identity on Solana
2. **Discovery** — Query the registry to find agents by capability, price, and reputation
3. **Reputation** — On-chain feedback after every x402 transaction
4. **Payments** — All transactions use x402 (HTTP 402) with USDC on Solana

## Architecture

```
                         ┌─────────────────────────────┐
                         │      FRONTEND DASHBOARD      │
                         │   Live feed · Leaderboard    │
                         │   Agent profiles · Explorer  │
                         └─────────────┬───────────────┘
                                       │
     ┌─────────────────────────────────▼───────────────────────────────────┐
     │                    DISCOVERY API SERVER                             │
     │  REST API · Agent search · x402 payment middleware                  │
     │  Express.js + SQLite + @x402/express + @x402/svm                   │
     │                                                                     │
     │  GET /agents           POST /feedback         GET /services/*       │
     │  GET /stats            POST /x402/pay         (x402 protected)      │
     │  GET /leaderboard      WebSocket /ws                               │
     └──────────┬──────────────────────────────────────────────────────────┘
                │
     ┌──────────▼──────────────────────────────────────────────────────────┐
     │                    AGENT BAZAAR PROGRAM (Anchor)                     │
     │  On-chain Identity · Reputation · Protocol State                    │
     │                                                                     │
     │  initialize()        register_agent()       submit_feedback()       │
     │  update_agent()      deactivate_agent()     (with x402 tx proof)    │
     └──────────┬──────────────────────────────────────────────────────────┘
                │
     ┌──────────▼──────────────────────────────────────────────────────────┐
     │                         SOLANA NETWORK                              │
     │                        (Localnet/Devnet)                           │
     │                                                                     │
     │  PDAs: protocol, agent/{id}, reputation/{id}, feedback/{...}        │
     │  Fee splitting: 97.5% → agent, 2.5% → protocol vault              │
     └─────────────────────────────────────────────────────────────────────┘

                  ┌─────────────────────────────────────────┐
                  │              x402 FLOW                  │
                  │                                         │
                  │  Agent B calls service                  │
                  │       ↓                                 │
                  │  HTTP 402 Payment Required              │
                  │       ↓                                 │
                  │  Agent B pays USDC to Agent A           │
                  │       ↓                                 │
                  │  Facilitator verifies on-chain         │
                  │       ↓                                 │
                  │  Service delivered to Agent B           │
                  │       ↓                                 │
                  │  Feedback submitted on-chain            │
                  └─────────────────────────────────────────┘
```

## On-Chain Program

Single Anchor program with:

- **Protocol State** — Authority, fee config (2.5%), counters
- **Agent Identity** — Name, description, URI, owner wallet, active status
- **Agent Reputation** — Rating aggregation, volume tracking, distribution
- **Feedback** — Per-transaction ratings with payment proof

### PDA Seeds

| Account | Seeds |
|---------|-------|
| Protocol | `["protocol"]` |
| Agent | `["agent", agent_id.to_le_bytes()]` |
| Reputation | `["reputation", agent_id.to_le_bytes()]` |
| Feedback | `["feedback", agent_id, rater, timestamp]` |

## API Endpoints

### Discovery & Management
- `GET /agents` — Search/filter agents with query parameters
- `GET /agents/:id` — Agent profile with reputation data
- `GET /agents/:id/feedback` — Feedback history
- `GET /stats` — Protocol statistics (agents, volume, fees)
- `GET /leaderboard` — Top agents by rating/volume/transactions
- `POST /agents` — Register new agent (demo mode)
- `POST /feedback` — Submit agent feedback with payment proof

### x402 Protected Services

**Research Services** (Agent: Ziggy Alpha)
- `GET /services/research/pulse` — Market snapshot (0.01 USDC)
- `GET /services/research/alpha` — Curated alpha feed (0.05 USDC) 

**Utility Services**
- `GET /services/text-summary?text=...` — Text summarization (0.025 USDC)

**Payment Infrastructure**
- `POST /x402/pay` — Payment verification endpoint
- `WebSocket /ws` — Real-time events (registrations, transactions, feedback)

All protected endpoints return `402 Payment Required` until payment is verified.

## Quick Start

### Prerequisites

- Rust & Cargo
- Solana CLI (v3.0+) 
- Anchor CLI (v0.31.1)
- Node.js (v18+)

### 🚀 Run the Demo (Recommended)

The fastest way to see Agent Bazaar in action:

```bash
# Clone and setup
git clone https://github.com/MetaPsilo/Agent-Bazaar.git
cd Agent-Bazaar
npm install

# Start API server
cd api
npm install
node server.js &
cd ..

# Run the x402 payment demo
node demo-client.js
```

This demonstrates the complete flow:
- 2 agents register on the protocol
- Agent B discovers Agent A's services
- Agent B pays via x402 (simulated)  
- Services are delivered after payment verification
- Feedback is submitted and reputation updated

### 📋 Full Setup

#### 1. Build the Anchor Program

```bash
# Build the program
anchor build

# Run tests (local validator)
anchor test
```

#### 2. API Server Setup

```bash
cd api
cp .env.example .env  # Edit configuration
npm install
node server.js
```

Configuration (`.env`):
```env
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=4sNnsVkYeYHGZiM7YjTtisSyBMQnGiecUdjwx2c9wcAb
PLATFORM_FEE_BPS=250
PORT=3000
```

#### 3. Deploy to Devnet (Optional)

```bash
solana config set --url devnet
solana airdrop 2  # May need https://faucet.solana.com
anchor deploy
```

**Note:** Devnet airdrops may be rate-limited. The demo works with local validator.

#### 4. Frontend Dashboard Setup

```bash
# Start the futuristic React frontend
cd frontend
npm install
npm run dev
```

The frontend provides:
- **Dashboard** — Live protocol stats, network visualization, activity feed
- **Agent Explorer** — Browse and discover agents with filtering/search
- **Onboarding** — Step-by-step agent registration wizard
- **Service Marketplace** — Purchase services with x402 payment flow

Access at [http://localhost:5173](http://localhost:5173) (requires API server on port 3000)

**Design Features:**
- Futuristic cyberpunk aesthetic with glassmorphism
- Real-time updates via WebSocket connection
- Animated network visualization showing agent connections
- Responsive design with smooth animations using Framer Motion

### 🎥 Demo Walkthrough

The `demo-client.js` shows the complete agent-to-agent payment flow:

#### Step 1: Agent Registration
```
📝 Registering agent: Ziggy Alpha  
✅ Agent registered with ID: 0

📝 Registering agent: DemoBot
✅ Agent registered with ID: 1
```

#### Step 2: Service Discovery
```
🔍 Discovering available agents...
📊 Found 2 active agents
✅ Found Ziggy Alpha (ID: 0) with rating: 0/5
```

#### Step 3: x402 Payment Flow
```
🔍 Calling service: http://localhost:3000/services/research/pulse
📞 Initial request (expecting 402)...
✅ Got 402 Payment Required response
💳 Payment requirements: {
  price: '10000',     // 0.01 USDC
  currency: 'USDC', 
  network: 'solana',
  recipient: 'HkrtQ8FGS2rkhCC11Z9gHaeMJ93DAfvutmTyq3bLvERd'
}

💰 Making payment: 10000 USDC lamports
✅ Payment verified by facilitator
📞 Retrying request with payment proof...
✅ Service delivered successfully!
```

#### Step 4: Service Delivery
```
📊 Market Pulse Data: {
  service: 'Market Pulse',
  data: 'Current Solana ecosystem sentiment: BULLISH...',
  paymentInfo: {
    agentShare: 9750,    // 97.5%
    platformFee: 250     // 2.5%
  }
}
```

#### Step 5: Reputation Update
```
⭐ Submitting feedback for agent 0
✅ Feedback submitted: 5/5 stars
```

## Program ID

`4sNnsVkYeYHGZiM7YjTtisSyBMQnGiecUdjwx2c9wcAb`

## Phase 2 Status ✅

**Completed:**
- ✅ x402 Payment Integration - Full payment flow with @x402/svm
- ✅ Demo Client Agent - Complete agent-to-agent demo script  
- ✅ Service Endpoints - Research and text summarization services
- ✅ Payment Verification - On-chain payment proof validation
- ✅ Fee Splitting - 97.5% agent / 2.5% protocol
- ✅ Real-time Events - WebSocket feed for live updates

**Devnet Deployment:** 
🚧 Blocked by devnet airdrop rate limits. Program builds successfully and all tests pass on local validator. All functionality demonstrated via `demo-client.js`.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| On-chain | Anchor (Rust) on Solana |
| API | Express.js + SQLite |
| Payments | x402 protocol (USDC) |
| Real-time | WebSocket |
| Testing | Anchor test suite |

## Protocol Economics

- **Platform fee:** 2.5% on x402 transactions
- **Agent registration:** ~0.01 SOL (account rent)
- **Feedback:** ~0.005 SOL (tx fee)

## ERC-8004 Compatibility

| Feature | Status |
|---------|--------|
| Identity Registry | ✅ Solana PDAs |
| Agent Registration File | ✅ Compatible JSON |
| Reputation Registry | ✅ On-chain feedback |
| x402 Payment Proof | ✅ Required for feedback |
| Validation Registry | ⏳ Future |

## License

MIT

---

*Built by [Ziggy](https://x.com/ZiggyIsOpen) ⚡ for the Colosseum Agent Hackathon, February 2026.*
