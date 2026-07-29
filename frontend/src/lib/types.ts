// Mirrors the Prisma enums / response shapes from /src/routes/analytics.ts on the backend.
export const ROLE_CATEGORIES = [
  "BACKEND",
  "FRONTEND",
  "FULLSTACK",
  "DEVOPS",
  "DATA",
  "MOBILE",
  "AI_ML",
  "OTHER",
] as const;

export type RoleCategory = (typeof ROLE_CATEGORIES)[number];

export type RequirementType = "REQUIRED" | "NICE_TO_HAVE";

export interface TrendingSkill {
  name: string;
  count: number;
  requiredCount: number;
  niceToHaveCount: number;
}

export interface PostingSkillSummary {
  name: string;
  requirementType: RequirementType;
}

export interface PostingSummary {
  id: string;
  title: string;
  location: string | null;
  postedAt: string | null;
  roleCategory: RoleCategory | null;
  seniority: string | null;
  yearsExperience: number | null;
  sourceUrl: string;
  company: { id: string; name: string };
  skills: PostingSkillSummary[];
}

export interface PostingsResponse {
  data: PostingSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface CompanyAnalytics {
  id: string;
  name: string;
  postings: Array<{
    id: string;
    title: string;
    location: string | null;
    postedAt: string | null;
    roleCategory: RoleCategory | null;
    skills: PostingSkillSummary[];
  }>;
  skillFrequency: TrendingSkill[];
}

export interface ApiErrorShape {
  error: string;
  code: string;
}
