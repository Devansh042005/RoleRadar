import 'dotenv/config';
import { sourcePollQueue } from '../queues/sourcePollQueue';

// Enqueues a single, non-repeating source-poll job through the same queue the
// scheduled 6-hourly polls use — the running worker picks it up immediately.
// Useful for testing a new adapter without waiting for its cron slot.
async function main() {
  const adapterName = process.argv[2];
  if (!adapterName) {
    console.error('Usage: tsx src/scripts/runSourcePollOnce.ts <ADAPTER_NAME>');
    process.exitCode = 1;
    return;
  }

  const job = await sourcePollQueue.add('poll', { adapterName });
  console.log(`Enqueued one-off source-poll job ${job.id} for adapter "${adapterName}" — watch the worker's logs.`);
}

// Deliberately no sourcePollQueue.close() here — on a queue with repeatable jobs
// registered (this one has REMOTEOK/GREENHOUSE's 6-hourly schedules), close() hangs
// waiting on cleanup. The other one-off scripts (backfillEmbeddings.ts, etc.) don't
// close their queues either and exit fine once main() resolves.
main();
