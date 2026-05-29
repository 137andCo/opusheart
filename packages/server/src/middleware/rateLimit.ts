import type { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis.js';

/** Minimal Redis surface this limiter needs — also satisfied by a test fake. */
export interface RateLimitStore {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  /** Bucket name — requests sharing a (prefix, ip) pair count against one limit. */
  keyPrefix?: string;
  /** Injectable store (defaults to the shared Redis client); used by tests. */
  store?: RateLimitStore;
}

/**
 * Redis-backed, fail-CLOSED rate limiter. Counters live in Redis (shared across
 * replicas), so the limit holds regardless of how many server processes run —
 * unlike a per-process in-memory limiter, which multiplies the real limit by the
 * replica count and resets on restart. If Redis is unreachable we return 503
 * rather than silently letting traffic through (fail closed).
 *
 * Keyed by (prefix, client IP) — NOT per request path — so e.g. the auth bucket
 * caps total auth attempts per IP across /login, /refresh, /mfa, etc. Accurate
 * client IPs require `trust proxy` (set in createApp).
 */
export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyPrefix = 'rl' } = options;
  const windowSec = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const redis = options.store ?? getRedisClient();
    const key = `${keyPrefix}:${req.ip ?? 'unknown'}`;

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
      // Fail closed — deny on limiter failure rather than letting traffic bypass it.
      res.status(503).json({ error: { message: 'Service temporarily unavailable', code: 'RATE_LIMITER_DOWN' } });
    }
  };
}

// Strict limiter for auth endpoints (login / refresh / MFA / register).
export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 20, keyPrefix: 'rl:auth' });
// General API limiter.
export const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 200, keyPrefix: 'rl:api' });
