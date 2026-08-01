import { Router } from 'express';
import { RoleCategory } from '@prisma/client';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { parseQuestion } from '../lib/queryValidation';
import { createRateLimiter } from '../middleware/rateLimit';
import { embed } from '../services/embeddingService';
import { vectorLiteralSql } from '../services/postingVectorSearch';
import {
  findSimilarPostingChunks,
  findSimilarDocumentChunks,
  type SimilarPostingChunkRow,
  type SimilarDocumentChunkRow,
} from '../services/chunkVectorSearch';
import { generateRagAnswer, RagAnswerError } from '../services/ragAnswer';
import { badRequest } from '../lib/apiError';
import { containsWholeWord, detectRoleCategoryFromText } from '../lib/roleCategoryTokens';

export const askRouter = Router();

// Each call here costs real Claude tokens, unlike the cached analytics/matching
// routes — a much stricter budget than the rest of the API.
const askRateLimiter = createRateLimiter({ keyPrefix: 'rl:ask', points: 10, duration: 60 });

// Retrieved separately per source (see RETRIEVE below) then merge-sorted down to
// this many total — bumped from 10 to 12 now that posting chunks and document
// chunks compete for the same slots, so a strong single-source match doesn't get
// squeezed out just because the other source also has usable results.
const RETRIEVAL_LIMIT = 12;
const POSTING_CHUNK_LIMIT = 8;
const DOCUMENT_CHUNK_LIMIT = 4;

/**
 * Light hybrid retrieval: if the question names a specific skill or role category,
 * pre-filter to postings that reference it before vector-ranking, instead of
 * ranking the whole table. Falls back to plain vector search when nothing matches.
 */
async function detectHybridFilters(
  question: string,
): Promise<{ roleCategory?: RoleCategory; skillIds?: string[] }> {
  const lowerQuestion = question.toLowerCase();

  const roleCategory = detectRoleCategoryFromText(lowerQuestion);

  const allSkills = await prisma.skill.findMany({ select: { id: true, name: true } });
  const skillIds = allSkills
    .filter((skill) => containsWholeWord(lowerQuestion, skill.name.toLowerCase()))
    .map((skill) => skill.id);

  return { roleCategory, skillIds: skillIds.length > 0 ? skillIds : undefined };
}

interface PostingContextItem {
  number: number;
  type: 'posting';
  postingId: string;
  title: string;
  companyName: string;
  sourceUrl: string;
  chunkText: string;
  distance: number;
}

interface DocumentContextItem {
  number: number;
  type: 'document';
  documentId: string;
  title: string;
  sourceRef: string;
  chunkText: string;
  distance: number;
}

type ContextItem = PostingContextItem | DocumentContextItem;

function toPostingContextItem(row: SimilarPostingChunkRow): Omit<PostingContextItem, 'number'> {
  return {
    type: 'posting',
    postingId: row.postingId,
    title: row.postingTitle,
    companyName: row.companyName,
    sourceUrl: row.sourceUrl,
    chunkText: row.chunkText,
    distance: row.distance,
  };
}

function toDocumentContextItem(row: SimilarDocumentChunkRow): Omit<DocumentContextItem, 'number'> {
  return {
    type: 'document',
    documentId: row.documentId,
    title: row.documentTitle,
    sourceRef: row.sourceRef,
    chunkText: row.chunkText,
    distance: row.distance,
  };
}

// AUGMENT step: a single numbered sequence across both source types, ordered by
// distance — not two separate number sequences — so the model can cite exactly
// which item(s) support a claim regardless of whether it came from a posting or a
// reference doc (see ragAnswer.ts's system prompt).
function buildContextBlock(items: ContextItem[]): string {
  return items
    .map((item) => {
      if (item.type === 'posting') {
        return `[${item.number}] (Posting excerpt) "${item.title}" at ${item.companyName} — "${item.chunkText}"`;
      }
      return `[${item.number}] (Reference) "${item.title}" — "${item.chunkText}"`;
    })
    .join('\n');
}

// POST /api/ask — the RAG endpoint. Retrieval + generation, as opposed to
// /api/postings/recommended which is retrieval only. See ragAnswer.ts for the
// GENERATE step and chunkVectorSearch.ts / postingVectorSearch.ts for the shared
// vector-search foundation. Retrieval here is chunk-level and dual-source (posting
// text chunks + curated knowledge-base document chunks) — distinct from
// findSimilarPostings, which ranks whole-posting embeddings for
// /api/postings/recommended and is untouched by this route.
askRouter.post(
  '/api/ask',
  askRateLimiter,
  asyncHandler(async (req, res) => {
    const question = parseQuestion(req.body?.question);

    // RETRIEVE — embed once, search both sources in parallel, merge-sort by distance.
    const questionEmbedding = await embed(question);
    const { roleCategory, skillIds } = await detectHybridFilters(question);
    const vectorSql = vectorLiteralSql(questionEmbedding);

    const [postingChunkRows, documentChunkRows] = await Promise.all([
      findSimilarPostingChunks({ vectorSql, roleCategory, skillIds, limit: POSTING_CHUNK_LIMIT }),
      findSimilarDocumentChunks({ vectorSql, limit: DOCUMENT_CHUNK_LIMIT }),
    ]);

    const merged = [
      ...postingChunkRows.map(toPostingContextItem),
      ...documentChunkRows.map(toDocumentContextItem),
    ]
      .sort((a, b) => a.distance - b.distance)
      .slice(0, RETRIEVAL_LIMIT);

    if (merged.length === 0) {
      res.json({
        answer:
          "I don't have enough data to answer that — there aren't any embedded posting or reference-document chunks yet.",
        insufficientData: true,
        sources: [],
        retrieved: [],
      });
      return;
    }

    const contextItems: ContextItem[] = merged.map((item, index) => ({ ...item, number: index + 1 }));

    // AUGMENT
    const contextBlock = buildContextBlock(contextItems);

    // GENERATE
    let ragAnswer;
    try {
      ragAnswer = await generateRagAnswer(question, contextBlock);
    } catch (err) {
      if (err instanceof RagAnswerError) {
        throw badRequest('ASK_GENERATION_FAILED', 'Could not generate an answer for this question');
      }
      throw err;
    }

    const byNumber = new Map(contextItems.map((item) => [item.number, item]));
    const sources = ragAnswer.citedSourceNumbers
      .map((n) => byNumber.get(n))
      .filter((item): item is ContextItem => Boolean(item))
      .map((item) =>
        item.type === 'posting'
          ? {
              type: 'posting' as const,
              id: item.postingId,
              title: item.title,
              company: item.companyName,
              sourceUrl: item.sourceUrl,
            }
          : {
              type: 'document' as const,
              id: item.documentId,
              title: item.title,
              sourceRef: item.sourceRef,
            },
      );

    res.json({
      answer: ragAnswer.answer,
      insufficientData: ragAnswer.insufficientData,
      sources,
      retrieved: contextItems.map((item) =>
        item.type === 'posting'
          ? { type: 'posting' as const, id: item.postingId, title: item.title, company: item.companyName }
          : { type: 'document' as const, id: item.documentId, title: item.title },
      ),
    });
  }),
);
