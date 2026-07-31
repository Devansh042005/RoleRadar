import { z } from 'zod';
import { RoleCategory, ApplicationStage, Proficiency } from '@prisma/client';
import { badRequest } from './apiError';

const ROLE_CATEGORY_VALUES = Object.values(RoleCategory) as [string, ...string[]];
const APPLICATION_STAGE_VALUES = Object.values(ApplicationStage) as [string, ...string[]];
const PROFICIENCY_VALUES = Object.values(Proficiency) as [string, ...string[]];

export const roleCategorySchema = z.enum(ROLE_CATEGORY_VALUES);
export const applicationStageSchema = z.enum(APPLICATION_STAGE_VALUES);
export const proficiencySchema = z.enum(PROFICIENCY_VALUES);

/** Clamps to [min, max], defaulting when absent — never trusts raw client input. */
export function parseClampedInt(
  raw: unknown,
  { min, max, fallback }: { min: number; max: number; fallback: number },
): number {
  if (raw === undefined) return fallback;
  if (Array.isArray(raw)) throw badRequest('INVALID_QUERY_PARAM', 'Expected a single value');

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw badRequest('INVALID_QUERY_PARAM', 'Expected an integer');
  }

  return Math.min(max, Math.max(min, parsed));
}

/** Whitelists roleCategory against the known enum; rejects anything else with 400. */
export function parseOptionalRoleCategory(raw: unknown): RoleCategory | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') {
    throw badRequest('INVALID_ROLE_CATEGORY', 'roleCategory must be a string');
  }

  const result = roleCategorySchema.safeParse(raw.toUpperCase());
  if (!result.success) {
    throw badRequest(
      'INVALID_ROLE_CATEGORY',
      `roleCategory must be one of: ${ROLE_CATEGORY_VALUES.join(', ')}`,
    );
  }

  return result.data as RoleCategory;
}

const CUID_RE = /^c[a-z0-9]{20,}$/;

export function parseCuid(raw: unknown, paramName: string): string {
  if (typeof raw !== 'string' || !CUID_RE.test(raw)) {
    throw badRequest('INVALID_ID', `${paramName} is not a valid id`);
  }
  return raw;
}

/** Requires a query param to be a valid roleCategory; rejects anything else (including absence) with 400. */
export function parseRequiredRoleCategory(raw: unknown): RoleCategory {
  if (typeof raw !== 'string') {
    throw badRequest('INVALID_ROLE_CATEGORY', 'roleCategory is required and must be a string');
  }

  const result = roleCategorySchema.safeParse(raw.toUpperCase());
  if (!result.success) {
    throw badRequest(
      'INVALID_ROLE_CATEGORY',
      `roleCategory must be one of: ${ROLE_CATEGORY_VALUES.join(', ')}`,
    );
  }

  return result.data as RoleCategory;
}

/** Whitelists a query-param stage filter against the enum; rejects anything else with 400. */
export function parseOptionalApplicationStage(raw: unknown): ApplicationStage | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') {
    throw badRequest('INVALID_STAGE', 'stage must be a string');
  }

  const result = applicationStageSchema.safeParse(raw.toUpperCase());
  if (!result.success) {
    throw badRequest('INVALID_STAGE', `stage must be one of: ${APPLICATION_STAGE_VALUES.join(', ')}`);
  }

  return result.data as ApplicationStage;
}

/** Requires a body field to be a valid stage; rejects anything else (including absence) with 400. */
export function parseRequiredApplicationStage(raw: unknown): ApplicationStage {
  if (typeof raw !== 'string') {
    throw badRequest('INVALID_STAGE', 'stage is required and must be a string');
  }

  const result = applicationStageSchema.safeParse(raw.toUpperCase());
  if (!result.success) {
    throw badRequest('INVALID_STAGE', `stage must be one of: ${APPLICATION_STAGE_VALUES.join(', ')}`);
  }

  return result.data as ApplicationStage;
}

const MAX_NOTES_LENGTH = 10_000;

export function parseNotes(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw badRequest('INVALID_NOTES', 'notes must be a string');
  }
  if (raw.length > MAX_NOTES_LENGTH) {
    throw badRequest('INVALID_NOTES', `notes must be ${MAX_NOTES_LENGTH} characters or fewer`);
  }
  return raw;
}

/** Requires a body field to be a valid proficiency; rejects anything else (including absence) with 400. */
export function parseRequiredProficiency(raw: unknown): Proficiency {
  if (typeof raw !== 'string') {
    throw badRequest('INVALID_PROFICIENCY', 'proficiency is required and must be a string');
  }

  const result = proficiencySchema.safeParse(raw.toUpperCase());
  if (!result.success) {
    throw badRequest(
      'INVALID_PROFICIENCY',
      `proficiency must be one of: ${PROFICIENCY_VALUES.join(', ')}`,
    );
  }

  return result.data as Proficiency;
}

const MAX_SKILL_NAME_LENGTH = 100;

export function parseSkillName(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw badRequest('INVALID_SKILL_NAME', 'skillName is required and must be a non-empty string');
  }
  if (raw.length > MAX_SKILL_NAME_LENGTH) {
    throw badRequest('INVALID_SKILL_NAME', `skillName must be ${MAX_SKILL_NAME_LENGTH} characters or fewer`);
  }
  return raw;
}

const MAX_TARGET_ROLE_LENGTH = 200;

/** null clears the target role; undefined/omitted is rejected — PATCH must say what it wants. */
export function parseOptionalTargetRole(raw: unknown): string | null {
  if (raw === null) return null;
  if (typeof raw !== 'string') {
    throw badRequest('INVALID_TARGET_ROLE', 'targetRole must be a string or null');
  }
  if (raw.length > MAX_TARGET_ROLE_LENGTH) {
    throw badRequest(
      'INVALID_TARGET_ROLE',
      `targetRole must be ${MAX_TARGET_ROLE_LENGTH} characters or fewer`,
    );
  }
  return raw;
}

const MAX_QUESTION_LENGTH = 500;

export function parseQuestion(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw badRequest('INVALID_QUESTION', 'question is required and must be a non-empty string');
  }
  if (raw.length > MAX_QUESTION_LENGTH) {
    throw badRequest('INVALID_QUESTION', `question must be ${MAX_QUESTION_LENGTH} characters or fewer`);
  }
  return raw.trim();
}
