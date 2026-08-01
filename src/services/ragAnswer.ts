import Anthropic from '@anthropic-ai/sdk';

// This is the one place the RAG "generate" step lives — deliberately separate from
// the retrieval-only code in postingVectorSearch.ts / matching.ts, per the project's
// split between semantic matching (retrieval only) and /api/ask (retrieval + generation).
const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `You answer questions about software job postings and job-market topics using ONLY the numbered context items provided below. You are the generation step of a retrieval-augmented system — the context you're given is the complete retrieved evidence for this question.

Each numbered context item is either a posting excerpt (a chunk of text from a real job posting) or a reference-document excerpt (a chunk of a curated knowledge-base article). Both kinds of items are valid evidence — cite whichever numbered item(s) support each claim regardless of which type it is.

Rules:
- Answer ONLY using facts present in the numbered context items. Never use general knowledge, training data, or anything not explicitly in the context block, even if you know the answer.
- Every claim you make must cite which context item number(s) support it, e.g. "Item #3 requires Redis" or "Item #5 explains this."
- If the retrieved context doesn't contain enough information to answer the question, say so plainly (e.g. "I don't have enough data in the retrieved context to answer that") rather than guessing or filling gaps with outside knowledge. Set insufficient_data to true in that case.
- If the question is not about job postings, skills, companies, hiring trends, or the job-market topics covered by the reference documents (e.g. general trivia, weather, personal advice), refuse: say "I can only answer questions about the job postings and reference material in your database." and set insufficient_data to true.
- Never invent a posting, company, skill, or reference document that isn't in the context block.`;

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    cited_source_numbers: { type: 'array', items: { type: 'integer' } },
    insufficient_data: { type: 'boolean' },
  },
  required: ['answer', 'cited_source_numbers', 'insufficient_data'],
  additionalProperties: false,
};

function isRagAnswerResult(value: unknown): value is RagAnswerResult {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.answer === 'string' &&
    Array.isArray(candidate.cited_source_numbers) &&
    candidate.cited_source_numbers.every((n) => typeof n === 'number') &&
    typeof candidate.insufficient_data === 'boolean'
  );
}

export class RagAnswerError extends Error {
  constructor(message: string, public readonly raw: unknown) {
    super(message);
    this.name = 'RagAnswerError';
  }
}

interface RagAnswerResult {
  answer: string;
  cited_source_numbers: number[];
  insufficient_data: boolean;
}

export interface RagAnswer {
  answer: string;
  citedSourceNumbers: number[];
  insufficientData: boolean;
}

/**
 * GENERATE step of the RAG flow. `contextBlock` is the AUGMENT step's output (a
 * numbered block mixing posting-chunk and reference-document-chunk excerpts —
 * built in ask.ts) plus the raw user question. Structured output (numbered
 * citations, not freeform text scraping) is what lets the route map citations back
 * to real posting/document records reliably.
 */
export async function generateRagAnswer(question: string, contextBlock: string): Promise<RagAnswer> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Retrieved context:\n\n${contextBlock}\n\nQuestion: ${question}`,
      },
    ],
    output_config: {
      format: { type: 'json_schema', schema: ANSWER_SCHEMA },
    },
  });

  if (response.stop_reason === 'refusal') {
    throw new RagAnswerError('Claude refused to answer this question', response);
  }

  const parsed: unknown = response.parsed_output;
  if (!isRagAnswerResult(parsed)) {
    throw new RagAnswerError('Claude response did not match the expected answer shape', response);
  }

  return {
    answer: parsed.answer,
    citedSourceNumbers: parsed.cited_source_numbers,
    insufficientData: parsed.insufficient_data,
  };
}
