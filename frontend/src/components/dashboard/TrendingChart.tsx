"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function TrendingChart() {
  const [roleFilter, setRoleFilter] = useState<RoleCategory | "ALL">("ALL");
  const debouncedRole = useDebouncedValue(roleFilter, 300);

  const roleCategory = debouncedRole === "ALL" ? undefined : debouncedRole;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["trending", roleCategory],
    queryFn: () => fetchTrending({ days: 30, roleCategory, limit: 15 }),
    staleTime: 60_000,
  });

  const chartData = useMemo(
    () => (data ?? []).map((row) => ({ ...row, shortName: truncate(row.name) })),
    [data],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Trending skills</CardTitle>
          <CardDescription>Most requested skills across postings, last 30 days</CardDescription>
        </div>
        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleCategory | "ALL")}>
          <SelectTrigger className="w-[160px]" aria-label="Filter by role category">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            {ROLE_CATEGORIES.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" style={{ opacity: 1 - i * 0.08 }} />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load trending skills.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="size-3.5" /> Retry
            </Button>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
            <p className="text-sm font-medium">No data for this filter</p>
            <p className="text-sm text-muted-foreground">
              Try a different role category or check back once more postings are ingested.
            </p>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className={`aspect-auto w-full transition-opacity ${isFetching ? "opacity-60" : ""}`}
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
        )}
      </CardContent>
    </Card>
  );
}
