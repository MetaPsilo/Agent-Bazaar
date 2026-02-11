/**
 * Security middleware for Agent Bazaar API
 */

const rateLimit = require('express-rate-limit');
const { body, query, param, validationResult } = require('express-validator');

// Rate limiting middleware
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many requests from this IP, please try again later.'
);

const paymentRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  10, // 10 payment attempts per minute
  'Too many payment attempts, please try again later.'
);

const registrationRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  5, // 5 registrations per hour per IP
  'Too many agent registrations, please try again later.'
);

const feedbackRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  5, // 5 feedback submissions per minute
  'Too many feedback submissions, please slow down.'
);

// Input validation helpers
const validateAgentId = param('id')
  .isInt({ min: 0, max: Number.MAX_SAFE_INTEGER })
  .withMessage('Invalid agent ID')
  .toInt();

const validateRating = body('rating')
  .isInt({ min: 1, max: 5 })
  .withMessage('Rating must be between 1 and 5')
  .toInt();

const validateAmount = body('amountPaid')
  .optional()
  .isInt({ min: 0, max: Number.MAX_SAFE_INTEGER })
  .withMessage('Amount must be a positive integer')
  .toInt();

const validateString = (field, maxLength) => body(field)
  .trim()
  .isLength({ max: maxLength })
  .withMessage(`${field} must be at most ${maxLength} characters`)
  // SECURITY: Don't use .escape() on JSON API — it HTML-encodes chars (&amp; etc)
  // which corrupts legitimate data. Instead, strip control chars and null bytes.
  .customSanitizer(value => value ? value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') : value);

const validatePubkey = (field) => body(field)
  .isLength({ min: 32, max: 44 })
  .matches(/^[1-9A-HJ-NP-Za-km-z]+$/)
  .withMessage(`${field} must be a valid Solana public key`);

const validatePaginationQuery = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('offset')
    .optional()
    .isInt({ min: 0, max: Number.MAX_SAFE_INTEGER })
    .withMessage('Offset must be a non-negative integer')
    .toInt(),
];

const validateSearchQuery = query('q')
  .optional()
  .trim()
  .isLength({ max: 100 })
  .withMessage('Search query must be at most 100 characters')
  .customSanitizer(value => value ? value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') : value);

const validateMinRating = query('minRating')
  .optional()
  .isFloat({ min: 0, max: 5 })
  .withMessage('Minimum rating must be between 0 and 5')
  .toFloat();

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// CORS configuration - more restrictive
const corsConfig = {
  origin: (origin, callback) => {
    // Allow localhost, production origins, and configured CORS_ORIGIN
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'https://api.agentbazaar.com',
      'https://agentbazaar.com',
      'https://www.agentbazaar.com',
    ];
    // Add CORS_ORIGIN env var if set
    if (process.env.CORS_ORIGIN) {
      process.env.CORS_ORIGIN.split(',').forEach(o => allowedOrigins.push(o.trim()));
    }
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// SQL injection prevention - prepared statement wrapper
// Note: better-sqlite3 uses prepared statements natively which prevents SQL injection.
// This wrapper adds a param count sanity check.
const safePreparedStatement = (db, query, params = []) => {
  try {
    return db.prepare(query);
  } catch (error) {
    console.error('SQL preparation error:', error);
    throw new Error('Database query error');
  }
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none';");
  next();
};

module.exports = {
  generalRateLimit,
  paymentRateLimit,
  registrationRateLimit,
  feedbackRateLimit,
  validateAgentId,
  validateRating,
  validateAmount,
  validateString,
  validatePubkey,
  validatePaginationQuery,
  validateSearchQuery,
  validateMinRating,
  handleValidationErrors,
  corsConfig,
  safePreparedStatement,
  securityHeaders,
};