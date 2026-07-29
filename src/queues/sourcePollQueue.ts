import { Queue } from 'bullmq';
import { redis } from '../db/redis';

export const SOURCE_POLL_QUEUE_NAME = 'source-poll';

// Every adapter that should be polled on a schedule. Phase 8 adds GREENHOUSE/LEVER here.
const POLLED_ADAPTER_NAMES = ['REMOTEOK'] as const;

const SIX_HOURS_CRON = '0 */6 * * *';

export const sourcePollQueue = new Queue(SOURCE_POLL_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

export async function scheduleSourcePolling(): Promise<void> {
  for (const adapterName of POLLED_ADAPTER_NAMES) {
    await sourcePollQueue.add(
      'poll',
      { adapterName },
      {
        repeat: { pattern: SIX_HOURS_CRON },
        jobId: `source-poll:${adapterName}`,
      },
    );
  }
}
