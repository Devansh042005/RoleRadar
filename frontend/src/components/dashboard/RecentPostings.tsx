"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, MapPin, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchPostings } from "@/lib/api";

const POSTINGS_LIMIT = 9;

function formatPostedAt(postedAt: string | null) {
  if (!postedAt) return null;
  const date = new Date(postedAt);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PostingCardSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-3 w-1/3" />
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function RecentPostings() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["postings", POSTINGS_LIMIT],
    queryFn: () => fetchPostings({ limit: POSTINGS_LIMIT, offset: 0 }),
    staleTime: 60_000,
  });

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Recent postings</h2>
        {data ? (
          <p className="text-sm text-muted-foreground">{data.total} total</p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PostingCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load recent postings.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="size-3.5" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : data && data.data.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm font-medium">No postings yet</p>
            <p className="text-sm text-muted-foreground">
              Postings will show up here once the ingestion pipeline picks some up.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.data.map((posting) => (
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
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" />
                  <span>{posting.location ?? "Remote / unspecified"}</span>
                  {formatPostedAt(posting.postedAt) ? (
                    <span className="ml-auto">{formatPostedAt(posting.postedAt)}</span>
                  ) : null}
                </div>
                {posting.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {posting.skills.map((skill) => (
                      <Badge
                        key={skill.name}
                        variant={skill.requirementType === "REQUIRED" ? "default" : "outline"}
                      >
                        {skill.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Skills not extracted yet</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
