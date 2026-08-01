import { RoleCategory } from '@prisma/client';

export const ROLE_CATEGORY_TOKENS: Record<string, RoleCategory> = {
  backend: RoleCategory.BACKEND,
  frontend: RoleCategory.FRONTEND,
  'front-end': RoleCategory.FRONTEND,
  fullstack: RoleCategory.FULLSTACK,
  'full-stack': RoleCategory.FULLSTACK,
  'full stack': RoleCategory.FULLSTACK,
  devops: RoleCategory.DEVOPS,
  mobile: RoleCategory.MOBILE,
  'machine learning': RoleCategory.AI_ML,
  'ai/ml': RoleCategory.AI_ML,
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word containment, not substring — `.includes()` alone would match a skill
 * named "R" or "C" (real language names in this DB) inside ordinary words like
 * "remote" or "fullstack", spuriously narrowing retrieval to just that one skill. */
export function containsWholeWord(haystack: string, word: string): boolean {
  return new RegExp(`(?:^|[^a-z0-9+#.])${escapeRegExp(word)}(?:$|[^a-z0-9+#.])`, 'i').test(
    haystack,
  );
}

/** Best-effort RoleCategory detection from free text (a target role, a question,
 * etc.) via whole-word token matching — shared by ask.ts's hybrid retrieval and
 * inferRoleCategory.ts's target-role check, so the two don't drift apart. */
export function detectRoleCategoryFromText(text: string): RoleCategory | undefined {
  for (const [token, category] of Object.entries(ROLE_CATEGORY_TOKENS)) {
    if (containsWholeWord(text, token)) {
      return category;
    }
  }
  return undefined;
}
