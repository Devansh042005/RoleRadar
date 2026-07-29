import 'dotenv/config';
import { prisma } from '../db/prisma';
import { RemoteOkAdapter } from '../adapters/remoteOkAdapter';
import { ingestPostings } from '../services/ingestPostings';

async function main() {
  const postings = await RemoteOkAdapter.fetch();
  const summary = await ingestPostings(postings);

  console.log(
    `${summary.fetched} postings fetched, ${summary.inserted} new, ${summary.duplicates} duplicates skipped`,
  );
}

main()
  .catch((err) => {
    console.error('testRemoteOk script failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
