"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SkillBadgeRow } from "@/components/shared/SkillBadgeRow";
import type { Application } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ApplicationCard({
  application,
  onOpen,
  dragging = false,
}: {
  application: Application;
  onOpen?: (application: Application) => void;
  dragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen?.(application)}
      className={cn(
        "cursor-grab touch-none rounded-[4px] border-border bg-surface py-3 shadow-none transition-colors hover:bg-surface-2 active:cursor-grabbing",
        (isDragging || dragging) && "opacity-60",
      )}
    >
      <CardHeader className="space-y-0.5 px-3">
        <h4 className="font-display text-sm leading-snug font-medium text-foreground">
          {application.posting.title}
        </h4>
        <p className="font-mono text-xs text-muted-foreground">{application.posting.company.name}</p>
      </CardHeader>
      <CardContent className="space-y-2 px-3">
        <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <MapPin className="size-3" />
          <span className="truncate">{application.posting.location ?? "Remote / unspecified"}</span>
        </div>
        <SkillBadgeRow skills={application.posting.skills.slice(0, 4)} emptyLabel="" />
      </CardContent>
    </Card>
  );
}
