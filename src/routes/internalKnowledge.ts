import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { internalOnly } from '../middleware/internalAuth';
import { ingestAllKnowledgeDocuments } from '../services/ingestKnowledgeDocument';

export const internalKnowledgeRouter = Router();

internalKnowledgeRouter.use(internalOnly);

// POST /internal/knowledge/ingest — re-runs ingestion over every markdown file
// under /knowledge-base, same internalOnly-protected, run-synchronously-in-one-
// request pattern as /internal/jobs/poll/:adapterName. Lets the knowledge-base
// corpus be re-ingested after an edit without redeploying.
internalKnowledgeRouter.post(
  '/internal/knowledge/ingest',
  asyncHandler(async (_req, res) => {
    const summary = await ingestAllKnowledgeDocuments();
    res.json(summary);
  }),
);
