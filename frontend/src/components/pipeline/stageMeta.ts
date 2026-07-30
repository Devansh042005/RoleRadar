import type { ApplicationStage } from "@/lib/types";
import { APPLICATION_STAGES } from "@/lib/types";

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
};

export const STAGE_ORDER = APPLICATION_STAGES;
