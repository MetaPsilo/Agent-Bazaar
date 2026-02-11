const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const fs = require("fs");

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const AGENT_WALLET = new PublicKey("HkrtQ8FGS2rkhCC11Z9gHaeMJ93DAfvutmTyq3bLvERd");
const RPC = "https://api.mainnet-beta.solana.com";
const API_BASE = "https://agent-bazaar-production.up.railway.app";

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const keypairData = JSON.parse(fs.readFileSync("/Users/dan/.config/solana/id.json", "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log("Payer:", payer.publicKey.toString());

  // Step 1: Request service, get 402
  console.log("\n--- STEP 1: Request service ---");
  const prompt = "Give me a quick pulse on Solana ecosystem health right now";
  const serviceUrl = `${API_BASE}/services/agent/1/0?prompt=${encodeURIComponent(prompt)}`;
  const step1 = await fetch(serviceUrl);
  const paymentInfo = await step1.json();
  console.log("Status:", step1.status);
  console.log("Price:", paymentInfo.price, "USDC lamports ($" + (parseInt(paymentInfo.price) / 1e6).toFixed(4) + ")");

  // Step 2: Pay USDC on-chain
  console.log("\n--- STEP 2: Send USDC payment ---");
  const price = parseInt(paymentInfo.price);
  
  const payerAta = await getAssociatedTokenAddress(USDC_MINT, payer.publicKey);
  const recipientAta = await getAssociatedTokenAddress(USDC_MINT, AGENT_WALLET);
  
  const tx = new Transaction();
  
  // Create recipient ATA if it doesn't exist
  try {
    await getAccount(connection, recipientAta);
    console.log("Recipient ATA exists");
  } catch {
    console.log("Creating recipient ATA...");
    tx.add(createAssociatedTokenAccountInstruction(payer.publicKey, recipientAta, AGENT_WALLET, USDC_MINT));
  }
  
  tx.add(createTransferInstruction(payerAta, recipientAta, payer.publicKey, BigInt(price)));
  
  const sig = await sendAndConfirmTransaction(connection, tx, [payer], { commitment: "confirmed" });
  console.log("✅ TX Signature:", sig);
  console.log("Explorer: https://solscan.io/tx/" + sig);

  // Step 3: Submit payment to facilitator
  console.log("\n--- STEP 3: Verify payment via /x402/pay ---");
  const payRes = await fetch(`${API_BASE}/x402/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature: sig, recipient: AGENT_WALLET.toString(), amount: price.toString() }),
  });
  const payResult = await payRes.json();
  console.log("Verification:", JSON.stringify(payResult, null, 2));

  if (payResult.accessToken) {
    console.log("\n--- STEP 4: Call service with payment proof ---");
    const proof = Buffer.from(JSON.stringify({ signature: sig, amount: price })).toString("base64");
    const serviceRes = await fetch(serviceUrl, {
      headers: { "Authorization": `x402 ${proof}` },
    });
    const result = await serviceRes.json();
    console.log("Status:", serviceRes.status);
    console.log("\n========== SERVICE RESPONSE ==========");
    console.log(result.content || JSON.stringify(result, null, 2));
    console.log("=======================================");
  }
}

main().catch(console.error);
