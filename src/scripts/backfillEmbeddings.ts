import 'dotenv/config';
import { prisma } from '../db/prisma';
import { embedPosting } from '../services/embedPosting';

async function main() {
  // Raw query because Posting.embedding is an Unsupported("vector(384)") field —
  // invisible to the normal Prisma Client filter/select API.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Posting" WHERE "extractionStatus" = 'PROCESSED' AND embedding IS NULL
  `;

  // Sequential, not Promise.all — embedPosting runs a local CPU-bound model, so
  // running the whole batch concurrently would peg the process. A row failing (e.g.
  // a transient DB hiccup) shouldn't abort the rest of the backfill, so it's
  // caught and logged per-row instead of letting main()'s top-level catch bail out.
  let succeeded = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await embedPosting(row.id);
      succeeded += 1;
    } catch (err) {
      failed += 1;
      console.error(`[backfill-embeddings] posting ${row.id} failed:`, err);
    }
  }

  console.log(`${succeeded}/${rows.length} postings embedded (${failed} failed)`);
}

main()
  .catch((err) => {
    console.error('backfillEmbeddings script failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
