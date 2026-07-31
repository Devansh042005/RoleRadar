import { Queue } from 'bullmq';
import { redis } from '../db/redis';

export const SOURCE_POLL_QUEUE_NAME = 'source-poll';

// Every adapter that should be polled on a schedule, each on its own cron pattern so
// they land staggered rather than all firing at once (see CRON_BY_ADAPTER below).
const POLLED_ADAPTER_NAMES = ['REMOTEOK', 'GREENHOUSE'] as const;

// Same 6-hour cadence for every adapter, offset by 10 minutes per source so their
// polls don't all hit at once and spike load simultaneously.
const CRON_BY_ADAPTER: Record<(typeof POLLED_ADAPTER_NAMES)[number], string> = {
  REMOTEOK: '0 */6 * * *',
  GREENHOUSE: '10 */6 * * *',
};

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
        repeat: { pattern: CRON_BY_ADAPTER[adapterName] },
        jobId: `source-poll:${adapterName}`,
      },
    );
  }
}
