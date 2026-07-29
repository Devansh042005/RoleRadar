import { Worker, type Job } from 'bullmq';
import {
  ExtractionStatus,
  Prisma,
  RequirementType,
  type Seniority,
  type RoleCategory,
} from '@prisma/client';
import { redis } from '../db/redis';
import { prisma } from '../db/prisma';
import { sanitizeJobText } from '../services/textSanitizer';
import { extractSkills } from '../services/skillExtractor';
import { normalizeSkill } from '../services/skillTaxonomy';
import { EXTRACTION_QUEUE_NAME, type ExtractionJobData } from './extractionQueue';

async function processExtractionJob(job: Job<ExtractionJobData>) {
  const { postingId } = job.data;

  try {
    const posting = await prisma.posting.findUnique({ where: { id: postingId } });
    if (!posting) {
      throw new Error(`Posting ${postingId} not found`);
    }
    if (posting.extractionStatus === ExtractionStatus.PROCESSED) {
      console.log(`[skill-extraction] posting ${postingId} already processed, skipping`);
      return;
    }

    const postingRaw = await prisma.postingRaw.findFirst({ where: { postingId } });
    if (!postingRaw) {
      throw new Error(`No PostingRaw found for posting ${postingId}`);
    }

    const sanitizedText = sanitizeJobText(postingRaw.rawText);
    const { result, raw } = await extractSkills(sanitizedText);

    const requiredSkills = await Promise.all(result.required_skills.map(normalizeSkill));
    const niceToHaveSkills = await Promise.all(result.nice_to_have_skills.map(normalizeSkill));
    const plainRaw = JSON.parse(JSON.stringify(raw)) as Prisma.InputJsonValue;

    // Retries (BullMQ attempts: 3) re-run this job from scratch since extractionStatus only
    // flips to PROCESSED at the very end. A prior attempt may have already inserted
    // PostingSkill rows before failing later on, so we clear them before re-inserting and
    // do the whole write as one transaction — a retry is then a clean replace, never a dupe.
    await prisma.$transaction(async (tx) => {
      await tx.postingSkill.deleteMany({ where: { postingId } });

      await tx.postingSkill.createMany({
        data: [
          ...requiredSkills.map((skill) => ({
            postingId,
            skillId: skill.id,
            requirementType: RequirementType.REQUIRED,
          })),
          ...niceToHaveSkills.map((skill) => ({
            postingId,
            skillId: skill.id,
            requirementType: RequirementType.NICE_TO_HAVE,
          })),
        ],
        skipDuplicates: true,
      });

      await tx.posting.update({
        where: { id: postingId },
        data: {
          seniority: result.seniority ? (result.seniority.toUpperCase() as Seniority) : null,
          yearsExperience: result.years_experience,
          roleCategory: result.role_category.toUpperCase() as RoleCategory,
          extractionStatus: ExtractionStatus.PROCESSED,
        },
      });

      await tx.postingRaw.update({
        where: { id: postingRaw.id },
        data: { extractionRaw: plainRaw },
      });
    });

    console.log(
      `Posting ${postingId} → extracted ${result.required_skills.length} required skills, ${result.nice_to_have_skills.length} nice-to-have`,
    );
  } catch (err) {
    console.error(`[skill-extraction] posting ${postingId} failed:`, err);
    throw err;
  }
}

export const extractionWorker = new Worker<ExtractionJobData>(
  EXTRACTION_QUEUE_NAME,
  processExtractionJob,
  { connection: redis, concurrency: 5 },
);

extractionWorker.on('failed', async (job, err) => {
  if (!job) return;

  const maxAttempts = job.opts.attempts ?? 1;
  if (job.attemptsMade < maxAttempts) return;

  console.error(`[skill-extraction] job ${job.id} exhausted retries:`, err);
  await prisma.posting
    .update({
      where: { id: job.data.postingId },
      data: { extractionStatus: ExtractionStatus.FAILED },
    })
    .catch((updateErr) => {
      console.error(`[skill-extraction] failed to mark posting ${job.data.postingId} as FAILED:`, updateErr);
    });
});
