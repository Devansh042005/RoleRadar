import { Router } from 'express';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { cached } from '../lib/cache';
import { parseOptionalRoleCategory } from '../lib/queryValidation';
import {
  findSimilarPostings,
  hasProfileEmbedding,
  toSimilarity,
  PROFILE_EMBEDDING_SQL,
} from '../services/postingVectorSearch';
import { inferRoleCategory } from '../services/inferRoleCategory';

export const matchingRouter = Router();

const RECOMMENDED_LIMIT = 20;
const RECOMMENDED_CACHE_TTL_SECONDS = 60;

// GET /api/postings/recommended
//
// Retrieval only — no LLM call — that's what makes this feature conceptually
// distinct from /api/ask (retrieval + generation), even though both sit on the same
// embedding + pgvector foundation. Ranks postings by cosine distance between the
// stored profile embedding and each posting's embedding, hybrid-filtered first:
//   - skillIds: always restricted to postings that reference at least one of the
//     profile's own skills, when it has any — "related to my skills, nothing else"
//     has to be a hard filter, not just a ranking signal, or an unrelated posting
//     with a merely-similar-sounding title can still outrank a real match.
//   - roleCategory: an explicit ?roleCategory query param always wins (the
//     dashboard's role dropdown); otherwise falls back to the same confidence-gated
//     inferRoleCategory() the skill-gap feature uses, so the default view is also
//     scoped to the profile's role whenever that inference is confident enough to
//     trust — see inferRoleCategory.ts for the "how confident is confident" guard.
matchingRouter.get(
  '/api/postings/recommended',
  asyncHandler(async (req, res) => {
    const explicitRoleCategory = parseOptionalRoleCategory(req.query.roleCategory);

    const profile = await prisma.userProfile.findFirst();
    const hasProfile = profile ? await hasProfileEmbedding(profile.id) : false;

    if (!profile || !hasProfile) {
      res.json({ hasProfile: false, data: [] });
      return;
    }

    const roleCategory = explicitRoleCategory ?? (await inferRoleCategory()) ?? undefined;

    const skillRows = await prisma.userSkillProfile.findMany({ select: { skillId: true } });
    const skillIds = skillRows.map((row) => row.skillId);

    // Cache key includes the profile's updatedAt — bumped on every embedding
    // recompute (see profile.ts), which covers skill/target-role edits changing
    // skillIds or the inferred roleCategory — so a profile edit "invalidates" the
    // cache by simply producing a new key, rather than needing an explicit
    // invalidation mechanism the codebase doesn't otherwise have (see lib/cache.ts).
    const cacheKey = `postings:recommended:${profile.updatedAt.getTime()}:${roleCategory ?? 'all'}`;

    const data = await cached(cacheKey, RECOMMENDED_CACHE_TTL_SECONDS, async () => {
      const rows = await findSimilarPostings({
        vectorSql: PROFILE_EMBEDDING_SQL,
        roleCategory,
        skillIds,
        limit: RECOMMENDED_LIMIT,
      });

      const postingIds = rows.map((row) => row.id);
      const postingSkills = await prisma.postingSkill.findMany({
        where: { postingId: { in: postingIds } },
        include: { skill: true },
      });

      const skillsByPostingId = new Map<string, { name: string; requirementType: string }[]>();
      for (const ps of postingSkills) {
        const list = skillsByPostingId.get(ps.postingId) ?? [];
        list.push({ name: ps.skill.name, requirementType: ps.requirementType });
        skillsByPostingId.set(ps.postingId, list);
      }

      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        location: row.location,
        postedAt: row.postedAt,
        roleCategory: row.roleCategory,
        seniority: row.seniority,
        yearsExperience: row.yearsExperience,
        sourceUrl: row.sourceUrl,
        company: { id: row.companyId, name: row.companyName },
        skills: skillsByPostingId.get(row.id) ?? [],
        similarity: toSimilarity(row.distance),
      }));
    });

    res.json({ hasProfile: true, data });
  }),
);
