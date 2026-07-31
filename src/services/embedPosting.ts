import { RequirementType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { embed } from './embeddingService';
import { buildPostingEmbeddingDocument } from './embeddingDocument';
import { hasPostingEmbedding, setPostingEmbedding } from './postingVectorSearch';

/**
 * Generates and stores a posting's embedding — previously the embedding-generation
 * BullMQ job's processor, now a plain function called directly after extraction
 * (see extractPostingSkills.ts) instead of being queued. Idempotent: no-ops if the
 * posting is already embedded, same as before.
 */
export async function embedPosting(postingId: string): Promise<void> {
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
}
