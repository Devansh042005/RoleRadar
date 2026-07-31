import axios, { AxiosError } from "axios";
import { toast } from "sonner";
import type {
  ApiErrorShape,
  Application,
  ApplicationStage,
  AskResponse,
  CompanyAnalytics,
  FunnelResponse,
  InferRoleResponse,
  PostingsResponse,
  Proficiency,
  ProfileResponse,
  RecommendedPostingsResponse,
  RoleCategory,
  SkillGapResponse,
  TrendingSkill,
} from "./types";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000",
  timeout: 10_000,
});

let lastRateLimitToastAt = 0;

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorShape>) => {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers["retry-after"];
      const seconds = Number(retryAfter);
      const now = Date.now();

      // Multiple in-flight requests can all 429 at once — avoid stacking toasts.
      if (now - lastRateLimitToastAt > 2000) {
        lastRateLimitToastAt = now;
        toast.warning("Slow down a little", {
          description: Number.isFinite(seconds)
            ? `Too many requests — try again in ${seconds}s.`
            : "Too many requests — please try again shortly.",
        });
      }
    }

    return Promise.reject(error);
  },
);

export interface TrendingParams {
  days?: number;
  roleCategory?: RoleCategory;
  limit?: number;
}

export async function fetchTrending(params: TrendingParams): Promise<TrendingSkill[]> {
  const { data } = await apiClient.get<TrendingSkill[]>("/api/analytics/trending", { params });
  return data;
}

export interface PostingsParams {
  limit?: number;
  offset?: number;
  roleCategory?: RoleCategory;
}

export async function fetchPostings(params: PostingsParams): Promise<PostingsResponse> {
  const { data } = await apiClient.get<PostingsResponse>("/api/postings", { params });
  return data;
}

export async function fetchCompanyAnalytics(companyId: string): Promise<CompanyAnalytics> {
  const { data } = await apiClient.get<CompanyAnalytics>(`/api/analytics/company/${companyId}`);
  return data;
}

export async function createApplication(postingId: string): Promise<Application> {
  const { data } = await apiClient.post<Application>("/api/applications", { postingId });
  return data;
}

export async function fetchApplications(stage?: ApplicationStage): Promise<Application[]> {
  const { data } = await apiClient.get<Application[]>("/api/applications", {
    params: stage ? { stage } : undefined,
  });
  return data;
}

export async function updateApplicationStage(
  id: string,
  stage: ApplicationStage,
): Promise<Application> {
  const { data } = await apiClient.patch<Application>(`/api/applications/${id}/stage`, { stage });
  return data;
}

export async function updateApplicationNotes(id: string, notes: string): Promise<Application> {
  const { data } = await apiClient.patch<Application>(`/api/applications/${id}/notes`, { notes });
  return data;
}

export async function deleteApplication(id: string): Promise<void> {
  await apiClient.delete(`/api/applications/${id}`);
}

export async function fetchFunnel(): Promise<FunnelResponse> {
  const { data } = await apiClient.get<FunnelResponse>("/api/applications/funnel");
  return data;
}

export async function fetchProfile(): Promise<ProfileResponse> {
  const { data } = await apiClient.get<ProfileResponse>("/api/profile");
  return data;
}

export async function addProfileSkill(
  skillName: string,
  proficiency: Proficiency,
): Promise<ProfileResponse> {
  const { data } = await apiClient.post<ProfileResponse>("/api/profile/skills", {
    skillName,
    proficiency,
  });
  return data;
}

export async function deleteProfileSkill(id: string): Promise<void> {
  await apiClient.delete(`/api/profile/skills/${id}`);
}

export async function updateTargetRole(targetRole: string | null): Promise<ProfileResponse> {
  const { data } = await apiClient.patch<ProfileResponse>("/api/profile", { targetRole });
  return data;
}

export interface RecommendedPostingsParams {
  roleCategory?: RoleCategory;
}

export async function fetchRecommendedPostings(
  params: RecommendedPostingsParams = {},
): Promise<RecommendedPostingsResponse> {
  const { data } = await apiClient.get<RecommendedPostingsResponse>("/api/postings/recommended", {
    params,
  });
  return data;
}

export async function askQuestion(question: string): Promise<AskResponse> {
  const { data } = await apiClient.post<AskResponse>("/api/ask", { question });
  return data;
}

export async function fetchInferredRole(): Promise<InferRoleResponse> {
  const { data } = await apiClient.get<InferRoleResponse>("/api/analytics/infer-role");
  return data;
}

export interface SkillGapParams {
  roleCategory: RoleCategory;
  days?: number;
}

export async function fetchSkillGap(params: SkillGapParams): Promise<SkillGapResponse> {
  const { data } = await apiClient.get<SkillGapResponse>("/api/analytics/skill-gap", { params });
  return data;
}
