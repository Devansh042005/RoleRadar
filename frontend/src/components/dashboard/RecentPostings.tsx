"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SkillBadgeRow } from "@/components/shared/SkillBadgeRow";
import { createApplication, fetchApplications, fetchPostings } from "@/lib/api";

const POSTINGS_LIMIT = 9;

function formatPostedAt(postedAt: string | null) {
  if (!postedAt) return null;
  const date = new Date(postedAt);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PostingCardSkeleton() {
  return (
    <Card className="rounded-[4px] border-border bg-surface shadow-none">
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-2/3 rounded-[4px]" />
        <Skeleton className="h-3 w-1/2 rounded-[4px]" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-3 w-1/3 rounded-[4px]" />
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-5 w-16 rounded-[3px]" />
          <Skeleton className="h-5 w-20 rounded-[3px]" />
          <Skeleton className="h-5 w-14 rounded-[3px]" />
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
    onError: () => {
      toast.error("Couldn't save this posting — try again.");
    },
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

export function RecentPostings() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["postings", POSTINGS_LIMIT],
    queryFn: () => fetchPostings({ limit: POSTINGS_LIMIT, offset: 0 }),
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
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
          Recent postings
        </h2>
        {data ? (
          <p className="font-mono text-xs text-muted-foreground">{data.total} total</p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PostingCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <Card className="rounded-[4px] border-border bg-surface shadow-none">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load recent postings.</p>
            <Button variant="outline" size="sm" className="rounded-[4px]" onClick={() => refetch()}>
              <RefreshCw className="size-3.5" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : data && data.data.length === 0 ? (
        <Card className="rounded-[4px] border-border bg-surface shadow-none">
          <CardContent className="py-16 text-center">
            <p className="text-sm font-medium text-foreground">No postings yet.</p>
            <p className="text-sm text-muted-foreground">
              Postings will show up here once the ingestion pipeline picks some up.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.data.map((posting) => (
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
