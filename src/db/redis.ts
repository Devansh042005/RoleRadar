import Redis from 'ioredis';

declare global {
  var __redis: Redis | undefined;
}

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Default retry/timeout behavior (no more maxRetriesPerRequest: null override) — that
// setting made commands queue indefinitely instead of rejecting, which BullMQ's
// blocking commands required but which actively fights the "fail open" designs in
// lib/cache.ts and middleware/rateLimit.ts: both only work if a Redis command can
// actually reject in bounded time so their try/catch can fall through.
export const redis = global.__redis ?? new Redis(REDIS_URL);

if (process.env.NODE_ENV !== 'production') {
  global.__redis = redis;
}
