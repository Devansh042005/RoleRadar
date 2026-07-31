import {
  ExtractionStatus,
  Prisma,
  RequirementType,
  type Seniority,
  type RoleCategory,
} from '@prisma/client';
import { prisma } from '../db/prisma';
import { sanitizeJobText } from './textSanitizer';
import { extractSkills } from './skillExtractor';
import { normalizeSkill } from './skillTaxonomy';
import { embedPosting } from './embedPosting';

/**
 * Extracts structured skills/seniority/role-category from a posting's raw text via
 * Claude, then embeds it — previously the skill-extraction BullMQ job's processor
 * plus its follow-on enqueueEmbedding call, now a single direct function.
 *
 * Failures are caught and recorded as ExtractionStatus.FAILED here (mirroring what
 * the old worker's `on('failed', ...)` handler did after exhausting BullMQ's 3
 * retries) rather than being rethrown — a bad posting must not abort whoever is
 * ingesting a whole batch (see ingestPostings.ts), since that isolation is exactly
 * what per-job queue processing gave for free before.
 */
export async function extractPostingSkills(postingId: string): Promise<void> {
  try {
    const posting = await prisma.posting.findUnique({ where: { id: postingId } });
    if (!posting) {
      throw new Error(`Posting ${postingId} not found`);
    }
    if (posting.extractionStatus === ExtractionStatus.PROCESSED) {
      console.log(`[skill-extraction] posting ${postingId} already processed, skipping`);
      // Extraction was already done (possibly before the embedding step existed) —
      // still make sure it gets embedded. embedPosting is cheap and no-ops if it's
      // already embedded.
      await embedPosting(postingId);
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

    // No retries now (BullMQ's attempts: 3 is gone) — a single attempt, but still
    // written as one transaction so a mid-write crash can't leave partial
    // PostingSkill rows alongside a still-PENDING extractionStatus.
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

    // Embed AFTER extraction, never before/in-parallel: the embedding document is
    // built from the extracted skills, so it must be able to read them.
    await embedPosting(postingId);
  } catch (err) {
    console.error(`[skill-extraction] posting ${postingId} failed:`, err);
    await prisma.posting
      .update({
        where: { id: postingId },
        data: { extractionStatus: ExtractionStatus.FAILED },
      })
      .catch((updateErr) => {
        console.error(`[skill-extraction] failed to mark posting ${postingId} as FAILED:`, updateErr);
      });
  }
}
