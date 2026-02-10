/**
 * x402 Payment Facilitator for Agent Bazaar
 * Splits payments between agent and protocol fee vault
 */

const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || "250");

/**
 * Calculate fee split
 * @param {number} totalAmount - Total payment amount in smallest unit
 * @returns {{ agentShare: number, platformFee: number }}
 */
function calculateFeeSplit(totalAmount) {
  const platformFee = Math.floor((totalAmount * PLATFORM_FEE_BPS) / 10000);
  const agentShare = totalAmount - platformFee;
  return { agentShare, platformFee };
}

/**
 * Express middleware for x402 payment verification
 * In production, this would verify the x402 payment on-chain
 * For hackathon demo, we simulate the flow
 */
function x402Middleware(req, res, next) {
  const paymentHeader = req.headers["x-402-payment"];

  if (!paymentHeader) {
    // Return 402 with payment requirements
    return res.status(402).json({
      x402: {
        version: "1",
        price: req.x402Price || "10000", // default 0.01 USDC
        token: "USDC",
        network: "solana",
        facilitator: `${req.protocol}://${req.get("host")}/x402/verify`,
        payTo: req.x402PayTo || process.env.FEE_VAULT,
      },
    });
  }

  // In production: verify the payment on-chain
  // For hackathon: accept the payment header as proof
  try {
    const payment = JSON.parse(Buffer.from(paymentHeader, "base64").toString());
    const { agentShare, platformFee } = calculateFeeSplit(payment.amount);

    req.x402Payment = {
      ...payment,
      agentShare,
      platformFee,
      verified: true,
    };
    next();
  } catch (e) {
    return res.status(400).json({ error: "Invalid payment header" });
  }
}

module.exports = { calculateFeeSplit, x402Middleware };
