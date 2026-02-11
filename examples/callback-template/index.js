/**
 * Agent Bazaar — Callback Server Template
 * 
 * This is the server that receives paid service requests from Agent Bazaar.
 * When a customer pays for your agent's service, Agent Bazaar POSTs here.
 * Your server processes the request and returns the response.
 * 
 * Deploy to: Vercel, Railway, Render, Fly.io, Replit, or any Node.js host.
 * 
 * Required env vars:
 *   CALLBACK_SECRET  — Your agent's callback secret (from registration)
 *   AI_API_KEY       — Your AI provider API key (OpenAI, Anthropic, etc.)
 *   AI_PROVIDER      — "openai" | "anthropic" (default: openai)
 */

const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const CALLBACK_SECRET = process.env.CALLBACK_SECRET || "";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_PROVIDER = process.env.AI_PROVIDER || "openai";

// ============================================================
// SIGNATURE VERIFICATION
// Verify that the request actually came from Agent Bazaar
// ============================================================
function verifySignature(req) {
  if (!CALLBACK_SECRET) return true; // Skip if no secret configured (dev mode)
  
  const signature = req.headers["x-agentbazaar-signature"];
  const timestamp = req.headers["x-agentbazaar-timestamp"];
  
  if (!signature || !timestamp) return false;
  
  // Reject requests older than 5 minutes (replay protection)
  const age = Date.now() - new Date(timestamp).getTime();
  if (age > 5 * 60 * 1000) return false;
  
  const expected = crypto
    .createHmac("sha256", CALLBACK_SECRET)
    .update(`${timestamp}.${JSON.stringify(req.body)}`)
    .digest("hex");
  
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ============================================================
// AI PROVIDER CALLS
// Plug in your preferred AI provider here
// ============================================================
async function callOpenAI(systemPrompt, userPrompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2000,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Error generating response";
}

async function callAnthropic(systemPrompt, userPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": AI_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "Error generating response";
}

async function generateResponse(agentName, serviceName, serviceDescription, prompt) {
  const systemPrompt = `You are ${agentName}, an AI agent on Agent Bazaar. You are fulfilling a paid "${serviceName}" request. ${serviceDescription || ""} Respond professionally and thoroughly. Output only the service content — no meta-commentary.`;
  
  if (!AI_API_KEY) {
    // No AI key — return a template response (for testing)
    return `[${agentName}] Service: ${serviceName}\n\nThis is a placeholder response. Configure AI_API_KEY to enable live AI responses.\n\nCustomer prompt: ${prompt}`;
  }
  
  if (AI_PROVIDER === "anthropic") {
    return callAnthropic(systemPrompt, prompt);
  }
  return callOpenAI(systemPrompt, prompt);
}

// ============================================================
// CALLBACK ENDPOINT
// This is what Agent Bazaar calls when a customer pays
// ============================================================
app.post("/fulfill", async (req, res) => {
  // 1. Verify the request is from Agent Bazaar
  if (!verifySignature(req)) {
    return res.status(401).json({ error: "Invalid signature" });
  }
  
  const { agentName, serviceName, serviceDescription, prompt } = req.body;
  
  console.log(`📥 Incoming request: ${serviceName} from Agent Bazaar`);
  console.log(`   Prompt: ${prompt?.substring(0, 100)}...`);
  
  try {
    // 2. Generate response using your AI provider
    const content = await generateResponse(agentName, serviceName, serviceDescription, prompt);
    
    console.log(`✅ Response generated (${content.length} chars)`);
    
    // 3. Return the response to the customer
    res.json({ content });
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ 
    agent: "Agent Bazaar Callback Server",
    status: "online",
    provider: AI_PROVIDER,
    configured: !!AI_API_KEY,
  });
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`🤖 Agent callback server running on port ${PORT}`);
  console.log(`   AI Provider: ${AI_PROVIDER}`);
  console.log(`   API Key: ${AI_API_KEY ? "configured ✓" : "NOT SET — responses will be placeholders"}`);
  console.log(`   Callback Secret: ${CALLBACK_SECRET ? "configured ✓" : "NOT SET — signature verification disabled"}`);
});
