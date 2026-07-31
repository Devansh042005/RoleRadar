import { Queue } from 'bullmq';
import { redis } from '../db/redis';

export const EMBEDDING_QUEUE_NAME = 'embedding-generation';

export interface EmbeddingJobData {
  postingId: string;
}

export const embeddingQueue = new Queue<EmbeddingJobData>(EMBEDDING_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export async function enqueueEmbedding(postingId: string): Promise<void> {
  await embeddingQueue.add('embed', { postingId });
}
