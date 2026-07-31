"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchInferredRole, fetchProfile, fetchSkillGap } from "@/lib/api";
import { ROLE_CATEGORIES, type RoleCategory } from "@/lib/types";

/**
 * Shared data-fetching for the skill-gap feature — used by both the dashboard's
 * compact card and the full /skill-gap report, so the fetch logic lives in exactly
 * one place rather than being duplicated per placement.
 */
export function useSkillGap() {
  const [manualRoleCategory, setManualRoleCategory] = useState<RoleCategory | null>(null);
  const [touched, setTouched] = useState(false);

  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
  const inferredRoleQuery = useQuery({ queryKey: ["infer-role"], queryFn: fetchInferredRole });

  // Derived, not synced via effect: until the user picks something themselves, the
  // selection tracks whatever the inferred-role query currently resolves to — the
  // same pattern ProfilePage.tsx uses for its targetRole field.
  const roleCategory = touched ? manualRoleCategory : (inferredRoleQuery.data?.roleCategory ?? null);

  const gapQuery = useQuery({
    queryKey: ["skill-gap", roleCategory],
    queryFn: () => fetchSkillGap({ roleCategory: roleCategory as RoleCategory }),
    enabled: roleCategory !== null,
  });

  function selectRoleCategory(next: RoleCategory) {
    setTouched(true);
    setManualRoleCategory(next);
  }

  return {
    hasSkills: (profileQuery.data?.skills.length ?? 0) > 0,
    profileLoading: profileQuery.isLoading,
    roleCategory,
    selectRoleCategory,
    roleCategories: ROLE_CATEGORIES,
    inferredRoleLoading: inferredRoleQuery.isLoading,
    gap: gapQuery,
  };
}
