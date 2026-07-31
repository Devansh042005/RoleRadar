"use client";

import { useDroppable } from "@dnd-kit/core";
import { Skeleton } from "@/components/ui/skeleton";
import { ApplicationCard } from "@/components/pipeline/ApplicationCard";
import { STAGE_LABELS } from "@/components/pipeline/stageMeta";
import type { Application, ApplicationStage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  stage,
  applications,
  isLoading,
  onOpenApplication,
  activeDragId,
}: {
  stage: ApplicationStage;
  applications: Application[];
  isLoading: boolean;
  onOpenApplication: (application: Application) => void;
  activeDragId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col border border-border bg-surface transition-colors",
        isOver && "border-signal/50 bg-surface-2",
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <h3 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
          {STAGE_LABELS[stage]}
        </h3>
        <span className="font-mono text-xs text-muted-foreground">{applications.length}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ minHeight: 120 }}>
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full rounded-[4px]" />
            <Skeleton className="h-20 w-full rounded-[4px]" />
          </>
        ) : applications.length === 0 ? (
          <p className="px-2 py-6 text-center font-mono text-xs text-muted-foreground">
            Nothing here yet.
          </p>
        ) : (
          applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              onOpen={onOpenApplication}
              dragging={activeDragId === application.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
