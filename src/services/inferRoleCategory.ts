import { Prisma, RoleCategory } from '@prisma/client';
import { prisma } from '../db/prisma';
import { detectRoleCategoryFromText } from '../lib/roleCategoryTokens';

interface RoleScoreRow {
  roleCategory: RoleCategory;
  score: bigint;
}

// A user's skills are "concentrated" in a RoleCategory when postings tagged with
// that category are the ones asking for those skills most often — this is demand
// data (PostingSkill x Posting.roleCategory), not Skill.category (which is a skill
// TYPE like "language"/"framework", unrelated to job role). A REQUIRED match is
// stronger evidence of role fit than a NICE_TO_HAVE match, so it's weighted higher.
const REQUIRED_WEIGHT = 2;
const NICE_TO_HAVE_WEIGHT = 1;

// Confidence guard: below this much total weighted evidence, or without a clear
// plurality among role categories, a preselected guess would likely be wrong —
// better to return null and let the caller show an unselected dropdown.
const MIN_TOTAL_SCORE = 3;
const MIN_TOP_SHARE = 0.4;

/**
 * Infers which RoleCategory the current profile is targeting. The profile's own
 * free-text targetRole (e.g. "Frontend Engineer") is checked FIRST and wins
 * outright if it names a category — it's a direct, explicit signal from the user,
 * stronger than any inference. Only when that's absent or doesn't name a
 * recognizable category does this fall back to inferring from skill-demand
 * overlap: which RoleCategory's postings most often ask for this profile's
 * skills, via a single aggregated query over PostingSkill joined to Posting.
 * Returns null when neither signal is available or the skill-demand evidence is
 * too thin/evenly spread to trust a default.
 */
export async function inferRoleCategory(): Promise<RoleCategory | null> {
  const profile = await prisma.userProfile.findFirst();
  const fromTargetRole = profile?.targetRole
    ? (detectRoleCategoryFromText(profile.targetRole) ?? null)
    : null;
  if (fromTargetRole) return fromTargetRole;

  const profileSkills = await prisma.userSkillProfile.findMany({ select: { skillId: true } });
  const skillIds = profileSkills.map((row) => row.skillId);
  if (skillIds.length === 0) return null;

  const rows = await prisma.$queryRaw<RoleScoreRow[]>`
    SELECT
      p."roleCategory" AS "roleCategory",
      SUM(
        CASE WHEN ps."requirementType" = 'REQUIRED' THEN ${REQUIRED_WEIGHT} ELSE ${NICE_TO_HAVE_WEIGHT} END
      )::bigint AS score
    FROM "PostingSkill" ps
    JOIN "Posting" p ON p.id = ps."postingId"
    WHERE ps."skillId" IN (${Prisma.join(skillIds)})
      AND p."roleCategory" IS NOT NULL
    GROUP BY p."roleCategory"
    ORDER BY score DESC
  `;

  if (rows.length === 0) return null;

  const totalScore = rows.reduce((sum, row) => sum + Number(row.score), 0);
  const [top] = rows;
  const topShare = Number(top.score) / totalScore;

  if (totalScore < MIN_TOTAL_SCORE || topShare < MIN_TOP_SHARE) return null;

  return top.roleCategory;
}
