import 'dotenv/config';
import { sourcePollWorker } from './queues/sourcePollWorker';
import { extractionWorker } from './queues/extractionWorker';
import { embeddingWorker } from './queues/embeddingWorker';

console.log(`source-poll + skill-extraction + embedding workers started (pid ${process.pid})`);

process.on('SIGTERM', async () => {
  await Promise.all([sourcePollWorker.close(), extractionWorker.close(), embeddingWorker.close()]);
  process.exit(0);
});
