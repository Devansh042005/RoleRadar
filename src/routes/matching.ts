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

export const matchingRouter = Router();

const RECOMMENDED_LIMIT = 20;
const RECOMMENDED_CACHE_TTL_SECONDS = 60;

// GET /api/postings/recommended
//
// Retrieval only — no LLM call — that's what makes this feature conceptually
// distinct from /api/ask (retrieval + generation), even though both sit on the same
// embedding + pgvector foundation. Ranks postings by cosine distance between the
// stored profile embedding and each posting's embedding, optionally SQL-filtered by
// roleCategory first (hybrid: filter then vector-rank, same pattern as the RAG
// retrieval step in ask.ts).
matchingRouter.get(
  '/api/postings/recommended',
  asyncHandler(async (req, res) => {
    const roleCategory = parseOptionalRoleCategory(req.query.roleCategory);

    const profile = await prisma.userProfile.findFirst();
    const hasProfile = profile ? await hasProfileEmbedding(profile.id) : false;

    if (!profile || !hasProfile) {
      res.json({ hasProfile: false, data: [] });
      return;
    }

    // Cache key includes the profile's updatedAt — bumped on every embedding
    // recompute (see profile.ts) — so a profile edit "invalidates" the cache by
    // simply producing a new key, rather than needing an explicit invalidation
    // mechanism the codebase doesn't otherwise have (see lib/cache.ts).
    const cacheKey = `postings:recommended:${profile.updatedAt.getTime()}:${roleCategory ?? 'all'}`;

    const data = await cached(cacheKey, RECOMMENDED_CACHE_TTL_SECONDS, async () => {
      const rows = await findSimilarPostings({
        vectorSql: PROFILE_EMBEDDING_SQL,
        roleCategory,
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
