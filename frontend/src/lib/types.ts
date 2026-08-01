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

// Mirrors /src/routes/applications.ts on the backend.
export const APPLICATION_STAGES = [
  "SAVED",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
] as const;

export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export interface Application {
  id: string;
  stage: ApplicationStage;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  posting: PostingSummary;
}

export interface FunnelStageCount {
  stage: ApplicationStage;
  count: number;
}

export interface FunnelStageDuration {
  stage: ApplicationStage;
  avgSeconds: number | null;
  transitionCount: number;
}

export interface FunnelResponse {
  stageCounts: FunnelStageCount[];
  avgTimeInStageSeconds: FunnelStageDuration[];
}

// Mirrors /src/routes/matching.ts, profile.ts, and ask.ts on the backend — the
// embeddings/RAG semantic layer.
export const PROFICIENCIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

export type Proficiency = (typeof PROFICIENCIES)[number];

export interface ProfileSkill {
  id: string;
  skillId: string;
  name: string;
  proficiency: Proficiency;
}

export interface ProfileResponse {
  targetRole: string | null;
  hasEmbedding: boolean;
  skills: ProfileSkill[];
}

export interface RecommendedPosting extends PostingSummary {
  /** 0-1 cosine similarity to the profile embedding — meaning-based, not a keyword
   * skill-overlap count. */
  similarity: number;
}

export interface RecommendedPostingsResponse {
  hasProfile: boolean;
  data: RecommendedPosting[];
}

export interface AskPostingSource {
  type: "posting";
  id: string;
  title: string;
  company: string;
  sourceUrl: string;
}

export interface AskDocumentSource {
  type: "document";
  id: string;
  title: string;
  sourceRef: string;
}

export type AskSource = AskPostingSource | AskDocumentSource;

export interface AskRetrievedPosting {
  type: "posting";
  id: string;
  title: string;
  company: string;
}

export interface AskRetrievedDocument {
  type: "document";
  id: string;
  title: string;
}

export type AskRetrievedItem = AskRetrievedPosting | AskRetrievedDocument;

export interface AskResponse {
  answer: string;
  insufficientData: boolean;
  sources: AskSource[];
  retrieved: AskRetrievedItem[];
}

// Mirrors /src/routes/analytics.ts's skill-gap + infer-role endpoints and
// /src/services/inferRoleCategory.ts on the backend.
export interface SkillGapCoveredSkill {
  name: string;
  /** 0-1 fraction of in-scope postings requiring/listing this skill, not 0-100. */
  demandPct: number;
}

export interface SkillGapMissingSkill extends SkillGapCoveredSkill {
  requiredInCount: number;
  niceToHaveCount: number;
}

export interface SkillGapResponse {
  roleCategory: RoleCategory;
  totalPostingsAnalyzed: number;
  insufficientData: boolean;
  inferredDefault: RoleCategory | null;
  covered: SkillGapCoveredSkill[];
  gaps: SkillGapMissingSkill[];
}

export interface InferRoleResponse {
  roleCategory: RoleCategory | null;
}
