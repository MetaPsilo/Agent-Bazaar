const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount } = require("@solana/spl-token");
const fs = require("fs");

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const AGENT_WALLET = new PublicKey("EpKTEdSom7Mf1u6AwMjh7YoydrszXbLKS9bi2YmJBzL5");
const TREASURY_WALLET = new PublicKey("HkrtQ8FGS2rkhCC11Z9gHaeMJ93DAfvutmTyq3bLvERd");
const RPC = "https://api.mainnet-beta.solana.com";
const API_BASE = "https://agent-bazaar-production.up.railway.app";

async function main() {
  const connection = new Connection(RPC, "confirmed");
  // Customer wallet (Da166)
  const keypairData = JSON.parse(fs.readFileSync("/tmp/test-treasury.json", "utf-8"));
  const customer = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log("Customer (payer):", customer.publicKey.toString());
  console.log("Agent (Ziggy):", AGENT_WALLET.toString());
  console.log("Treasury:", TREASURY_WALLET.toString());

  // Step 1: Get 402
  console.log("\n--- STEP 1: Request service → 402 ---");
  const prompt = "What is SOL price right now and what are the top 3 DeFi protocols by TVL?";
  const serviceUrl = `${API_BASE}/services/agent/1/0?prompt=${encodeURIComponent(prompt)}`;
  const step1 = await fetch(serviceUrl);
  const paymentInfo = await step1.json();
  const totalPrice = parseInt(paymentInfo.price);
  const platformFee = Math.floor((totalPrice * 250) / 10000);
  const agentShare = totalPrice - platformFee;
  console.log(`Total: ${totalPrice} | Agent: ${agentShare} | Treasury: ${platformFee}`);

  // Step 2: Two-leg payment
  console.log("\n--- STEP 2: Send split USDC payment ---");
  const customerAta = await getAssociatedTokenAddress(USDC_MINT, customer.publicKey);
  const agentAta = await getAssociatedTokenAddress(USDC_MINT, AGENT_WALLET);
  const treasuryAta = await getAssociatedTokenAddress(USDC_MINT, TREASURY_WALLET);

  const tx = new Transaction();

  // Create ATAs if needed
  try { await getAccount(connection, agentAta); } catch {
    console.log("Creating agent ATA...");
    tx.add(createAssociatedTokenAccountInstruction(customer.publicKey, agentAta, AGENT_WALLET, USDC_MINT));
  }
  try { await getAccount(connection, treasuryAta); } catch {
    console.log("Creating treasury ATA...");
    tx.add(createAssociatedTokenAccountInstruction(customer.publicKey, treasuryAta, TREASURY_WALLET, USDC_MINT));
  }

  // Transfer 97.5% to agent, 2.5% to treasury
  tx.add(createTransferInstruction(customerAta, agentAta, customer.publicKey, BigInt(agentShare)));
  tx.add(createTransferInstruction(customerAta, treasuryAta, customer.publicKey, BigInt(platformFee)));

  const sig = await sendAndConfirmTransaction(connection, tx, [customer], { commitment: "confirmed" });
  console.log("✅ TX:", sig);
  console.log("🔗 https://solscan.io/tx/" + sig);

  // Step 3: Verify
  console.log("\n--- STEP 3: Verify payment ---");
  const payRes = await fetch(`${API_BASE}/x402/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature: sig, recipient: AGENT_WALLET.toString(), amount: totalPrice.toString() }),
  });
  const payResult = await payRes.json();
  console.log(JSON.stringify(payResult, null, 2));

  // Step 4: Call service
  if (payResult.success) {
    console.log("\n--- STEP 4: Call service with proof ---");
    const proof = Buffer.from(JSON.stringify({ signature: sig, amount: totalPrice })).toString("base64");
    const serviceRes = await fetch(serviceUrl, { headers: { "Authorization": `x402 ${proof}` } });
    const result = await serviceRes.json();
    console.log("Status:", serviceRes.status);
    console.log("\n========== RESPONSE ==========");
    console.log(result.content || JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
