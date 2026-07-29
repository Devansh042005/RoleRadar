import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';

const SENIORITY_VALUES = ['junior', 'mid', 'senior', 'lead', 'staff'] as const;
const ROLE_CATEGORY_VALUES = [
  'backend',
  'frontend',
  'fullstack',
  'devops',
  'data',
  'mobile',
  'ai_ml',
  'other',
] as const;

export type Seniority = (typeof SENIORITY_VALUES)[number];
export type RoleCategory = (typeof ROLE_CATEGORY_VALUES)[number];

export interface ExtractionResult {
  required_skills: string[];
  nice_to_have_skills: string[];
  years_experience: number | null;
  seniority: Seniority | null;
  role_category: RoleCategory;
}

export class ExtractionValidationError extends Error {
  constructor(message: string, public readonly raw: unknown) {
    super(message);
    this.name = 'ExtractionValidationError';
  }
}

const SYSTEM_PROMPT = `You extract structured hiring requirements from job postings.

Return ONLY a JSON object with exactly this shape:
{
  "required_skills": string[],
  "nice_to_have_skills": string[],
  "years_experience": number | null,
  "seniority": "junior" | "mid" | "senior" | "lead" | "staff" | null,
  "role_category": "backend" | "frontend" | "fullstack" | "devops" | "data" | "mobile" | "ai_ml" | "other"
}

Rules:
- Only extract specific technology, tool, language, or framework names (e.g. "Node.js", "PostgreSQL", "Kubernetes").
- Never extract vague soft-skill phrases like "good communication", "team player", or "fast learner" — those are not technologies.
- Normalize common aliases to their canonical name before returning them: "Golang" -> "Go", "ReactJS" or "React.js" -> "React", "Postgres" -> "PostgreSQL", "k8s" -> "Kubernetes", "JS" -> "JavaScript", "TS" -> "TypeScript".
- If years of experience or seniority is not mentioned, use null.
- role_category must always be one of the listed values; pick "other" if none fit.
- Do not invent skills that are not present in the posting text.`;

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    required_skills: { type: 'array', items: { type: 'string' } },
    nice_to_have_skills: { type: 'array', items: { type: 'string' } },
    years_experience: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    seniority: {
      anyOf: [{ type: 'string', enum: [...SENIORITY_VALUES] }, { type: 'null' }],
    },
    role_category: { type: 'string', enum: [...ROLE_CATEGORY_VALUES] },
  },
  required: [
    'required_skills',
    'nice_to_have_skills',
    'years_experience',
    'seniority',
    'role_category',
  ],
  additionalProperties: false,
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isExtractionResult(value: unknown): value is ExtractionResult {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (!isStringArray(candidate.required_skills)) return false;
  if (!isStringArray(candidate.nice_to_have_skills)) return false;

  if (candidate.years_experience !== null && typeof candidate.years_experience !== 'number') {
    return false;
  }

  if (
    candidate.seniority !== null &&
    !SENIORITY_VALUES.includes(candidate.seniority as Seniority)
  ) {
    return false;
  }

  if (!ROLE_CATEGORY_VALUES.includes(candidate.role_category as RoleCategory)) {
    return false;
  }

  return true;
}

export interface ExtractionOutcome {
  result: ExtractionResult;
  raw: unknown;
}

export async function extractSkills(sanitizedText: string): Promise<ExtractionOutcome> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: sanitizedText }],
    output_config: {
      format: { type: 'json_schema', schema: EXTRACTION_SCHEMA },
    },
  });

  if (response.stop_reason === 'refusal') {
    throw new ExtractionValidationError(
      'Claude refused to extract skills for this posting',
      response,
    );
  }

  const parsed: unknown = response.parsed_output;
  if (!isExtractionResult(parsed)) {
    throw new ExtractionValidationError(
      'Claude response did not match the expected extraction shape',
      response,
    );
  }

  return { result: parsed, raw: response };
}
