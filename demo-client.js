#!/usr/bin/env node

/**
 * Agent Bazaar Demo Client
 * Demonstrates the full x402 payment flow between two agents
 */

require("dotenv").config();
const { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const axios = require('axios');

// Configuration
const API_BASE = process.env.API_BASE || "http://localhost:3000";
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // Devnet USDC

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Demo wallet (in production, each agent would have their own)
const DEMO_WALLET = process.env.DEMO_WALLET_PRIVATE_KEY 
  ? Keypair.fromSecretKey(new Uint8Array(JSON.parse(process.env.DEMO_WALLET_PRIVATE_KEY)))
  : Keypair.generate();

console.log(`Demo wallet: ${DEMO_WALLET.publicKey.toString()}`);

/**
 * Simulate USDC transfer for x402 payment
 * In a real scenario, this would be handled by a wallet or payment library
 */
async function makePayment(recipientPubkey, amountUSDCLamports, memo) {
  try {
    console.log(`\n💰 Making payment: ${amountUSDCLamports} USDC lamports to ${recipientPubkey}`);
    
    // Get token accounts
    const senderTokenAccount = await getAssociatedTokenAddress(USDC_MINT, DEMO_WALLET.publicKey);
    const recipientTokenAccount = await getAssociatedTokenAddress(USDC_MINT, new PublicKey(recipientPubkey));

    // Create transfer instruction
    const transferInstruction = createTransferInstruction(
      senderTokenAccount,
      recipientTokenAccount,
      DEMO_WALLET.publicKey,
      amountUSDCLamports,
      [],
      TOKEN_PROGRAM_ID
    );

    // Create transaction
    const transaction = new Transaction().add(transferInstruction);
    
    // Demo mode warning
    if (process.env.NODE_ENV !== 'development') {
      throw new Error("Demo mode only available in development environment");
    }
    
    console.log(`⚠️  DEMO MODE: Simulating payment transaction - NOT FOR PRODUCTION USE!`);
    console.log(`    Real implementation would require: USDC tokens, wallet connection, transaction signing`);
    
    // Generate a fake signature for demo (only in development)
    const fakeSignature = "demo_" + Math.random().toString(36).substring(7);
    
    return {
      signature: fakeSignature,
      success: true
    };

  } catch (error) {
    console.error("Payment failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Call a service endpoint with x402 payment
 */
async function callServiceWithPayment(endpoint, agentWallet, price, params = {}) {
  try {
    console.log(`\n🔍 Calling service: ${endpoint}`);
    
    // First request - should return 402 Payment Required
    console.log("📞 Initial request (expecting 402)...");
    let response;
    try {
      response = await axios.get(endpoint, { params });
    } catch (error) {
      if (error.response?.status === 402) {
        console.log("✅ Got 402 Payment Required response");
        const paymentInfo = error.response.data.x402;
        console.log("💳 Payment requirements:", paymentInfo);

        // Make the payment
        const payment = await makePayment(agentWallet, price, `Payment for ${endpoint}`);
        
        if (!payment.success) {
          throw new Error(`Payment failed: ${payment.error}`);
        }

        console.log(`✅ Payment completed with signature: ${payment.signature}`);

        // Submit payment to facilitator
        const paymentSubmission = await axios.post(`${API_BASE}/x402/pay`, {
          signature: payment.signature,
          recipient: agentWallet,
          amount: price.toString()
        });

        console.log("✅ Payment verified by facilitator");
        const accessToken = paymentSubmission.data.accessToken;

        // Retry request with payment proof
        const paymentProof = Buffer.from(JSON.stringify({
          signature: payment.signature
        })).toString('base64');

        console.log("📞 Retrying request with payment proof...");
        response = await axios.get(endpoint, {
          params,
          headers: {
            'Authorization': `x402 ${paymentProof}`
          }
        });
        
        console.log("✅ Service delivered successfully!");
        return response.data;
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error(`❌ Service call failed:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Register an agent in the discovery API (or find existing one)
 */
async function registerAgent(name, description, agentUri, owner, agentWallet) {
  try {
    console.log(`\n📝 Checking for existing agent: ${name}`);
    
    // First, check if an agent with this name already exists
    const existingResponse = await axios.get(`${API_BASE}/agents?q=${encodeURIComponent(name)}`);
    const existingAgent = existingResponse.data.agents.find(agent => agent.name === name);
    
    if (existingAgent) {
      console.log(`✅ Found existing agent with ID: ${existingAgent.agent_id}`);
      return existingAgent.agent_id;
    }
    
    console.log(`📝 Registering new agent: ${name}`);
    const response = await axios.post(`${API_BASE}/agents`, {
      name,
      description,
      agentUri,
      owner,
      agentWallet
    });
    console.log(`✅ Agent registered with ID: ${response.data.agentId}`);
    return response.data.agentId;
  } catch (error) {
    console.error("❌ Agent registration failed:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * Submit feedback for an agent
 */
async function submitFeedback(agentId, rating, comment, txSignature, amountPaid) {
  try {
    console.log(`\n⭐ Submitting feedback for agent ${agentId}`);
    await axios.post(`${API_BASE}/feedback`, {
      agentId,
      rating,
      comment,
      txSignature,
      amountPaid
    });
    console.log(`✅ Feedback submitted: ${rating}/5 stars`);
  } catch (error) {
    console.error("❌ Feedback submission failed:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * Main demo flow
 */
async function runDemo() {
  console.log("🤖 Agent Bazaar x402 Payment Demo");
  console.log("=====================================");

  try {
    // Step 1: Register Ziggy Alpha agent
    const ziggyAgentId = await registerAgent(
      "Ziggy Alpha",
      "AI research agent monitoring 500+ Solana ecosystem accounts. Provides curated alpha and market analysis.",
      "https://api.agentbazaar.com/agents/ziggy/registration.json",
      DEMO_WALLET.publicKey.toString(),
      "HkrtQ8FGS2rkhCC11Z9gHaeMJ93DAfvutmTyq3bLvERd"
    );

    // Step 2: Register DemoBot agent (the buyer)
    const demoBotAgentId = await registerAgent(
      "DemoBot",
      "Autonomous demo agent that discovers and pays for services on Agent Bazaar.",
      "https://api.agentbazaar.com/agents/demobot/registration.json",
      DEMO_WALLET.publicKey.toString(),
      DEMO_WALLET.publicKey.toString()
    );

    // Step 3: DemoBot discovers available services
    console.log("\n🔍 Discovering available agents...");
    const agentsResponse = await axios.get(`${API_BASE}/agents`);
    console.log(`📊 Found ${agentsResponse.data.agents.length} active agents`);
    
    const ziggyAgent = agentsResponse.data.agents.find(a => a.name === "Ziggy Alpha");
    if (ziggyAgent) {
      console.log(`✅ Found Ziggy Alpha (ID: ${ziggyAgent.agent_id}) with rating: ${ziggyAgent.avg_rating || 0}/5`);
    }

    // Step 4: DemoBot calls Ziggy's market pulse service (0.01 USDC)
    const pulseData = await callServiceWithPayment(
      `${API_BASE}/services/research/pulse`,
      "HkrtQ8FGS2rkhCC11Z9gHaeMJ93DAfvutmTyq3bLvERd",
      10000 // 0.01 USDC in lamports
    );
    
    console.log("📊 Market Pulse Data:", pulseData);

    // Step 5: DemoBot calls text summarization service (0.025 USDC)
    const summaryData = await callServiceWithPayment(
      `${API_BASE}/services/text-summary`,
      "HkrtQ8FGS2rkhCC11Z9gHaeMJ93DAfvutmTyq3bLvERd",
      25000, // 0.025 USDC in lamports
      { text: "Solana is a high-performance blockchain supporting builders around the world creating crypto apps that scale today." }
    );

    console.log("📝 Summary Data:", summaryData);

    // Step 6: DemoBot submits positive feedback
    await submitFeedback(
      ziggyAgentId,
      5,
      "Excellent alpha feed! The market pulse data was very insightful.",
      "demo_tx_signature_123",
      35000 // Total amount paid: 10000 + 25000
    );

    // Step 7: Check updated stats
    console.log("\n📈 Checking protocol stats...");
    const stats = await axios.get(`${API_BASE}/stats`);
    console.log("📊 Protocol Stats:", stats.data);

    console.log("\n✅ Demo completed successfully!");
    console.log("=================================");
    console.log("🔥 Achievements:");
    console.log("• 2 agents registered on-chain");
    console.log("• x402 payment flow demonstrated");
    console.log("• Services delivered after payment verification");
    console.log("• Feedback submitted and reputation updated");
    console.log("• Protocol fees collected");

  } catch (error) {
    console.error("\n❌ Demo failed:", error.message);
    process.exit(1);
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = { runDemo, makePayment, callServiceWithPayment };