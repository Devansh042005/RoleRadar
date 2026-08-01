import { prisma } from '../db/prisma';
import { sanitizeJobText } from './textSanitizer';
import { chunkText } from './chunkText';
import { embed } from './embeddingService';
import { setPostingChunkEmbedding } from './chunkVectorSearch';

/**
 * Chunks + embeds a posting's raw text into PostingChunk rows, for /api/ask's
 * chunk-level retrieval — separate from embedPosting.ts, which builds the single
 * whole-posting embedding used by findSimilarPostings / /api/postings/recommended.
 * Called alongside embedPosting, not instead of it (see extractPostingSkills.ts).
 *
 * Idempotent by delete-then-reinsert rather than diffing: chunk count/boundaries
 * shift whenever the source text does, and re-embedding locally is free (no API
 * cost), so a full redo is simpler and just as correct as a merge.
 */
export async function chunkAndEmbedPosting(postingId: string): Promise<void> {
  const postingRaw = await prisma.postingRaw.findFirst({
    where: { postingId },
    orderBy: { createdAt: 'desc' },
  });
  if (!postingRaw) throw new Error(`No PostingRaw found for posting ${postingId}`);

  const chunks = chunkText(sanitizeJobText(postingRaw.rawText));

  await prisma.postingChunk.deleteMany({ where: { postingId } });

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const text = chunks[chunkIndex];
    const vector = await embed(text);
    const chunk = await prisma.postingChunk.create({
      data: { postingId, chunkIndex, text },
    });
    await setPostingChunkEmbedding(chunk.id, vector);
  }
}
