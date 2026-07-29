import { redis } from '../db/redis';
import { logger } from './logger';

/**
 * Redis-backed read-through cache. Redis is a performance optimization here, not a
 * source of truth — if it's unreachable we log and fall through to fetchFn rather
 * than failing the request, and we never cache a rejected fetchFn.
 */
export async function cached<T>(key: string, ttlSeconds: number, fetchFn: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit !== null) {
      return JSON.parse(hit) as T;
    }
  } catch (err) {
    logger.warn({ err, key }, 'cache read failed, falling through to source');
  }

  const value = await fetchFn();

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, 'cache write failed, serving uncached value');
  }

  return value;
}
