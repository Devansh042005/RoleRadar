import { Worker, type Job } from 'bullmq';
import { redis } from '../db/redis';
import { RemoteOkAdapter } from '../adapters/remoteOkAdapter';
import { ingestPostings } from '../services/ingestPostings';
import type { JobSourceAdapter } from '../adapters/types';
import { SOURCE_POLL_QUEUE_NAME } from './sourcePollQueue';

interface SourcePollJobData {
  adapterName: string;
}

const ADAPTERS: Record<string, JobSourceAdapter> = {
  REMOTEOK: RemoteOkAdapter,
};

async function processSourcePollJob(job: Job<SourcePollJobData>) {
  const { adapterName } = job.data;
  const adapter = ADAPTERS[adapterName];

  if (!adapter) {
    throw new Error(`No adapter registered for "${adapterName}"`);
  }

  try {
    const postings = await adapter.fetch();
    const summary = await ingestPostings(postings);

    console.log(
      `[source-poll] ${adapterName}: ${summary.fetched} postings fetched, ${summary.inserted} new, ${summary.duplicates} duplicates skipped`,
    );

    return summary;
  } catch (err) {
    console.error(`[source-poll] ${adapterName} failed:`, err);
    throw err;
  }
}

export const sourcePollWorker = new Worker<SourcePollJobData>(
  SOURCE_POLL_QUEUE_NAME,
  processSourcePollJob,
  { connection: redis },
);

sourcePollWorker.on('failed', (job, err) => {
  console.error(`[source-poll] job ${job?.id} exhausted retries:`, err);
});
