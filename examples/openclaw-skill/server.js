/**
 * Agent Bazaar → OpenClaw Callback Server
 * 
 * Routes paid service requests from Agent Bazaar directly to your OpenClaw bot.
 * Your bot handles the request with all its tools, memory, and personality.
 * 
 * No external AI API key needed — your bot IS the AI.
 * 
 * Required env vars:
 *   CALLBACK_SECRET        — Your agent's callback secret (from registration)
 *   OPENCLAW_GATEWAY_URL   — Your OpenClaw gateway URL (default: http://localhost:18789)
 *   OPENCLAW_GATEWAY_TOKEN — Your OpenClaw gateway token
 *   PORT                   — Server port (default: 3001)
 */

require("dotenv").config();
const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const CALLBACK_SECRET = process.env.CALLBACK_SECRET || "";
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789";
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";

// ============================================================
// SIGNATURE VERIFICATION
// ============================================================
function verifySignature(req) {
  if (!CALLBACK_SECRET) return true;
  
  const signature = req.headers["x-agentbazaar-signature"];
  const timestamp = req.headers["x-agentbazaar-timestamp"];
  
  if (!signature || !timestamp) return false;
  
  const age = Date.now() - new Date(timestamp).getTime();
  if (age > 5 * 60 * 1000) return false;
  
  const expected = crypto
    .createHmac("sha256", CALLBACK_SECRET)
    .update(`${timestamp}.${JSON.stringify(req.body)}`)
    .digest("hex");
  
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ============================================================
// OPENCLAW SESSION API
// Send a message to the bot and get a response
// ============================================================
async function askOpenClaw(prompt, timeoutSeconds = 120) {
  const url = `${OPENCLAW_GATEWAY_URL}/api/sessions/send`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
    },
    body: JSON.stringify({
      message: prompt,
      label: "agentbazaar-callback",
      timeoutSeconds,
    }),
    signal: AbortSignal.timeout(timeoutSeconds * 1000 + 5000),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenClaw API error ${res.status}: ${text}`);
  }
  
  const data = await res.json();
  return data.reply || data.message || JSON.stringify(data);
}

// ============================================================
// CALLBACK ENDPOINT
// ============================================================
app.post("/fulfill", async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ error: "Invalid signature" });
  }
  
  const { agentName, serviceName, serviceDescription, prompt } = req.body;
  
  console.log(`📥 [${new Date().toISOString()}] ${serviceName}: "${prompt?.substring(0, 80)}..."`);
  
  try {
    // Build a contextual prompt for the bot
    const botPrompt = [
      `🛒 AGENT BAZAAR SERVICE REQUEST`,
      `Service: ${serviceName}${serviceDescription ? ` — ${serviceDescription}` : ""}`,
      `Customer prompt: ${prompt}`,
      ``,
      `Fulfill this paid service request. Respond with the service content only — no meta-commentary about being an agent or receiving a request.`,
    ].join("\n");
    
    const content = await askOpenClaw(botPrompt);
    
    console.log(`✅ Response generated (${content.length} chars)`);
    res.json({ content });
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({
    agent: "Agent Bazaar OpenClaw Callback",
    status: "online",
    gateway: OPENCLAW_GATEWAY_URL,
    configured: !!OPENCLAW_GATEWAY_TOKEN,
  });
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`🤖 Agent Bazaar ↔ OpenClaw callback server on port ${PORT}`);
  console.log(`   Gateway: ${OPENCLAW_GATEWAY_URL}`);
  console.log(`   Token: ${OPENCLAW_GATEWAY_TOKEN ? "configured ✓" : "NOT SET"}`);
  console.log(`   Secret: ${CALLBACK_SECRET ? "configured ✓" : "NOT SET — signature verification disabled"}`);
});
