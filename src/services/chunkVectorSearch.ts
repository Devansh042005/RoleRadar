import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { vectorLiteralSql, buildPostingHybridFilters } from './postingVectorSearch';

// Chunk-level counterpart to postingVectorSearch.ts, for /api/ask's chunked RAG
// retrieval (PostingChunk + DocumentChunk) — unrelated to Posting.embedding /
// findSimilarPostings, which stay whole-posting, retrieval-only.

export async function setPostingChunkEmbedding(chunkId: string, vector: number[]): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "PostingChunk" SET embedding = ${vectorLiteralSql(vector)} WHERE id = ${chunkId}
  `;
}

export async function setDocumentChunkEmbedding(chunkId: string, vector: number[]): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "DocumentChunk" SET embedding = ${vectorLiteralSql(vector)} WHERE id = ${chunkId}
  `;
}

export interface SimilarPostingChunkRow {
  postingId: string;
  postingTitle: string;
  companyName: string;
  sourceUrl: string;
  chunkText: string;
  distance: number;
}

export interface FindSimilarPostingChunksParams {
  vectorSql: Prisma.Sql;
  roleCategory?: string;
  skillIds?: string[];
  limit: number;
}

/** SQL-filter + vector-rank hybrid search over posting chunks with a non-null
 * embedding — same roleCategory/skillId hybrid filters as findSimilarPostings, just
 * applied through the PostingChunk -> Posting join. */
export async function findSimilarPostingChunks({
  vectorSql,
  roleCategory,
  skillIds,
  limit,
}: FindSimilarPostingChunksParams): Promise<SimilarPostingChunkRow[]> {
  const { roleCategoryFilter, skillFilter } = buildPostingHybridFilters({ roleCategory, skillIds });

  return prisma.$queryRaw<SimilarPostingChunkRow[]>`
    SELECT
      p.id AS "postingId",
      p.title AS "postingTitle",
      c.name AS "companyName",
      p."sourceUrl",
      pc.text AS "chunkText",
      (pc.embedding <=> ${vectorSql}) AS distance
    FROM "PostingChunk" pc
    JOIN "Posting" p ON p.id = pc."postingId"
    JOIN "Company" c ON c.id = p."companyId"
    WHERE pc.embedding IS NOT NULL
      ${roleCategoryFilter}
      ${skillFilter}
    ORDER BY pc.embedding <=> ${vectorSql}
    LIMIT ${limit}
  `;
}

export interface SimilarDocumentChunkRow {
  documentId: string;
  documentTitle: string;
  sourceRef: string;
  chunkText: string;
  distance: number;
}

export interface FindSimilarDocumentChunksParams {
  vectorSql: Prisma.Sql;
  limit: number;
}

/** Plain vector-rank search over document chunks — no roleCategory/skillId
 * filters, since KnowledgeDocuments aren't posting-scoped. */
export async function findSimilarDocumentChunks({
  vectorSql,
  limit,
}: FindSimilarDocumentChunksParams): Promise<SimilarDocumentChunkRow[]> {
  return prisma.$queryRaw<SimilarDocumentChunkRow[]>`
    SELECT
      d.id AS "documentId",
      d.title AS "documentTitle",
      d."sourceRef",
      dc.text AS "chunkText",
      (dc.embedding <=> ${vectorSql}) AS distance
    FROM "DocumentChunk" dc
    JOIN "KnowledgeDocument" d ON d.id = dc."documentId"
    WHERE dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> ${vectorSql}
    LIMIT ${limit}
  `;
}
