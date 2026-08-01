import 'dotenv/config';
import { prisma } from '../db/prisma';
import { chunkAndEmbedPosting } from '../services/chunkAndEmbedPosting';

async function main() {
  // Postings that have raw text but no PostingChunk rows yet — new postings,
  // and any postings ingested before this chunking pipeline existed.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT pr."postingId" AS id
    FROM "PostingRaw" pr
    WHERE NOT EXISTS (
      SELECT 1 FROM "PostingChunk" pc WHERE pc."postingId" = pr."postingId"
    )
  `;

  // Sequential, not Promise.all — same reasoning as backfillEmbeddings.ts: this
  // runs a local CPU-bound embedding model per chunk, and a failing posting
  // shouldn't abort the rest of the backfill.
  let succeeded = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await chunkAndEmbedPosting(row.id);
      succeeded += 1;
    } catch (err) {
      failed += 1;
      console.error(`[backfill-posting-chunks] posting ${row.id} failed:`, err);
    }
  }

  console.log(`${succeeded}/${rows.length} postings chunked (${failed} failed)`);
}

main()
  .catch((err) => {
    console.error('backfillPostingChunks script failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
