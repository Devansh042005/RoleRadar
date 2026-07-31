"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanColumn } from "@/components/pipeline/KanbanColumn";
import { ApplicationCard } from "@/components/pipeline/ApplicationCard";
import { ApplicationDetailSheet } from "@/components/pipeline/ApplicationDetailSheet";
import { STAGE_ORDER } from "@/components/pipeline/stageMeta";
import { fetchApplications, updateApplicationStage } from "@/lib/api";
import type { Application, ApplicationStage } from "@/lib/types";
import { APPLICATION_STAGES } from "@/lib/types";

function isApplicationStage(value: unknown): value is ApplicationStage {
  return typeof value === "string" && (APPLICATION_STAGES as readonly string[]).includes(value);
}

export function KanbanBoard() {
  const queryClient = useQueryClient();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);

  const {
    data: applications,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetchApplications(),
    staleTime: 30_000,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const moveMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: ApplicationStage }) =>
      updateApplicationStage(id, stage),
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["applications"] });
      const previous = queryClient.getQueryData<Application[]>(["applications"]);

      queryClient.setQueryData<Application[]>(["applications"], (old) =>
        old?.map((app) => (app.id === id ? { ...app, stage } : app)),
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["applications"], context.previous);
      }
      toast.error("Couldn't move that card — reverted.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["funnel"] });
    },
  });

  const byStage = useMemo(() => {
    const grouped = new Map<ApplicationStage, Application[]>();
    for (const stage of STAGE_ORDER) grouped.set(stage, []);
    for (const application of applications ?? []) {
      grouped.get(application.stage)?.push(application);
    }
    return grouped;
  }, [applications]);

  const activeApplication = applications?.find((app) => app.id === activeDragId) ?? null;

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const targetStage = over.id;
    if (!isApplicationStage(targetStage)) return;

    const application = applications?.find((app) => app.id === active.id);
    if (!application || application.stage === targetStage) return;

    moveMutation.mutate({ id: application.id, stage: targetStage });
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 border border-border bg-surface py-16 text-center">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load your pipeline.</p>
        <Button variant="outline" size="sm" className="rounded-[4px]" onClick={() => refetch()}>
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGE_ORDER.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              applications={byStage.get(stage) ?? []}
              isLoading={isLoading}
              onOpenApplication={setSelectedApplication}
              activeDragId={activeDragId}
            />
          ))}
        </div>
        <DragOverlay>
          {activeApplication ? <ApplicationCard application={activeApplication} /> : null}
        </DragOverlay>
      </DndContext>

      <ApplicationDetailSheet
        application={selectedApplication}
        onClose={() => setSelectedApplication(null)}
      />
    </>
  );
}
