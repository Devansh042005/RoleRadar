"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTrending } from "@/lib/api";
import { cn } from "@/lib/utils";

const TICKER_SKILL_COUNT = 10;
const RECENT_WINDOW_DAYS = 7;
const BASELINE_WINDOW_DAYS = 30;
// A skill's short-window rate has to beat its baseline rate by this much
// (in either direction) before we call it a trend rather than noise.
const TREND_THRESHOLD = 0.12;

type TickerDirection = "up" | "down" | "flat";

interface TickerEntry {
  name: string;
  direction: TickerDirection;
  requiredPct: number;
}

function computeTickerEntries(
  baseline: { name: string; count: number; requiredCount: number }[] | undefined,
  recent: { name: string; count: number }[] | undefined,
): TickerEntry[] {
  if (!baseline) return [];
  const recentByName = new Map((recent ?? []).map((row) => [row.name, row.count]));

  return baseline.map((row) => {
    const baselineRate = row.count / BASELINE_WINDOW_DAYS;
    const recentCount = recentByName.get(row.name);

    let direction: TickerDirection = "flat";
    if (recentCount !== undefined && baselineRate > 0) {
      const recentRate = recentCount / RECENT_WINDOW_DAYS;
      const delta = (recentRate - baselineRate) / baselineRate;
      if (delta > TREND_THRESHOLD) direction = "up";
      else if (delta < -TREND_THRESHOLD) direction = "down";
    }

    return {
      name: row.name,
      direction,
      requiredPct: row.count > 0 ? Math.round((row.requiredCount / row.count) * 100) : 0,
    };
  });
}

function DirectionMarker({ direction }: { direction: TickerDirection }) {
  if (direction === "up") return <span className="text-positive">▲</span>;
  if (direction === "down") return <span className="text-gap">▼</span>;
  return <span className="text-muted-foreground">·</span>;
}

function TickerRow({ entries }: { entries: TickerEntry[] }) {
  return (
    <>
      {entries.map((entry, i) => (
        <span key={`${entry.name}-${i}`} className="flex shrink-0 items-center gap-2 px-4">
          <span className="text-muted-foreground">{entry.name.toUpperCase()}</span>
          <DirectionMarker direction={entry.direction} />
          <span className="text-signal">{entry.requiredPct}%</span>
          <span className="text-border">·</span>
        </span>
      ))}
    </>
  );
}

export function MarketTicker() {
  const baselineQuery = useQuery({
    queryKey: ["trending-ticker", "baseline"],
    queryFn: () => fetchTrending({ days: BASELINE_WINDOW_DAYS, limit: TICKER_SKILL_COUNT }),
    staleTime: 60_000,
  });

  const recentQuery = useQuery({
    queryKey: ["trending-ticker", "recent"],
    queryFn: () => fetchTrending({ days: RECENT_WINDOW_DAYS, limit: 50 }),
    staleTime: 60_000,
  });

  const entries = useMemo(
    () => computeTickerEntries(baselineQuery.data, recentQuery.data),
    [baselineQuery.data, recentQuery.data],
  );

  if (baselineQuery.isLoading) {
    return (
      <div className="flex h-9 items-center border-y border-border bg-surface px-4">
        <div className="h-3 w-48 animate-pulse rounded-sm bg-muted" />
      </div>
    );
  }

  if (baselineQuery.isError || entries.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative flex h-9 items-center overflow-hidden border-y border-border bg-surface font-mono text-xs",
      )}
      role="marquee"
      aria-label="Trending skills ticker"
    >
      <div className="ticker-track flex w-max">
        <TickerRow entries={entries} />
        <TickerRow entries={entries} />
      </div>
    </div>
  );
}
