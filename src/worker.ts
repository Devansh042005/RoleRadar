import 'dotenv/config';
import { sourcePollWorker } from './queues/sourcePollWorker';
import { extractionWorker } from './queues/extractionWorker';

console.log(`source-poll + skill-extraction workers started (pid ${process.pid})`);

process.on('SIGTERM', async () => {
  await Promise.all([sourcePollWorker.close(), extractionWorker.close()]);
  process.exit(0);
});
