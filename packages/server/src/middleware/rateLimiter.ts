import rateLimit from 'express-rate-limit';

export function createRateLimiter(windowMs = 15 * 60 * 1000, max = 100) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { message: 'Too many requests', code: 'RATE_LIMITED' } });
    },
  });
}

// Strict limiter for auth endpoints
export const authLimiter = createRateLimiter(15 * 60 * 1000, 20); // 20 per 15 min
// General API limiter
export const apiLimiter = createRateLimiter(15 * 60 * 1000, 200); // 200 per 15 min
