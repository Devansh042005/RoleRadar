import { sanitizeJobText } from './textSanitizer';

const RAW_TEXT_SLICE_LENGTH = 500;

export interface PostingEmbeddingInput {
  title: string;
  companyName: string;
  roleCategory: string | null;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  rawText: string;
}

/**
 * What we embed for a posting, and why: title + company + role category + extracted
 * skills are dense signal that directly drives match quality. The raw JD is mostly
 * boilerplate ("we're a fast-paced team...") — noise for embedding purposes — so we
 * only take a short sanitized slice of it for whatever residual context (stack
 * mentions, domain specifics) the structured fields don't capture, rather than
 * embedding the full JD.
 */
export function buildPostingEmbeddingDocument(input: PostingEmbeddingInput): string {
  const parts = [
    input.title,
    `at ${input.companyName}`,
    input.roleCategory ? `Role category: ${input.roleCategory}.` : null,
    input.requiredSkills.length > 0 ? `Required skills: ${input.requiredSkills.join(', ')}.` : null,
    input.niceToHaveSkills.length > 0
      ? `Nice to have: ${input.niceToHaveSkills.join(', ')}.`
      : null,
    sanitizeJobText(input.rawText).slice(0, RAW_TEXT_SLICE_LENGTH),
  ].filter((part): part is string => Boolean(part && part.trim().length > 0));

  return parts.join(' ');
}

export interface ProfileEmbeddingInput {
  targetRole: string | null;
  skills: Array<{ name: string; proficiency: string }>;
}

/**
 * What we embed for a user profile: target role plus each skill with its
 * proficiency, so "advanced Node.js" and "beginner Node.js" produce different
 * vectors — proficiency is signal for how strong a semantic match should read, not
 * just whether the skill is present at all.
 */
export function buildProfileEmbeddingDocument(input: ProfileEmbeddingInput): string {
  const parts = [
    input.targetRole ? `Target role: ${input.targetRole}.` : null,
    input.skills.length > 0
      ? `Skills: ${input.skills.map((s) => `${s.name} (${s.proficiency.toLowerCase()})`).join(', ')}.`
      : null,
  ].filter((part): part is string => Boolean(part));

  return parts.join(' ');
}
