"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, ExternalLink, Bookmark, BookmarkCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SkillBadgeRow } from "@/components/shared/SkillBadgeRow";
import { createApplication, fetchApplications, fetchRecommendedPostings } from "@/lib/api";

function formatPostedAt(postedAt: string | null) {
  if (!postedAt) return null;
  return new Date(postedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function matchLabel(similarity: number): string {
  if (similarity >= 0.7) return "Strong match";
  if (similarity >= 0.5) return "Good match";
  return "Possible match";
}

/** A similarity score bar — the point is that this is meaning-based (cosine
 * similarity over embeddings), not a keyword "X/Y skills match" count. */
function MatchIndicator({ similarity }: { similarity: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(similarity * 100)));
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{matchLabel(similarity)}</span>
        <span className="text-muted-foreground">{pct}% semantic match</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RecommendedCardSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-2 w-full" />
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
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
      toast.success("Saved to pipeline");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: () => toast.error("Couldn't save this posting — try again."),
  });

  if (saved) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1.5">
        <BookmarkCheck className="size-3.5" /> Saved
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <Bookmark className="size-3.5" /> {mutation.isPending ? "Saving…" : "Save"}
    </Button>
  );
}

function EmptyProfileState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Sparkles className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Set up your profile to see recommendations</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            We rank postings by meaning against your skills — not just keyword overlap.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/profile">Set up profile</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function RecommendedPostings() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["postings-recommended"],
    queryFn: () => fetchRecommendedPostings(),
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
      <div className="mb-4 space-y-0.5">
        <h2 className="text-lg font-semibold tracking-tight">Recommended for you</h2>
        <p className="text-sm text-muted-foreground">
          Ranked by meaning — semantic similarity to your profile, not keyword overlap.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <RecommendedCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Couldn&apos;t load recommendations.
          </CardContent>
        </Card>
      ) : !data?.hasProfile ? (
        <EmptyProfileState />
      ) : data.data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No embedded postings yet — check back once the pipeline has processed some.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((posting) => (
            <Card key={posting.id} className="flex flex-col">
              <CardHeader className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{posting.title}</CardTitle>
                  <a
                    href={posting.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${posting.title} posting`}
                    className="text-muted-foreground hover:text-foreground shrink-0 pt-0.5"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
                <p className="text-sm text-muted-foreground">{posting.company.name}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-3">
                <MatchIndicator similarity={posting.similarity} />
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
