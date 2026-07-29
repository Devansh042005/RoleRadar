import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { cached } from '../lib/cache';
import { asyncHandler } from '../lib/asyncHandler';
import { notFound } from '../lib/apiError';
import { parseClampedInt, parseOptionalRoleCategory, parseCuid } from '../lib/queryValidation';

export const analyticsRouter = Router();

interface TrendingRow {
  name: string;
  count: number;
  requiredCount: number;
  niceToHaveCount: number;
}

// GET /api/analytics/trending
//
// One aggregated query (GROUP BY over a JOIN) rather than fetching PostingSkill rows
// and counting in JS — at 185 rows that wouldn't matter, but this is the query shape
// that has to hold up once postings are in the tens of thousands. The WHERE clause
// filters on Posting.postedAt (+ optionally roleCategory), which is exactly what the
// @@index([roleCategory, postedAt]) composite index on Posting was added for — confirmed
// via EXPLAIN that both the days-only and roleCategory+days filters use an index scan
// rather than a sequential scan. A materialized view refreshed on a schedule would be the
// next step if EXPLAIN ever shows this degrading to a seq scan at scale; not needed yet.
analyticsRouter.get(
  '/api/analytics/trending',
  asyncHandler(async (req, res) => {
    const days = parseClampedInt(req.query.days, { min: 1, max: 365, fallback: 30 });
    const limit = parseClampedInt(req.query.limit, { min: 1, max: 50, fallback: 20 });
    const roleCategory = parseOptionalRoleCategory(req.query.roleCategory);

    const cacheKey = `analytics:trending:${days}:${roleCategory ?? 'all'}:${limit}`;

    const data = await cached(cacheKey, 600, async () => {
      const rows = await prisma.$queryRaw<TrendingRow[]>`
        SELECT
          s.name AS name,
          COUNT(*)::int AS count,
          COUNT(*) FILTER (WHERE ps."requirementType" = 'REQUIRED')::int AS "requiredCount",
          COUNT(*) FILTER (WHERE ps."requirementType" = 'NICE_TO_HAVE')::int AS "niceToHaveCount"
        FROM "PostingSkill" ps
        JOIN "Posting" p ON p.id = ps."postingId"
        JOIN "Skill" s ON s.id = ps."skillId"
        WHERE p."postedAt" >= now() - make_interval(days => ${days}::int)
          ${roleCategory ? Prisma.sql`AND p."roleCategory" = ${roleCategory}::"RoleCategory"` : Prisma.empty}
        GROUP BY s.id, s.name
        ORDER BY count DESC
        LIMIT ${limit}
      `;
      return rows;
    });

    res.json(data);
  }),
);

interface PostingRow {
  id: string;
  title: string;
  location: string | null;
  postedAt: Date | null;
  roleCategory: string | null;
  seniority: string | null;
  yearsExperience: number | null;
  sourceUrl: string;
  companyId: string;
  companyName: string;
  skills: { name: string; requirementType: string }[];
  totalCount: number;
}

// GET /api/postings
//
// json_agg + COUNT(*) OVER() gets the page of postings (with company + skills already
// joined in) and the total matching count in one round trip — window functions are
// evaluated before LIMIT/OFFSET, so totalCount reflects the full filtered set, not just
// the page. Avoids a second COUNT query and avoids N+1 skill lookups per posting.
analyticsRouter.get(
  '/api/postings',
  asyncHandler(async (req, res) => {
    const limit = parseClampedInt(req.query.limit, { min: 1, max: 100, fallback: 20 });
    const offset = parseClampedInt(req.query.offset, { min: 0, max: Number.MAX_SAFE_INTEGER, fallback: 0 });
    const roleCategory = parseOptionalRoleCategory(req.query.roleCategory);

    const rows = await prisma.$queryRaw<PostingRow[]>`
      SELECT
        p.id,
        p.title,
        p.location,
        p."postedAt",
        p."roleCategory",
        p.seniority,
        p."yearsExperience",
        p."sourceUrl",
        c.id AS "companyId",
        c.name AS "companyName",
        COALESCE(
          json_agg(json_build_object('name', s.name, 'requirementType', ps."requirementType"))
            FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) AS skills,
        COUNT(*) OVER()::int AS "totalCount"
      FROM "Posting" p
      JOIN "Company" c ON c.id = p."companyId"
      LEFT JOIN "PostingSkill" ps ON ps."postingId" = p.id
      LEFT JOIN "Skill" s ON s.id = ps."skillId"
      ${roleCategory ? Prisma.sql`WHERE p."roleCategory" = ${roleCategory}::"RoleCategory"` : Prisma.empty}
      GROUP BY p.id, c.id, c.name
      ORDER BY p."postedAt" DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;

    res.json({
      data: rows.map((row) => ({
        id: row.id,
        title: row.title,
        location: row.location,
        postedAt: row.postedAt,
        roleCategory: row.roleCategory,
        seniority: row.seniority,
        yearsExperience: row.yearsExperience,
        sourceUrl: row.sourceUrl,
        company: { id: row.companyId, name: row.companyName },
        skills: row.skills,
      })),
      total: rows[0]?.totalCount ?? 0,
      limit,
      offset,
    });
  }),
);

interface CompanySkillRow {
  name: string;
  count: number;
  requiredCount: number;
  niceToHaveCount: number;
}

// GET /api/analytics/company/:companyId
//
// Two queries, not N+1: one fetches the company + its postings (with skills nested via
// a single Prisma include, which Prisma compiles to a join), the other aggregates
// company-wide skill frequency with GROUP BY. Neither runs per-row in a loop.
analyticsRouter.get(
  '/api/analytics/company/:companyId',
  asyncHandler(async (req, res) => {
    const companyId = parseCuid(req.params.companyId, 'companyId');
    const cacheKey = `analytics:company:${companyId}`;

    const data = await cached(cacheKey, 600, async () => {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          postings: {
            orderBy: { postedAt: 'desc' },
            include: { postingSkills: { include: { skill: true } } },
          },
        },
      });

      if (!company) return null;

      const skillFrequency = await prisma.$queryRaw<CompanySkillRow[]>`
        SELECT
          s.name AS name,
          COUNT(*)::int AS count,
          COUNT(*) FILTER (WHERE ps."requirementType" = 'REQUIRED')::int AS "requiredCount",
          COUNT(*) FILTER (WHERE ps."requirementType" = 'NICE_TO_HAVE')::int AS "niceToHaveCount"
        FROM "PostingSkill" ps
        JOIN "Posting" p ON p.id = ps."postingId"
        JOIN "Skill" s ON s.id = ps."skillId"
        WHERE p."companyId" = ${companyId}
        GROUP BY s.id, s.name
        ORDER BY count DESC
      `;

      return {
        id: company.id,
        name: company.name,
        postings: company.postings.map((posting) => ({
          id: posting.id,
          title: posting.title,
          location: posting.location,
          postedAt: posting.postedAt,
          roleCategory: posting.roleCategory,
          skills: posting.postingSkills.map((ps) => ({
            name: ps.skill.name,
            requirementType: ps.requirementType,
          })),
        })),
        skillFrequency,
      };
    });

    if (!data) {
      throw notFound('COMPANY_NOT_FOUND', `No company found for id ${companyId}`);
    }

    res.json(data);
  }),
);
