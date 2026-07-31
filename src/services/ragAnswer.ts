import Anthropic from '@anthropic-ai/sdk';

// This is the one place the RAG "generate" step lives — deliberately separate from
// the retrieval-only code in postingVectorSearch.ts / matching.ts, per the project's
// split between semantic matching (retrieval only) and /api/ask (retrieval + generation).
const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `You answer questions about software job postings using ONLY the numbered postings provided in the context block below. You are the generation step of a retrieval-augmented system — the postings you're given are the complete retrieved evidence for this question.

Rules:
- Answer ONLY using facts present in the numbered postings. Never use general knowledge, training data, or anything not explicitly in the context block, even if you know the answer.
- Every claim you make must cite which posting number(s) support it, e.g. "Posting #3 requires Redis".
- If the retrieved postings don't contain enough information to answer the question, say so plainly (e.g. "I don't have enough data in the retrieved postings to answer that") rather than guessing or filling gaps with outside knowledge. Set insufficient_data to true in that case.
- If the question is not about job postings, skills, companies, or hiring trends at all (e.g. general trivia, weather, personal advice), refuse: say "I can only answer questions about the job postings in your database." and set insufficient_data to true.
- Never invent a posting, company, or skill that isn't in the context block.`;

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    cited_posting_numbers: { type: 'array', items: { type: 'integer' } },
    insufficient_data: { type: 'boolean' },
  },
  required: ['answer', 'cited_posting_numbers', 'insufficient_data'],
  additionalProperties: false,
};

function isRagAnswerResult(value: unknown): value is RagAnswerResult {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.answer === 'string' &&
    Array.isArray(candidate.cited_posting_numbers) &&
    candidate.cited_posting_numbers.every((n) => typeof n === 'number') &&
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
  cited_posting_numbers: number[];
  insufficient_data: boolean;
}

export interface RagAnswer {
  answer: string;
  citedPostingNumbers: number[];
  insufficientData: boolean;
}

/**
 * GENERATE step of the RAG flow. `contextBlock` is the AUGMENT step's output (a
 * numbered, dense summary of the retrieved postings — built in ask.ts) plus the raw
 * user question. Structured output (numbered citations, not freeform text scraping)
 * is what lets the route map citations back to real posting records reliably.
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
        content: `Retrieved postings:\n\n${contextBlock}\n\nQuestion: ${question}`,
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
    citedPostingNumbers: parsed.cited_posting_numbers,
    insufficientData: parsed.insufficient_data,
  };
}
