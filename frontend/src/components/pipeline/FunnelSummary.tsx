"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS, STAGE_ORDER } from "@/components/pipeline/stageMeta";
import { fetchFunnel } from "@/lib/api";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function FunnelSummary() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["funnel"],
    queryFn: fetchFunnel,
    staleTime: 20_000,
  });

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-3 border border-border bg-surface px-4 py-3">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load funnel summary.</p>
        <Button variant="ghost" size="sm" className="rounded-[4px]" onClick={() => refetch()}>
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 divide-x divide-y divide-border border border-border bg-surface sm:grid-cols-6 sm:divide-y-0">
      {STAGE_ORDER.map((stage, i) => {
        const count = data?.stageCounts.find((row) => row.stage === stage)?.count;
        const avgSeconds =
          data?.avgTimeInStageSeconds.find((row) => row.stage === stage)?.avgSeconds ?? null;

        return (
          <div key={stage} className="space-y-1 px-4 py-3">
            <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              {STAGE_LABELS[stage]}
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-10 rounded-[4px]" style={{ opacity: 1 - i * 0.08 }} />
            ) : (
              <p className="font-display text-2xl font-medium text-foreground tabular-nums">
                {count ?? 0}
              </p>
            )}
            <p className="font-mono text-[11px] text-muted-foreground">
              {isLoading ? "" : `avg ${formatDuration(avgSeconds)}`}
            </p>
          </div>
        );
      })}
    </div>
  );
}
