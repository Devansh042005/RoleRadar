import { Queue } from 'bullmq';
import { redis } from '../db/redis';

export const EXTRACTION_QUEUE_NAME = 'skill-extraction';

export interface ExtractionJobData {
  postingId: string;
}

export const extractionQueue = new Queue<ExtractionJobData>(EXTRACTION_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export async function enqueueExtraction(postingId: string): Promise<void> {
  await extractionQueue.add('extract', { postingId });
}
