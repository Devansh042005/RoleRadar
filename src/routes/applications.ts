import { Router } from 'express';
import { ApplicationStage, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { notFound } from '../lib/apiError';
import { cached } from '../lib/cache';
import {
  parseCuid,
  parseOptionalApplicationStage,
  parseRequiredApplicationStage,
  parseNotes,
} from '../lib/queryValidation';
import { createRateLimiter } from '../middleware/rateLimit';

export const applicationsRouter = Router();

// Mutations (save/move/edit/delete) get a stricter budget than reads — same pattern as
// the analytics aggregation routes in Phase 5, just applied to writes instead of heavy
// GETs here, since a runaway drag-and-drop retry loop or buggy client is the realistic
// abuse case for this router.
const mutationRateLimiter = createRateLimiter({
  keyPrefix: 'rl:applications-write',
  points: 20,
  duration: 60,
});

function isUniqueConstraintViolation(err: unknown, target: string): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    (err.meta?.target as string[] | undefined)?.includes(target) === true
  );
}

const postingSelect = {
  id: true,
  title: true,
  location: true,
  sourceUrl: true,
  postedAt: true,
  roleCategory: true,
  seniority: true,
  yearsExperience: true,
  company: { select: { id: true, name: true } },
  postingSkills: { select: { requirementType: true, skill: { select: { name: true } } } },
} satisfies Prisma.PostingSelect;

function serializeApplication(app: {
  id: string;
  stage: ApplicationStage;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  posting: Prisma.PostingGetPayload<{ select: typeof postingSelect }>;
}) {
  return {
    id: app.id,
    stage: app.stage,
    notes: app.notes,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    posting: {
      id: app.posting.id,
      title: app.posting.title,
      location: app.posting.location,
      sourceUrl: app.posting.sourceUrl,
      postedAt: app.posting.postedAt,
      roleCategory: app.posting.roleCategory,
      seniority: app.posting.seniority,
      yearsExperience: app.posting.yearsExperience,
      company: app.posting.company,
      skills: app.posting.postingSkills.map((ps) => ({
        name: ps.skill.name,
        requirementType: ps.requirementType,
      })),
    },
  };
}

// POST /api/applications
//
// Saving is find-or-create: check first (fast common path), and fall back to a
// re-fetch on a unique-constraint race (two concurrent saves of the same posting) —
// the @@unique([postingId]) constraint is the real guarantee, this is just avoiding an
// unnecessary 500 when that race actually happens.
applicationsRouter.post(
  '/api/applications',
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const postingId = parseCuid(req.body?.postingId, 'postingId');

    const existing = await prisma.application.findUnique({
      where: { postingId },
      include: { posting: { select: postingSelect } },
    });
    if (existing) {
      res.status(200).json(serializeApplication(existing));
      return;
    }

    const posting = await prisma.posting.findUnique({ where: { id: postingId } });
    if (!posting) {
      throw notFound('POSTING_NOT_FOUND', `No posting found for id ${postingId}`);
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        const application = await tx.application.create({
          data: { postingId, stage: ApplicationStage.SAVED },
          include: { posting: { select: postingSelect } },
        });
        await tx.applicationStageHistory.create({
          data: { applicationId: application.id, stage: ApplicationStage.SAVED },
        });
        return application;
      });

      res.status(201).json(serializeApplication(created));
    } catch (err) {
      if (isUniqueConstraintViolation(err, 'postingId')) {
        const raceWinner = await prisma.application.findUniqueOrThrow({
          where: { postingId },
          include: { posting: { select: postingSelect } },
        });
        res.status(200).json(serializeApplication(raceWinner));
        return;
      }
      throw err;
    }
  }),
);

// GET /api/applications
//
// No caching here, unlike the analytics routes: this data is user-specific and
// mutates on nearly every interaction (drag a card, edit notes, delete). A Redis
// cache would fight with the frontend's post-mutation invalidation and serve a stale
// kanban board right after the user just changed it — correctness over speed for this
// endpoint, so we always read through to Postgres.
applicationsRouter.get(
  '/api/applications',
  asyncHandler(async (req, res) => {
    const stage = parseOptionalApplicationStage(req.query.stage);

    const applications = await prisma.application.findMany({
      where: stage ? { stage } : undefined,
      include: { posting: { select: postingSelect } },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(applications.map(serializeApplication));
  }),
);

// GET /api/applications/funnel
//
// Two aggregated queries (not a JS loop over rows): current stage counts straight off
// Application, and average time-in-stage off ApplicationStageHistory using a LAG()
// window function to pair each transition with the one before it. They're two queries
// because they aggregate genuinely different things — a live snapshot vs. historical
// transition durations — not because either one loops per-row.
applicationsRouter.get(
  '/api/applications/funnel',
  asyncHandler(async (_req, res) => {
    const data = await cached('applications:funnel', 20, async () => {
      const [countRows, durationRows] = await Promise.all([
        prisma.application.groupBy({ by: ['stage'], _count: { _all: true } }),
        prisma.$queryRaw<{ stage: ApplicationStage; avgSeconds: number; transitionCount: number }[]>`
          WITH transitions AS (
            SELECT
              stage,
              "changedAt",
              LEAD("changedAt") OVER (PARTITION BY "applicationId" ORDER BY "changedAt") AS "nextChangedAt"
            FROM "ApplicationStageHistory"
          )
          SELECT
            stage,
            AVG(EXTRACT(EPOCH FROM ("nextChangedAt" - "changedAt")))::float AS "avgSeconds",
            COUNT(*)::int AS "transitionCount"
          FROM transitions
          WHERE "nextChangedAt" IS NOT NULL
          GROUP BY stage
        `,
      ]);

      const countByStage = new Map(countRows.map((row) => [row.stage, row._count._all]));
      const durationByStage = new Map(durationRows.map((row) => [row.stage, row]));

      const stages = Object.values(ApplicationStage);

      return {
        stageCounts: stages.map((stage) => ({ stage, count: countByStage.get(stage) ?? 0 })),
        avgTimeInStageSeconds: stages.map((stage) => ({
          stage,
          avgSeconds: durationByStage.get(stage)?.avgSeconds ?? null,
          transitionCount: durationByStage.get(stage)?.transitionCount ?? 0,
        })),
      };
    });

    res.json(data);
  }),
);

// PATCH /api/applications/:id/stage
//
// Append-only: the history row is always inserted, never updated in place, so this
// table can power funnel/time-in-stage analytics later without having lost the trail.
applicationsRouter.patch(
  '/api/applications/:id/stage',
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const id = parseCuid(req.params.id, 'id');
    const stage = parseRequiredApplicationStage(req.body?.stage);

    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) {
      throw notFound('APPLICATION_NOT_FOUND', `No application found for id ${id}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.application.update({
        where: { id },
        data: { stage },
        include: { posting: { select: postingSelect } },
      });
      await tx.applicationStageHistory.create({
        data: { applicationId: id, stage },
      });
      return app;
    });

    res.json(serializeApplication(updated));
  }),
);

// PATCH /api/applications/:id/notes
applicationsRouter.patch(
  '/api/applications/:id/notes',
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const id = parseCuid(req.params.id, 'id');
    const notes = parseNotes(req.body?.notes);

    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) {
      throw notFound('APPLICATION_NOT_FOUND', `No application found for id ${id}`);
    }

    const updated = await prisma.application.update({
      where: { id },
      data: { notes },
      include: { posting: { select: postingSelect } },
    });

    res.json(serializeApplication(updated));
  }),
);

// DELETE /api/applications/:id
//
// Hard delete, not soft delete: once a user removes a card from their pipeline there's
// no product need to keep it around (no "trash" / undo UI), and ApplicationStageHistory
// rows cascade at the DB level (onDelete: Cascade in schema.prisma) rather than being
// deleted manually here.
applicationsRouter.delete(
  '/api/applications/:id',
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const id = parseCuid(req.params.id, 'id');

    try {
      await prisma.application.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw notFound('APPLICATION_NOT_FOUND', `No application found for id ${id}`);
      }
      throw err;
    }

    res.status(204).send();
  }),
);

