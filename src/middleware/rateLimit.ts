import type { NextFunction, Request, Response } from 'express';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { redis } from '../db/redis';
import { logger } from '../lib/logger';

interface RateLimitOptions {
  keyPrefix: string;
  points: number;
  duration: number;
}

function setRateLimitHeaders(res: Response, points: number, rlRes: RateLimiterRes) {
  res.setHeader('RateLimit-Limit', String(points));
  res.setHeader('RateLimit-Remaining', String(Math.max(rlRes.remainingPoints, 0)));
  res.setHeader('RateLimit-Reset', String(Math.ceil(rlRes.msBeforeNext / 1000)));
}

/**
 * Redis-backed limiter (rate-limiter-flexible + ioredis), not in-memory: state must be
 * shared across API instances and survive restarts, or horizontal scaling silently
 * resets everyone's quota.
 */
export function createRateLimiter({ keyPrefix, points, duration }: RateLimitOptions) {
  const limiter = new RateLimiterRedis({ storeClient: redis, keyPrefix, points, duration });

  return async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = req.ip ?? 'unknown';

    try {
      const rlRes = await limiter.consume(key);
      setRateLimitHeaders(res, points, rlRes);
      next();
    } catch (rejOrErr) {
      if (rejOrErr instanceof RateLimiterRes) {
        setRateLimitHeaders(res, points, rejOrErr);
        res.setHeader('Retry-After', String(Math.ceil(rejOrErr.msBeforeNext / 1000)));
        res.status(429).json({
          error: 'Too many requests, slow down',
          code: 'RATE_LIMITED',
        });
        return;
      }

      // Redis itself is unreachable — fail open rather than 500ing every request.
      logger.error({ err: rejOrErr, keyPrefix }, 'rate limiter backend error, allowing request through');
      next();
    }
  };
}
