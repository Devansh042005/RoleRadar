import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { internalOnly } from '../middleware/internalAuth';
import { pollSource, parsePollableAdapterName } from '../services/pollSource';

export const internalJobsRouter = Router();

internalJobsRouter.use(internalOnly);

// POST /internal/jobs/poll/:adapterName — replaces the old GET /internal/jobs/status
// (which reported BullMQ queue counts; there's no queue left to report on). This is
// now the actual trigger, not a status check: fetch + ingest + extract + embed all
// run synchronously within this one request (see pollSource.ts). Call it from an
// external scheduler (cron) instead of relying on an in-process repeatable job.
internalJobsRouter.post(
  '/internal/jobs/poll/:adapterName',
  asyncHandler(async (req, res) => {
    const adapterName = parsePollableAdapterName(req.params.adapterName);
    const summary = await pollSource(adapterName);
    res.json(summary);
  }),
);
