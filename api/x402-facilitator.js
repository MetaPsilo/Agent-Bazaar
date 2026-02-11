/**
 * x402 Payment Facilitator for Agent Bazaar
 * Uses @x402/svm for Solana payment verification and splitting
 */

const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const crypto = require('crypto');
const { isSignatureUsed, recordSignature } = require('./payment-cache');

// SECURITY: Generate a stable token secret at startup (not per-request!)
const TOKEN_SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.TOKEN_SECRET) {
  console.warn('⚠️  TOKEN_SECRET not set — using random secret. Tokens will not survive restart.');
}

// Constants
const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || "250");
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
// Protocol treasury wallet — receives the 2.5% platform fee
const TREASURY_WALLET = process.env.TREASURY_WALLET || "HkrtQ8FGS2rkhCC11Z9gHaeMJ93DAfvutmTyq3bLvERd";
// Use mainnet USDC by default, devnet USDC if SOLANA_RPC_URL contains "devnet"
const USDC_MINT = new PublicKey(
  (process.env.SOLANA_RPC_URL || '').includes('devnet')
    ? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"   // Devnet USDC
    : "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"   // Mainnet USDC
);

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

/**
 * Calculate fee split
 * @param {number} totalAmount - Total payment amount in USDC lamports
 * @returns {{ agentShare: number, platformFee: number }}
 */
function calculateFeeSplit(totalAmount) {
  const platformFee = Math.floor((totalAmount * PLATFORM_FEE_BPS) / 10000);
  const agentShare = totalAmount - platformFee;
  return { agentShare, platformFee };
}

/**
 * Verify a Solana transaction signature and extract payment details.
 * Enforces fee split: checks that both agent AND treasury received correct amounts.
 * @param {string} signature - Transaction signature
 * @param {string} expectedRecipient - Expected agent wallet public key
 * @param {number} expectedAmount - Expected TOTAL amount in USDC lamports (before split)
 * @returns {Promise<{verified: boolean, amount: number, sender: string, agentShare: number, platformFee: number}>}
 */
async function verifyPayment(signature, expectedRecipient, expectedAmount) {
  try {
    // Demo mode ONLY for development environment
    if (process.env.NODE_ENV === 'development' && signature.startsWith('demo_')) {
      // SECURITY: Even demo sigs get replay protection
      if (isSignatureUsed(signature)) {
        return { verified: false, error: "Demo signature already used" };
      }
      console.warn(`⚠️ DEMO MODE: Accepting fake signature ${signature} - THIS IS UNSAFE FOR PRODUCTION!`);
      const { agentShare, platformFee } = calculateFeeSplit(expectedAmount);
      recordSignature(signature, { amount: expectedAmount, recipient: expectedRecipient });
      return {
        verified: true,
        amount: expectedAmount,
        agentShare,
        platformFee,
        sender: "demo_sender_wallet"
      };
    }

    // Validate signature format
    if (!signature || typeof signature !== 'string' || signature.length < 32) {
      return { verified: false, error: "Invalid signature format" };
    }

    // SECURITY: Replay protection — reject already-used signatures
    if (isSignatureUsed(signature)) {
      return { verified: false, error: "Transaction signature already used" };
    }

    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });

    if (!tx) {
      return { verified: false, error: "Transaction not found" };
    }

    if (tx.meta?.err) {
      return { verified: false, error: "Transaction failed" };
    }

    // Build a map of account index -> pre/post balances for USDC
    // SECURITY: Match by accountIndex, not array position (Solana doesn't guarantee index alignment)
    const preBalanceMap = new Map();
    for (const bal of (tx.meta.preTokenBalances || [])) {
      if (bal.mint === USDC_MINT.toString()) {
        preBalanceMap.set(bal.accountIndex, parseInt(bal.uiTokenAmount.amount));
      }
    }
    
    const postBalanceMap = new Map();
    for (const bal of (tx.meta.postTokenBalances || [])) {
      if (bal.mint === USDC_MINT.toString()) {
        postBalanceMap.set(bal.accountIndex, {
          amount: parseInt(bal.uiTokenAmount.amount),
          owner: bal.owner
        });
      }
    }

    // Calculate expected split
    const { agentShare: expectedAgentShare, platformFee: expectedPlatformFee } = calculateFeeSplit(expectedAmount);
    
    // Find balance changes for agent, treasury, and sender
    let agentIncrease = 0;
    let treasuryIncrease = 0;
    let senderAddress = null;
    
    for (const [accIdx, postBal] of postBalanceMap) {
      const preBal = preBalanceMap.get(accIdx) || 0;
      const delta = postBal.amount - preBal;
      
      if (postBal.owner === expectedRecipient && delta > 0) {
        agentIncrease += delta;
      }
      if (postBal.owner === TREASURY_WALLET && delta > 0) {
        treasuryIncrease += delta;
      }
      if (delta < 0) {
        // This account lost tokens — likely the sender
        senderAddress = postBal.owner;
      }
    }

    // If treasury is the same as agent (self-hosted), accept full payment to one wallet
    const isSameWallet = expectedRecipient === TREASURY_WALLET;
    
    if (isSameWallet) {
      // Single wallet mode: just check total amount
      if (agentIncrease < expectedAmount) {
        return { verified: false, error: `Insufficient transfer: got ${agentIncrease}, need ${expectedAmount}` };
      }
    } else {
      // Split payment mode: verify BOTH legs
      // Allow 1 lamport tolerance for rounding
      if (agentIncrease < expectedAgentShare - 1) {
        return { verified: false, error: `Insufficient agent payment: got ${agentIncrease}, need ${expectedAgentShare}` };
      }
      if (treasuryIncrease < expectedPlatformFee - 1) {
        return { verified: false, error: `Missing or insufficient platform fee: got ${treasuryIncrease}, need ${expectedPlatformFee}. Treasury: ${TREASURY_WALLET}` };
      }
    }

    const totalVerified = agentIncrease + treasuryIncrease;

    // SECURITY: Record signature to prevent replay
    recordSignature(signature, { amount: totalVerified, recipient: expectedRecipient, treasury: TREASURY_WALLET });

    return {
      verified: true,
      amount: totalVerified,
      agentShare: agentIncrease,
      platformFee: treasuryIncrease,
      sender: senderAddress || tx.transaction.message.accountKeys[0].toString()
    };

  } catch (error) {
    console.error("Payment verification error:", error);
    return { verified: false, error: error.message };
  }
}

/**
 * Express middleware for x402 payment protection
 * @param {string} price - Price in USDC lamports (e.g., "10000" for 0.01 USDC)
 * @param {string} agentWallet - Agent's wallet address for receiving payments
 */
function x402Protect(price, agentWallet) {
  return async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('x402 ')) {
      // SECURITY: Use configured base URL instead of trusting Host header
      // Host header injection could redirect payments to attacker's facilitator
      const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      const { agentShare, platformFee } = calculateFeeSplit(parseInt(price));
      return res.status(402).json({
        error: "Payment Required",
        x402: {
          version: "1",
          price: price,
          currency: "USDC",
          network: "solana",
          recipient: agentWallet,
          treasury: TREASURY_WALLET,
          feeBps: PLATFORM_FEE_BPS,
          split: {
            agent: { wallet: agentWallet, amount: agentShare.toString() },
            platform: { wallet: TREASURY_WALLET, amount: platformFee.toString() },
          },
          facilitator: `${baseUrl}/x402/pay`,
          memo: `Payment for ${req.path}`,
        }
      });
    }

    // Extract payment proof from Authorization header
    const paymentProof = authHeader.substring(5); // Remove 'x402 '
    
    try {
      const proof = JSON.parse(Buffer.from(paymentProof, 'base64').toString());
      
      // Verify the payment on-chain
      const verification = await verifyPayment(
        proof.signature,
        agentWallet,
        parseInt(price)
      );

      if (!verification.verified) {
        return res.status(402).json({ 
          error: "Invalid payment", 
          details: verification.error 
        });
      }

      // Store payment details for the request
      req.x402Payment = {
        verified: true,
        signature: proof.signature,
        amount: verification.amount,
        sender: verification.sender,
        ...calculateFeeSplit(verification.amount)
      };

      next();
    } catch (error) {
      console.error("Payment proof parsing error:", error);
      return res.status(400).json({ 
        error: "Invalid payment proof"
      });
    }
  };
}

/**
 * Express route handler for x402 payment submission
 * This endpoint accepts payment transactions and verifies them
 */
async function handlePaymentSubmission(req, res) {
  try {
    const { signature, recipient, amount } = req.body;

    if (!signature || !recipient || !amount) {
      return res.status(400).json({ 
        error: "Missing required fields: signature, recipient, amount" 
      });
    }

    // SECURITY: Validate recipient is a valid Solana pubkey
    try {
      new PublicKey(recipient);
    } catch {
      return res.status(400).json({ error: "Invalid recipient address" });
    }

    // SECURITY: Validate amount is a positive integer
    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // Verify the payment
    const verification = await verifyPayment(signature, recipient, parsedAmount);
    
    if (!verification.verified) {
      return res.status(400).json({ 
        error: "Payment verification failed",
        details: verification.error 
      });
    }

    // Calculate fee split
    const { agentShare, platformFee } = calculateFeeSplit(parseInt(amount));
    
    // Generate HMAC-signed access token (uses module-level TOKEN_SECRET)
    const tokenPayload = JSON.stringify({
      signature,
      amount: verification.amount,
      timestamp: Date.now(),
      recipient
    });
    const hmac = crypto.createHmac('sha256', TOKEN_SECRET).update(tokenPayload).digest('hex');
    const accessToken = Buffer.from(tokenPayload).toString('base64') + '.' + hmac;

    res.json({
      success: true,
      accessToken,
      verification: {
        amount: verification.amount,
        agentShare,
        platformFee,
        sender: verification.sender
      }
    });

  } catch (error) {
    console.error("Payment submission error:", error);
    // SECURITY: Don't leak internal error details to clients
    res.status(500).json({ 
      error: "Payment processing failed"
    });
  }
}

module.exports = { 
  calculateFeeSplit, 
  x402Protect, 
  handlePaymentSubmission,
  verifyPayment 
};