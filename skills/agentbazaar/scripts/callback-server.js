#!/usr/bin/env node
/**
 * Agent Bazaar Callback Server for OpenClaw
 * 
 * Receives paid service requests from Agent Bazaar and fulfills them
 * by spawning sessions on the local OpenClaw gateway.
 * 
 * Usage:
 *   node callback-server.js
 * 
 * Required env vars:
 *   CALLBACK_SECRET        — From Agent Bazaar registration
 *   OPENCLAW_GATEWAY_URL   — e.g. http://localhost:18789
 *   OPENCLAW_GATEWAY_TOKEN — Your gateway auth token
 * 
 * Optional:
 *   PORT                   — Server port (default: 3099)
 *   AGENT_SYSTEM_PROMPT    — Custom system prompt for your agent
 */

const http = require("http");
const crypto = require("crypto");

const PORT = parseInt(process.env.PORT || "3099");
const CALLBACK_SECRET = process.env.CALLBACK_SECRET || "";
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";
const AGENT_SYSTEM_PROMPT = process.env.AGENT_SYSTEM_PROMPT || "";

function verifySignature(timestamp, body, signature) {
  if (!CALLBACK_SECRET) return true;
  if (!signature || !timestamp) return false;
  const age = Date.now() - new Date(timestamp).getTime();
  if (age > 5 * 60 * 1000) return false;
  const expected = crypto.createHmac("sha256", CALLBACK_SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function fulfillViaOpenClaw(agentName, serviceName, serviceDescription, prompt) {
  const systemContext = AGENT_SYSTEM_PROMPT
    ? `${AGENT_SYSTEM_PROMPT}\n\nService requested: "${serviceName}" — ${serviceDescription}`
    : `You are ${agentName}, an AI agent on Agent Bazaar. A customer has paid for your "${serviceName}" service. ${serviceDescription || ""} Fulfill their request professionally and thoroughly. Output only the service content.`;

  const task = `${systemContext}\n\nCustomer request: ${prompt}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/sessions/spawn`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        task,
        model: "anthropic/claude-sonnet-4",
        runTimeoutSeconds: 120,
        cleanup: "delete",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.text();
      console.error("Gateway error:", res.status, err);
      return { error: `Gateway returned ${res.status}` };
    }

    const result = await res.json();
    return { content: result.result || result.message || result.output || "Task completed." };
  } catch (err) {
    clearTimeout(timeout);
    console.error("Gateway call failed:", err.message);
    return { error: err.message };
  }
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Content-Type", "application/json");

  // Health check
  if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
    res.writeHead(200);
    return res.end(JSON.stringify({
      agent: "Agent Bazaar × OpenClaw Callback",
      status: "online",
      gateway: GATEWAY_URL,
      configured: !!GATEWAY_TOKEN,
    }));
  }

  // Callback endpoint
  if (req.method === "POST" && req.url === "/fulfill") {
    let body = "";
    for await (const chunk of req) body += chunk;

    // Verify signature
    const sig = req.headers["x-agentbazaar-signature"];
    const ts = req.headers["x-agentbazaar-timestamp"];
    if (!verifySignature(ts, body, sig)) {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: "Invalid signature" }));
    }

    let data;
    try { data = JSON.parse(body); } catch {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "Invalid JSON" }));
    }

    const { agentName, serviceName, serviceDescription, prompt, test } = data;
    console.log(`📥 ${serviceName} request${test ? " (test)" : ""}: ${(prompt || "").substring(0, 80)}...`);

    if (test) {
      res.writeHead(200);
      return res.end(JSON.stringify({ content: "Test successful — callback server is running." }));
    }

    const result = await fulfillViaOpenClaw(agentName, serviceName, serviceDescription, prompt);

    if (result.error) {
      console.error("❌", result.error);
      res.writeHead(502);
      return res.end(JSON.stringify({ error: result.error }));
    }

    console.log(`✅ Response generated (${result.content.length} chars)`);
    res.writeHead(200);
    return res.end(JSON.stringify(result));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`\n🤖 Agent Bazaar × OpenClaw Callback Server`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Gateway: ${GATEWAY_URL}`);
  console.log(`   Token: ${GATEWAY_TOKEN ? "configured ✓" : "NOT SET ✗"}`);
  console.log(`   Secret: ${CALLBACK_SECRET ? "configured ✓" : "NOT SET — signature verification disabled"}`);
  console.log(`\n   Callback URL: http://localhost:${PORT}/fulfill`);
  console.log(`   (expose this with Tailscale or ngrok for production)\n`);
});
