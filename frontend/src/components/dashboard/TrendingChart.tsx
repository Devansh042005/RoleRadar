"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { fetchTrending } from "@/lib/api";
import { ROLE_CATEGORIES, type RoleCategory } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

const chartConfig = {
  requiredCount: { label: "Required", color: "var(--chart-1)" },
  niceToHaveCount: { label: "Nice to have", color: "var(--chart-2)" },
} satisfies ChartConfig;

const ROLE_LABELS: Record<RoleCategory, string> = {
  BACKEND: "Backend",
  FRONTEND: "Frontend",
  FULLSTACK: "Full-stack",
  DEVOPS: "DevOps",
  DATA: "Data",
  MOBILE: "Mobile",
  AI_ML: "AI / ML",
  OTHER: "Other",
};

function truncate(name: string, max = 18) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

type ViewMode = "table" | "chart";

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="flex border border-border font-mono text-xs">
      {(["table", "chart"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={view === mode}
          className={cn(
            "px-2.5 py-1 uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--signal)]",
            view === mode
              ? "bg-surface-2 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}

export function TrendingChart() {
  const [roleFilter, setRoleFilter] = useState<RoleCategory | "ALL">("ALL");
  const [view, setView] = useState<ViewMode>("table");
  const debouncedRole = useDebouncedValue(roleFilter, 300);

  const roleCategory = debouncedRole === "ALL" ? undefined : debouncedRole;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["trending", roleCategory],
    queryFn: () => fetchTrending({ days: 30, roleCategory, limit: 15 }),
    staleTime: 60_000,
  });

  const rows = data ?? [];
  const maxCount = useMemo(() => Math.max(1, ...rows.map((row) => row.count)), [rows]);

  const chartData = useMemo(
    () => rows.map((row) => ({ ...row, shortName: truncate(row.name) })),
    [rows],
  );

  return (
    <Card className="rounded-[4px] border-border bg-surface py-0 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border py-3">
        <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
          Trending skills
        </h2>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleCategory | "ALL")}>
            <SelectTrigger className="w-[140px] rounded-[4px] font-mono text-xs" aria-label="Filter by role category">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="font-mono">
                All roles
              </SelectItem>
              {ROLE_CATEGORIES.map((role) => (
                <SelectItem key={role} value={role} className="font-mono">
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-[4px]" style={{ opacity: 1 - i * 0.08 }} />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load trending skills.</p>
            <Button variant="outline" size="sm" className="rounded-[4px]" onClick={() => refetch()}>
              <RefreshCw className="size-3.5" /> Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No data for this filter.</p>
            <p className="text-sm text-muted-foreground">
              Try a different role category or check back once more postings are ingested.
            </p>
          </div>
        ) : view === "table" ? (
          <div className={cn("transition-opacity", isFetching && "opacity-60")}>
            <Table>
              <TableHeader>
                <TableRow className="rounded-none border-border hover:bg-transparent">
                  <TableHead className="w-10 font-mono text-[11px] text-muted-foreground uppercase">
                    #
                  </TableHead>
                  <TableHead className="font-mono text-[11px] text-muted-foreground uppercase">
                    Skill
                  </TableHead>
                  <TableHead className="font-mono text-[11px] text-muted-foreground uppercase">
                    Demand
                  </TableHead>
                  <TableHead className="text-right font-mono text-[11px] text-muted-foreground uppercase">
                    Count
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow
                    key={row.name}
                    className="rounded-none border-border hover:bg-surface-2"
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-foreground">{row.name}</TableCell>
                    <TableCell className="w-[40%]">
                      <div className="h-1.5 w-full bg-surface-2">
                        <div
                          className="h-full bg-signal"
                          style={{ width: `${Math.max(4, (row.count / maxCount) * 100)}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground tabular-nums">
                      {row.count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-4">
            <ChartContainer
              config={chartConfig}
              className={cn("aspect-auto w-full transition-opacity", isFetching && "opacity-60")}
              style={{ height: Math.max(280, chartData.length * 32) }}
            >
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis
                  dataKey="shortName"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <ChartTooltip
                  content={<ChartTooltipContent labelKey="name" nameKey="dataKey" />}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="requiredCount" stackId="a" fill="var(--color-requiredCount)" radius={[0, 0, 0, 0]} />
                <Bar
                  dataKey="niceToHaveCount"
                  stackId="a"
                  fill="var(--color-niceToHaveCount)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
