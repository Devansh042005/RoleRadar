"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSkillGap } from "@/lib/useSkillGap";
import type { RoleCategory } from "@/lib/types";

const ROLE_LABELS: Record<RoleCategory, string> = {
  BACKEND: "Backend",
  FRONTEND: "Frontend",
  FULLSTACK: "Fullstack",
  DEVOPS: "DevOps",
  DATA: "Data",
  MOBILE: "Mobile",
  AI_ML: "AI/ML",
  OTHER: "Other",
};

const COMPACT_GAP_LIMIT = 5;

function pct(fraction: number): number {
  return Math.round(fraction * 100);
}

/**
 * Shared between the dashboard's compact gap card and the full /skill-gap report —
 * `compact` only changes how much of the same fetched data is rendered, so both
 * placements stay backed by the identical query (see lib/useSkillGap.ts).
 */
export function SkillGapReport({ compact = false }: { compact?: boolean }) {
  const {
    hasSkills,
    profileLoading,
    roleCategory,
    selectRoleCategory,
    roleCategories,
    inferredRoleLoading,
    gap,
  } = useSkillGap();

  if (profileLoading || inferredRoleLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!hasSkills) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Sparkles className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Add skills to your profile to see your gaps</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            We compare your skills against what postings in a role actually demand.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/profile">Go to profile</Link>
        </Button>
      </div>
    );
  }

  const roleSelector = (
    <Select
      value={roleCategory ?? undefined}
      onValueChange={(value) => selectRoleCategory(value as RoleCategory)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a target role" />
      </SelectTrigger>
      <SelectContent>
        {roleCategories.map((rc) => (
          <SelectItem key={rc} value={rc}>
            {ROLE_LABELS[rc]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (roleCategory === null) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t infer a target role from your skills yet — pick one to see your gaps.
        </p>
        {roleSelector}
      </div>
    );
  }

  const visibleGaps =
    compact && gap.data ? gap.data.gaps.slice(0, COMPACT_GAP_LIMIT) : (gap.data?.gaps ?? []);

  return (
    <div className="space-y-4">
      {roleSelector}

      {gap.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : gap.isError ? (
        <p className="text-sm text-muted-foreground">Couldn&apos;t load the gap report.</p>
      ) : gap.data?.insufficientData ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
          <AlertTriangle className="size-4 shrink-0" />
          Not enough postings for this role yet to analyze ({gap.data.totalPostingsAnalyzed} found —
          need at least 5).
        </div>
      ) : gap.data ? (
        <>
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" /> You&apos;re covered
            </h3>
            {gap.data.covered.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                None of your skills show up in demand for this role yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {gap.data.covered.map((skill) => (
                  <Badge
                    key={skill.name}
                    variant="outline"
                    className="border-emerald-600/30 text-emerald-700 dark:text-emerald-400"
                  >
                    {skill.name} · {pct(skill.demandPct)}%
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
              <AlertTriangle className="size-4" /> Gaps to close
            </h3>
            {gap.data.gaps.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No gaps — you cover everything in demand for this role.
              </p>
            ) : (
              <div className="space-y-2">
                {visibleGaps.map((skill) => (
                  <div key={skill.name} className="space-y-1">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-medium text-foreground">{skill.name}</span>
                      <span className="text-muted-foreground">
                        in {pct(skill.demandPct)}% of {ROLE_LABELS[roleCategory].toLowerCase()} roles
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-destructive"
                        style={{ width: `${pct(skill.demandPct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {compact && gap.data.gaps.length > COMPACT_GAP_LIMIT ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/skill-gap">View full report</Link>
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
