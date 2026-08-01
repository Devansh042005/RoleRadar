import 'dotenv/config';
import { prisma } from '../db/prisma';
import { ingestAllKnowledgeDocuments } from '../services/ingestKnowledgeDocument';

async function main() {
  const summary = await ingestAllKnowledgeDocuments();

  console.log(
    `${summary.documentsProcessed} documents processed, ${summary.chunksCreated} chunks created`,
  );
  for (const doc of summary.documents) {
    console.log(`  - "${doc.title}" → ${doc.chunkCount} chunks`);
  }
}

main()
  .catch((err) => {
    console.error('ingestKnowledgeDocuments script failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
