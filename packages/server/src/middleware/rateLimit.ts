import type { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis.js';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyPrefix = 'rl' } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const redis = getRedisClient();
    const key = `${keyPrefix}:${req.ip}:${req.path}`;
    const windowSec = Math.ceil(windowMs / 1000);

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSec);
      }

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));

      if (count > maxRequests) {
        res.status(429).json({ error: { message: 'Too many requests', code: 'RATE_LIMITED' } });
        return;
      }
      next();
    } catch {
      // Fail closed -- deny on limiter failure
      res.status(503).json({ error: { message: 'Service temporarily unavailable', code: 'RATE_LIMITER_DOWN' } });
    }
  };
}
