"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load funnel summary.</p>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="size-3.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="grid grid-cols-3 gap-4 py-4 sm:grid-cols-6">
        {STAGE_ORDER.map((stage, i) => {
          const count = data?.stageCounts.find((row) => row.stage === stage)?.count;
          const avgSeconds =
            data?.avgTimeInStageSeconds.find((row) => row.stage === stage)?.avgSeconds ?? null;

          return (
            <div key={stage} className="space-y-1">
              <p className="text-xs text-muted-foreground">{STAGE_LABELS[stage]}</p>
              {isLoading ? (
                <Skeleton className="h-7 w-10" style={{ opacity: 1 - i * 0.08 }} />
              ) : (
                <p className="text-2xl font-semibold tabular-nums">{count ?? 0}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {isLoading ? "" : `avg ${formatDuration(avgSeconds)}`}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
