import Redis from 'ioredis';

declare global {
  var __redis: Redis | undefined;
}

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// maxRetriesPerRequest: null is required by BullMQ for any connection it shares (blocking commands).
export const redis = global.__redis ?? new Redis(REDIS_URL, { maxRetriesPerRequest: null });

if (process.env.NODE_ENV !== 'production') {
  global.__redis = redis;
}
