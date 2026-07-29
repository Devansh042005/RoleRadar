import { Router } from 'express';
import { prisma } from '../db/prisma';
import { redis } from '../db/redis';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const [dbResult, redisResult] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis.ping(),
  ]);

  const dbOk = dbResult.status === 'fulfilled';
  const redisOk = redisResult.status === 'fulfilled';
  const ok = dbOk && redisOk;

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    checks: {
      db: dbOk ? 'ok' : 'unreachable',
      redis: redisOk ? 'ok' : 'unreachable',
    },
  });
});
