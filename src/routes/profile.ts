import { Router } from 'express';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { notFound } from '../lib/apiError';
import { parseCuid, parseRequiredProficiency, parseSkillName, parseOptionalTargetRole } from '../lib/queryValidation';
import { createRateLimiter } from '../middleware/rateLimit';
import { normalizeSkill } from '../services/skillTaxonomy';
import { embed } from '../services/embeddingService';
import { buildProfileEmbeddingDocument } from '../services/embeddingDocument';
import { setProfileEmbedding, hasProfileEmbedding } from '../services/postingVectorSearch';

export const profileRouter = Router();

// This app is single-tenant (no User model anywhere in the schema) — profile and
// profile-skills mutations aren't especially high-volume, but a runaway client retry
// loop is still worth capping, same reasoning as applications.ts's write limiter.
const mutationRateLimiter = createRateLimiter({
  keyPrefix: 'rl:profile-write',
  points: 20,
  duration: 60,
});

/** The one UserProfile row. Created on first write since it has no natural key. */
async function getOrCreateProfile() {
  const existing = await prisma.userProfile.findFirst();
  if (existing) return existing;
  return prisma.userProfile.create({ data: {} });
}

/**
 * Recomputes and stores the profile embedding after any skill or target-role change.
 * Synchronous (not queued): this is a single quick local embed, not an LLM call, so
 * there's no latency/cost reason to push it onto a queue the way posting extraction is.
 */
async function recomputeProfileEmbedding(): Promise<void> {
  const profile = await getOrCreateProfile();
  const skillRows = await prisma.userSkillProfile.findMany({ include: { skill: true } });

  const document = buildProfileEmbeddingDocument({
    targetRole: profile.targetRole,
    skills: skillRows.map((row) => ({ name: row.skill.name, proficiency: row.proficiency })),
  });

  if (document.trim().length === 0) {
    // No skills and no target role yet — nothing meaningful to embed.
    return;
  }

  const vector = await embed(document);
  await setProfileEmbedding(profile.id, vector);
}

async function serializeProfile() {
  const profile = await getOrCreateProfile();
  const skillRows = await prisma.userSkillProfile.findMany({
    include: { skill: true },
    orderBy: { createdAt: 'asc' },
  });

  return {
    targetRole: profile.targetRole,
    hasEmbedding: await hasProfileEmbedding(profile.id),
    skills: skillRows.map((row) => ({
      id: row.id,
      skillId: row.skillId,
      name: row.skill.name,
      proficiency: row.proficiency,
    })),
  };
}

// GET /api/profile
profileRouter.get(
  '/api/profile',
  asyncHandler(async (_req, res) => {
    res.json(await serializeProfile());
  }),
);

// POST /api/profile/skills
profileRouter.post(
  '/api/profile/skills',
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const skillName = parseSkillName(req.body?.skillName);
    const proficiency = parseRequiredProficiency(req.body?.proficiency);

    const skill = await normalizeSkill(skillName);

    const existing = await prisma.userSkillProfile.findFirst({ where: { skillId: skill.id } });
    if (existing) {
      await prisma.userSkillProfile.update({ where: { id: existing.id }, data: { proficiency } });
    } else {
      await prisma.userSkillProfile.create({ data: { skillId: skill.id, proficiency } });
    }

    await recomputeProfileEmbedding();

    res.status(existing ? 200 : 201).json(await serializeProfile());
  }),
);

// DELETE /api/profile/skills/:id
profileRouter.delete(
  '/api/profile/skills/:id',
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const id = parseCuid(req.params.id, 'id');

    const existing = await prisma.userSkillProfile.findUnique({ where: { id } });
    if (!existing) {
      throw notFound('SKILL_NOT_FOUND', `No profile skill found for id ${id}`);
    }

    await prisma.userSkillProfile.delete({ where: { id } });
    await recomputeProfileEmbedding();

    res.status(204).send();
  }),
);

// PATCH /api/profile — currently just targetRole, kept as its own field so future
// profile-level fields can be added without touching the skills endpoints.
profileRouter.patch(
  '/api/profile',
  mutationRateLimiter,
  asyncHandler(async (req, res) => {
    const targetRole = parseOptionalTargetRole(req.body?.targetRole);

    const profile = await getOrCreateProfile();
    await prisma.userProfile.update({ where: { id: profile.id }, data: { targetRole } });
    await recomputeProfileEmbedding();

    res.json(await serializeProfile());
  }),
);
