import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

// Posting.embedding and UserProfile.embedding are Prisma `Unsupported("vector(384)")`
// fields — invisible to the generated client. Every read or write of them goes
// through raw SQL, funneled through this module so the vector-literal formatting and
// query shape live in one place.

/** pgvector's text literal format, e.g. "[0.01,-0.02,...]" — also valid JSON. */
function formatVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

/** A `Prisma.Sql` fragment evaluating to a `vector` value, for use in ORDER BY / SELECT. */
export function vectorLiteralSql(vector: number[]): Prisma.Sql {
  return Prisma.sql`${formatVectorLiteral(vector)}::vector`;
}

/** The one profile row's embedding, referenced as a subquery so it never has to be
 * round-tripped through JS (which would mean parsing pgvector's text format back out). */
export const PROFILE_EMBEDDING_SQL = Prisma.sql`(SELECT embedding FROM "UserProfile" ORDER BY "updatedAt" DESC LIMIT 1)`;

/** Cosine distance (pgvector's `<=>`) is `1 - cosine_similarity`; invert for display. */
export function toSimilarity(distance: number): number {
  return 1 - distance;
}

export async function setPostingEmbedding(postingId: string, vector: number[]): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Posting" SET embedding = ${vectorLiteralSql(vector)} WHERE id = ${postingId}
  `;
}

export async function hasPostingEmbedding(postingId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Posting" WHERE id = ${postingId} AND embedding IS NOT NULL
  `;
  return rows.length > 0;
}

export async function setProfileEmbedding(profileId: string, vector: number[]): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "UserProfile" SET embedding = ${vectorLiteralSql(vector)}, "updatedAt" = now() WHERE id = ${profileId}
  `;
}

/** Resets the embedding to NULL — used when a profile no longer has any skills or
 * target role, so it stops being treated as embedded (hasProfileEmbedding) and stops
 * showing up in similarity search once there's nothing meaningful left to rank against. */
export async function clearProfileEmbedding(profileId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "UserProfile" SET embedding = NULL, "updatedAt" = now() WHERE id = ${profileId}
  `;
}

export async function hasProfileEmbedding(profileId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "UserProfile" WHERE id = ${profileId} AND embedding IS NOT NULL
  `;
  return rows.length > 0;
}

export interface SimilarPostingRow {
  id: string;
  title: string;
  location: string | null;
  sourceUrl: string;
  postedAt: Date | null;
  roleCategory: string | null;
  seniority: string | null;
  yearsExperience: number | null;
  companyId: string;
  companyName: string;
  distance: number;
}

export interface FindSimilarPostingsParams {
  /** A Prisma.Sql fragment evaluating to a `vector` — a literal (vectorLiteralSql) or
   * a subquery (PROFILE_EMBEDDING_SQL). */
  vectorSql: Prisma.Sql;
  roleCategory?: string;
  /** Hybrid retrieval: SQL-filter to postings that reference any of these skill ids
   * before vector-ranking, rather than ranking the whole table. */
  skillIds?: string[];
  limit: number;
}

/** SQL-filter + vector-rank hybrid search over postings with a non-null embedding. */
export async function findSimilarPostings({
  vectorSql,
  roleCategory,
  skillIds,
  limit,
}: FindSimilarPostingsParams): Promise<SimilarPostingRow[]> {
  const roleCategoryFilter = roleCategory
    ? Prisma.sql`AND p."roleCategory" = ${roleCategory}::"RoleCategory"`
    : Prisma.empty;

  const skillFilter =
    skillIds && skillIds.length > 0
      ? Prisma.sql`AND p.id IN (
          SELECT DISTINCT ps."postingId" FROM "PostingSkill" ps WHERE ps."skillId" IN (${Prisma.join(skillIds)})
        )`
      : Prisma.empty;

  return prisma.$queryRaw<SimilarPostingRow[]>`
    SELECT
      p.id,
      p.title,
      p.location,
      p."sourceUrl",
      p."postedAt",
      p."roleCategory",
      p.seniority,
      p."yearsExperience",
      c.id AS "companyId",
      c.name AS "companyName",
      (p.embedding <=> ${vectorSql}) AS distance
    FROM "Posting" p
    JOIN "Company" c ON c.id = p."companyId"
    WHERE p.embedding IS NOT NULL
      ${roleCategoryFilter}
      ${skillFilter}
    ORDER BY p.embedding <=> ${vectorSql}
    LIMIT ${limit}
  `;
}
