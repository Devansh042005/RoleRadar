import 'dotenv/config';
import { prisma } from '../db/prisma';
import { pollSource, isPollableAdapterName, POLLABLE_ADAPTER_NAMES } from '../services/pollSource';

// Runs one adapter's poll directly and waits for it to finish (fetch + ingest +
// extract + embed) — useful for testing a new adapter without waiting for its
// external cron slot. Previously enqueued through BullMQ and relied on a running
// worker to pick it up; now it's just a direct call, same as the HTTP trigger in
// routes/internalJobs.ts.
async function main() {
  const adapterName = process.argv[2];
  if (!adapterName || !isPollableAdapterName(adapterName)) {
    console.error(
      `Usage: tsx src/scripts/runSourcePollOnce.ts <${POLLABLE_ADAPTER_NAMES.join('|')}>`,
    );
    process.exitCode = 1;
    return;
  }

  const summary = await pollSource(adapterName);
  console.log(
    `${summary.fetched} postings fetched, ${summary.inserted} new, ${summary.duplicates} duplicates skipped`,
  );
}

main()
  .catch((err) => {
    console.error('runSourcePollOnce script failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
