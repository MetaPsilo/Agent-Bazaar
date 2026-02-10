/**
 * x402 Payment Facilitator for Agent Bazaar
 * Uses @x402/svm for Solana payment verification and splitting
 */

const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } = require('@solana/spl-token');

// Constants
const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || "250");
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // Devnet USDC

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
 * Verify a Solana transaction signature and extract payment details
 * @param {string} signature - Transaction signature
 * @param {string} expectedRecipient - Expected recipient public key
 * @param {number} expectedAmount - Expected amount in USDC lamports
 * @returns {Promise<{verified: boolean, amount: number, sender: string}>}
 */
async function verifyPayment(signature, expectedRecipient, expectedAmount) {
  try {
    // Demo mode ONLY for development environment
    if (process.env.NODE_ENV === 'development' && signature.startsWith('demo_')) {
      console.warn(`⚠️ DEMO MODE: Accepting fake signature ${signature} - THIS IS UNSAFE FOR PRODUCTION!`);
      return {
        verified: true,
        amount: expectedAmount,
        sender: "demo_sender_wallet"
      };
    }

    // Validate signature format
    if (!signature || typeof signature !== 'string' || signature.length < 32) {
      return { verified: false, error: "Invalid signature format" };
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

    // Parse token transfers from transaction
    const tokenTransfers = tx.meta?.postTokenBalances?.filter(
      (balance, index) => {
        const preBalance = tx.meta.preTokenBalances?.[index];
        return balance.mint === USDC_MINT.toString() && 
               balance.uiTokenAmount.amount !== preBalance?.uiTokenAmount.amount;
      }
    );

    // Find transfer to expected recipient
    const relevantTransfer = tokenTransfers?.find(balance => 
      balance.owner === expectedRecipient
    );

    if (!relevantTransfer) {
      return { verified: false, error: "No transfer to expected recipient" };
    }

    const transferAmount = parseInt(relevantTransfer.uiTokenAmount.amount);
    if (transferAmount < expectedAmount) {
      return { verified: false, error: "Insufficient transfer amount" };
    }

    return {
      verified: true,
      amount: transferAmount,
      sender: tx.transaction.message.accountKeys[0].toString()
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
      // Return 402 Payment Required with x402 details
      return res.status(402).json({
        error: "Payment Required",
        x402: {
          version: "1",
          price: price,
          currency: "USDC",
          network: "solana",
          recipient: agentWallet,
          facilitator: `${req.protocol}://${req.get("host")}/x402/pay`,
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
      return res.status(400).json({ 
        error: "Invalid payment proof",
        details: error.message 
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

    // Verify the payment
    const verification = await verifyPayment(signature, recipient, parseInt(amount));
    
    if (!verification.verified) {
      return res.status(400).json({ 
        error: "Payment verification failed",
        details: verification.error 
      });
    }

    // Calculate fee split
    const { agentShare, platformFee } = calculateFeeSplit(parseInt(amount));
    
    // Generate access token (in production, this should be a JWT or similar)
    const accessToken = Buffer.from(JSON.stringify({
      signature,
      amount: verification.amount,
      timestamp: Date.now(),
      recipient
    })).toString('base64');

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
    res.status(500).json({ 
      error: "Payment processing failed",
      details: error.message 
    });
  }
}

module.exports = { 
  calculateFeeSplit, 
  x402Protect, 
  handlePaymentSubmission,
  verifyPayment 
};