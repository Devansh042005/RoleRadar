import 'dotenv/config';
import { prisma } from '../db/prisma';
import { enqueueEmbedding } from '../queues/embeddingQueue';

async function main() {
  // Raw query because Posting.embedding is an Unsupported("vector(384)") field —
  // invisible to the normal Prisma Client filter/select API.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Posting" WHERE "extractionStatus" = 'PROCESSED' AND embedding IS NULL
  `;

  for (const row of rows) {
    await enqueueEmbedding(row.id);
  }

  console.log(`${rows.length} postings with extracted skills but no embedding enqueued`);
}

main()
  .catch((err) => {
    console.error('backfillEmbeddings script failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
