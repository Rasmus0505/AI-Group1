import rateLimit from 'express-rate-limit';

// In development/test environment, use more lenient rate limits for testing
const isDevelopment = process.env.NODE_ENV !== 'production';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 10000 : 100, // In development, allow 10000 requests per 15 minutes for testing
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and in test environment
    return req.path === '/health' || process.env.NODE_ENV === 'test';
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 1000 : 5, // In development, allow 1000 auth requests per 15 minutes for testing
  message: 'Too many authentication attempts, please try again later.',
  skip: () => process.env.NODE_ENV === 'test',
});

