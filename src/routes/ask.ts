import { Router } from 'express';
import { RoleCategory } from '@prisma/client';
import { prisma } from '../db/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { parseQuestion } from '../lib/queryValidation';
import { createRateLimiter } from '../middleware/rateLimit';
import { embed } from '../services/embeddingService';
import { findSimilarPostings, vectorLiteralSql } from '../services/postingVectorSearch';
import { generateRagAnswer, RagAnswerError } from '../services/ragAnswer';
import { badRequest } from '../lib/apiError';
import { containsWholeWord, detectRoleCategoryFromText } from '../lib/roleCategoryTokens';

export const askRouter = Router();

// Each call here costs real Claude tokens, unlike the cached analytics/matching
// routes — a much stricter budget than the rest of the API.
const askRateLimiter = createRateLimiter({ keyPrefix: 'rl:ask', points: 10, duration: 60 });

const RETRIEVAL_LIMIT = 10;

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

interface ContextPosting {
  number: number;
  id: string;
  title: string;
  companyName: string;
  location: string | null;
  roleCategory: string | null;
  seniority: string | null;
  sourceUrl: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
}

// AUGMENT step: structured fields only, no raw JD text — dense and token-efficient,
// and each posting is numbered so the model can cite exactly which one(s) support a
// claim (see ragAnswer.ts's system prompt).
function buildContextBlock(postings: ContextPosting[]): string {
  return postings
    .map((p) => {
      const skillsLine =
        [
          p.requiredSkills.length > 0 ? `required: ${p.requiredSkills.join(', ')}` : null,
          p.niceToHaveSkills.length > 0 ? `nice-to-have: ${p.niceToHaveSkills.join(', ')}` : null,
        ]
          .filter(Boolean)
          .join('; ') || 'none extracted';

      return `[${p.number}] "${p.title}" at ${p.companyName} (${p.location ?? 'location unspecified'}). Role category: ${
        p.roleCategory ?? 'unspecified'
      }. Seniority: ${p.seniority ?? 'unspecified'}. Skills — ${skillsLine}.`;
    })
    .join('\n');
}

// POST /api/ask — the RAG endpoint. Retrieval + generation, as opposed to
// /api/postings/recommended which is retrieval only. See ragAnswer.ts for the
// GENERATE step and postingVectorSearch.ts for the shared vector-search foundation.
askRouter.post(
  '/api/ask',
  askRateLimiter,
  asyncHandler(async (req, res) => {
    const question = parseQuestion(req.body?.question);

    // RETRIEVE
    const questionEmbedding = await embed(question);
    const { roleCategory, skillIds } = await detectHybridFilters(question);

    const rows = await findSimilarPostings({
      vectorSql: vectorLiteralSql(questionEmbedding),
      roleCategory,
      skillIds,
      limit: RETRIEVAL_LIMIT,
    });

    if (rows.length === 0) {
      res.json({
        answer:
          "I don't have enough data in the retrieved postings to answer that — there aren't any embedded postings yet.",
        insufficientData: true,
        sources: [],
        retrieved: [],
      });
      return;
    }

    const postingSkills = await prisma.postingSkill.findMany({
      where: { postingId: { in: rows.map((r) => r.id) } },
      include: { skill: true },
    });
    const skillsByPostingId = new Map<
      string,
      { required: string[]; niceToHave: string[] }
    >();
    for (const ps of postingSkills) {
      const entry = skillsByPostingId.get(ps.postingId) ?? { required: [], niceToHave: [] };
      if (ps.requirementType === 'REQUIRED') entry.required.push(ps.skill.name);
      else entry.niceToHave.push(ps.skill.name);
      skillsByPostingId.set(ps.postingId, entry);
    }

    const contextPostings: ContextPosting[] = rows.map((row, index) => ({
      number: index + 1,
      id: row.id,
      title: row.title,
      companyName: row.companyName,
      location: row.location,
      roleCategory: row.roleCategory,
      seniority: row.seniority,
      sourceUrl: row.sourceUrl,
      requiredSkills: skillsByPostingId.get(row.id)?.required ?? [],
      niceToHaveSkills: skillsByPostingId.get(row.id)?.niceToHave ?? [],
    }));

    // AUGMENT
    const contextBlock = buildContextBlock(contextPostings);

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

    const byNumber = new Map(contextPostings.map((p) => [p.number, p]));
    const sources = ragAnswer.citedPostingNumbers
      .map((n) => byNumber.get(n))
      .filter((p): p is ContextPosting => Boolean(p))
      .map((p) => ({ id: p.id, title: p.title, company: p.companyName, sourceUrl: p.sourceUrl }));

    res.json({
      answer: ragAnswer.answer,
      insufficientData: ragAnswer.insufficientData,
      sources,
      retrieved: contextPostings.map((p) => ({ id: p.id, title: p.title, company: p.companyName })),
    });
  }),
);
