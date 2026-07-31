"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SkillBadgeRow } from "@/components/shared/SkillBadgeRow";
import { createApplication, fetchApplications, fetchRecommendedPostings } from "@/lib/api";
import { ROLE_CATEGORIES, type RoleCategory } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

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

function formatPostedAt(postedAt: string | null) {
  if (!postedAt) return null;
  return new Date(postedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** A similarity score readout — the point is that this is meaning-based (cosine
 * similarity over embeddings), not a keyword "X/Y skills match" count. */
function MatchIndicator({ similarity }: { similarity: number }) {
  const score = Math.max(0, Math.min(1, similarity));
  const pct = Math.round(score * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between font-mono text-xs">
        <span className="text-muted-foreground">MATCH</span>
        <span className="text-signal">{score.toFixed(2)}</span>
      </div>
      <div className="h-1 w-full bg-surface-2">
        <div className="h-full bg-signal" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RecommendedCardSkeleton() {
  return (
    <Card className="rounded-[4px] border-border bg-surface shadow-none">
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-2/3 rounded-[4px]" />
        <Skeleton className="h-3 w-1/2 rounded-[4px]" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-2 w-full rounded-[4px]" />
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-5 w-16 rounded-[3px]" />
          <Skeleton className="h-5 w-20 rounded-[3px]" />
        </div>
      </CardContent>
    </Card>
  );
}

function SaveButton({ postingId, saved }: { postingId: string; saved: boolean }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => createApplication(postingId),
    onSuccess: () => {
      toast.success("Saved to pipeline.");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: () => toast.error("Couldn't save this posting — try again."),
  });

  if (saved) {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 font-mono text-xs text-positive">
        SAVED ✓
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-[4px] font-mono text-xs"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? "SAVING…" : "SAVE"}
    </Button>
  );
}

function EmptyProfileState() {
  return (
    <Card className="rounded-[4px] border-border bg-surface shadow-none">
      <CardContent className="space-y-3 py-10 text-center">
        <p className="text-sm text-foreground">No profile yet. Add your skills to see where you stand.</p>
        <p className="mx-auto max-w-xs text-sm text-muted-foreground">
          Postings are ranked by meaning against your skills — not keyword overlap.
        </p>
        <Button asChild variant="outline" size="sm" className="rounded-[4px]">
          <Link href="/profile">Add skills</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function RecommendedPostings() {
  const [roleFilter, setRoleFilter] = useState<RoleCategory | "ALL">("ALL");
  const debouncedRole = useDebouncedValue(roleFilter, 300);
  const roleCategory = debouncedRole === "ALL" ? undefined : debouncedRole;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["postings-recommended", roleCategory],
    queryFn: () => fetchRecommendedPostings({ roleCategory }),
    staleTime: 60_000,
  });

  const { data: applications } = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetchApplications(),
    staleTime: 30_000,
  });

  const savedPostingIds = useMemo(
    () => new Set((applications ?? []).map((app) => app.posting.id)),
    [applications],
  );

  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Recommended
          </h2>
          <p className="text-sm text-muted-foreground">
            Ranked by meaning — semantic similarity to your profile, not keyword overlap.
          </p>
        </div>
        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleCategory | "ALL")}>
          <SelectTrigger className="w-[140px] shrink-0 rounded-[4px] font-mono text-xs" aria-label="Filter by role category">
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

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <RecommendedCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <Card className="rounded-[4px] border-border bg-surface shadow-none">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Couldn&apos;t load recommendations.
          </CardContent>
        </Card>
      ) : !data?.hasProfile ? (
        <EmptyProfileState />
      ) : data.data.length === 0 ? (
        <Card className="rounded-[4px] border-border bg-surface shadow-none">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {roleCategory
              ? `No matches in ${ROLE_LABELS[roleCategory].toLowerCase()} yet — try All roles.`
              : "No embedded postings yet — check back once the pipeline has processed some."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((posting) => (
            <Card key={posting.id} className="flex flex-col rounded-[4px] border-border bg-surface shadow-none">
              <CardHeader className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base leading-snug font-medium text-foreground">
                    {posting.title}
                  </h3>
                  <a
                    href={posting.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${posting.title} posting`}
                    className="shrink-0 pt-0.5 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--signal)]"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
                <p className="font-mono text-xs text-muted-foreground">{posting.company.name}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-3">
                <MatchIndicator similarity={posting.similarity} />
                <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  <MapPin className="size-3.5" />
                  <span>{posting.location ?? "Remote / unspecified"}</span>
                  {formatPostedAt(posting.postedAt) ? (
                    <span className="ml-auto">{formatPostedAt(posting.postedAt)}</span>
                  ) : null}
                </div>
                <SkillBadgeRow skills={posting.skills} />
                <SaveButton postingId={posting.id} saved={savedPostingIds.has(posting.id)} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
