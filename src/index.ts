import 'dotenv/config';
import express from 'express';
import { healthRouter } from './routes/health';
import { internalJobsRouter } from './routes/internalJobs';
import { internalExtractionRouter } from './routes/internalExtraction';
import { scheduleSourcePolling } from './queues/sourcePollQueue';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());
app.use(healthRouter);
app.use(internalJobsRouter);
app.use(internalExtractionRouter);

app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  await scheduleSourcePolling();
  console.log('source-poll repeatable job registered');
});
