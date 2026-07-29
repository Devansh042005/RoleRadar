import { Router } from 'express';
import { sourcePollQueue } from '../queues/sourcePollQueue';

export const internalJobsRouter = Router();

internalJobsRouter.get('/internal/jobs/status', async (_req, res) => {
  const counts = await sourcePollQueue.getJobCounts('completed', 'failed', 'active', 'waiting', 'delayed');
  res.json(counts);
});
