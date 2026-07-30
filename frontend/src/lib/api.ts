import axios, { AxiosError } from "axios";
import { toast } from "sonner";
import type {
  ApiErrorShape,
  Application,
  ApplicationStage,
  CompanyAnalytics,
  FunnelResponse,
  PostingsResponse,
  RoleCategory,
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
