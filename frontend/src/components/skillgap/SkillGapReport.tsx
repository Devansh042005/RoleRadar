"use client";

import Link from "next/link";
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
import type { RoleCategory, SkillGapCoveredSkill, SkillGapMissingSkill } from "@/lib/types";

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

function TerminalMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-border px-4 py-8 font-mono text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function CoveredRow({ skill }: { skill: SkillGapCoveredSkill }) {
  return (
    <div className="space-y-1 py-1.5">
      <div className="flex items-baseline justify-between gap-2 font-mono text-xs">
        <span className="text-foreground">{skill.name}</span>
        <span className="shrink-0 text-muted-foreground">in {pct(skill.demandPct)}% of roles</span>
      </div>
      <div className="h-1 w-full bg-surface-2">
        <div className="h-full bg-positive" style={{ width: `${pct(skill.demandPct)}%` }} />
      </div>
    </div>
  );
}

function GapRow({ skill, roleLabel }: { skill: SkillGapMissingSkill; roleLabel: string }) {
  return (
    <div className="space-y-1 py-1.5">
      <div className="flex items-baseline justify-between gap-2 font-mono text-xs">
        <span className="text-foreground">{skill.name}</span>
        <span className="shrink-0 text-muted-foreground">
          in {pct(skill.demandPct)}% of {roleLabel.toLowerCase()} roles
        </span>
      </div>
      <div className="h-1 w-full bg-surface-2">
        <div className="h-full bg-gap" style={{ width: `${pct(skill.demandPct)}%` }} />
      </div>
    </div>
  );
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
        <Skeleton className="h-8 w-40 rounded-[4px]" />
        <Skeleton className="h-24 w-full rounded-[4px]" />
      </div>
    );
  }

  if (!hasSkills) {
    return (
      <div className="space-y-3 border border-dashed border-border px-4 py-8 text-center">
        <p className="text-sm text-foreground">No profile yet. Add your skills to see where you stand.</p>
        <Button asChild variant="outline" size="sm" className="rounded-[4px]">
          <Link href="/profile">Add skills</Link>
        </Button>
      </div>
    );
  }

  const roleSelector = (
    <Select
      value={roleCategory ?? undefined}
      onValueChange={(value) => selectRoleCategory(value as RoleCategory)}
    >
      <SelectTrigger className="rounded-[4px] font-mono" aria-label="Select target role">
        <SelectValue placeholder="Select a target role" />
      </SelectTrigger>
      <SelectContent>
        {roleCategories.map((rc) => (
          <SelectItem key={rc} value={rc} className="font-mono">
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
          Couldn&apos;t infer a target role from your skills yet — pick one to see your gaps.
        </p>
        {roleSelector}
      </div>
    );
  }

  const sortedGaps = (gap.data?.gaps ?? [])
    .slice()
    .sort((a, b) => b.demandPct - a.demandPct);
  const visibleGaps = compact ? sortedGaps.slice(0, COMPACT_GAP_LIMIT) : sortedGaps;

  return (
    <div className="space-y-4">
      {roleSelector}

      {gap.isLoading ? (
        <Skeleton className="h-32 w-full rounded-[4px]" />
      ) : gap.isError ? (
        <p className="text-sm text-muted-foreground">Couldn&apos;t load the gap report.</p>
      ) : gap.data?.insufficientData ? (
        <TerminalMessage>
          Not enough postings for this role yet to measure demand ({gap.data.totalPostingsAnalyzed}{" "}
          found — need at least 5).
        </TerminalMessage>
      ) : gap.data ? (
        <div className={compact ? "space-y-5" : "grid grid-cols-1 gap-8 md:grid-cols-2"}>
          <div>
            <h3 className="mb-2 font-mono text-xs tracking-wide text-positive uppercase">
              Covered
            </h3>
            {gap.data.covered.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                None of your skills show up in demand for this role yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {gap.data.covered.map((skill) => (
                  <CoveredRow key={skill.name} skill={skill} />
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 font-mono text-xs tracking-wide text-gap uppercase">Gaps</h3>
            {gap.data.gaps.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No gaps — you cover everything in demand for this role.
              </p>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {visibleGaps.map((skill) => (
                    <GapRow key={skill.name} skill={skill} roleLabel={ROLE_LABELS[roleCategory]} />
                  ))}
                </div>
                {compact && sortedGaps.length > COMPACT_GAP_LIMIT ? (
                  <Button asChild variant="outline" size="sm" className="mt-3 rounded-[4px]">
                    <Link href="/skill-gap">View full report</Link>
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
