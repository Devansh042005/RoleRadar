import { Worker, type Job } from 'bullmq';
import { RequirementType } from '@prisma/client';
import { redis } from '../db/redis';
import { prisma } from '../db/prisma';
import { embed } from '../services/embeddingService';
import { buildPostingEmbeddingDocument } from '../services/embeddingDocument';
import { hasPostingEmbedding, setPostingEmbedding } from '../services/postingVectorSearch';
import { EMBEDDING_QUEUE_NAME, type EmbeddingJobData } from './embeddingQueue';

async function processEmbeddingJob(job: Job<EmbeddingJobData>) {
  const { postingId } = job.data;
  try {
    if (await hasPostingEmbedding(postingId)) {
      console.log(`[embedding] posting ${postingId} already embedded, skipping`);
      return;
    }

    const posting = await prisma.posting.findUnique({
      where: { id: postingId },
      include: {
        company: true,
        postingRaws: { take: 1, orderBy: { createdAt: 'desc' } },
        postingSkills: { include: { skill: true } },
      },
    });
    if (!posting) throw new Error(`Posting ${postingId} not found`);

    const requiredSkills = posting.postingSkills
      .filter((ps) => ps.requirementType === RequirementType.REQUIRED)
      .map((ps) => ps.skill.name);
    const niceToHaveSkills = posting.postingSkills
      .filter((ps) => ps.requirementType === RequirementType.NICE_TO_HAVE)
      .map((ps) => ps.skill.name);

    const document = buildPostingEmbeddingDocument({
      title: posting.title,
      companyName: posting.company.name,
      roleCategory: posting.roleCategory,
      requiredSkills,
      niceToHaveSkills,
      rawText: posting.postingRaws[0]?.rawText ?? '',
    });

    const vector = await embed(document);
    await setPostingEmbedding(postingId, vector);
  } catch (err) {
    console.error(`[embedding] posting ${postingId} failed:`, err);
    throw err;
  }
}

export const embeddingWorker = new Worker<EmbeddingJobData>(
  EMBEDDING_QUEUE_NAME,
  processEmbeddingJob,
  {
    connection: redis,
    // CPU-bound local model inference, unlike the API-bound extraction queue (whose
    // concurrency 5 is safe because it's waiting on Anthropic over the network, not
    // burning this process's CPU). Concurrency 2 here caps how many inference calls
    // run at once so embedding doesn't peg the process. No rate limiter is needed —
    // unlike extraction, this never calls an external API, so there's no quota to
    // respect.
    concurrency: 2,
  },
);

embeddingWorker.on('failed', (job, err) => {
  if (!job) return;
  console.error(`[embedding] job ${job.id} failed:`, err);
});
