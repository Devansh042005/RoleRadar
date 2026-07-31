"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SkillBadgeRow } from "@/components/shared/SkillBadgeRow";
import { STAGE_LABELS, STAGE_ORDER } from "@/components/pipeline/stageMeta";
import { deleteApplication, updateApplicationNotes, updateApplicationStage } from "@/lib/api";
import type { Application, ApplicationStage } from "@/lib/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Keyed by application.id from the parent, so switching applications remounts this
// component and naturally resets local state (notes draft, save tracking) — no effect
// needed to "sync" state from a changed prop.
function ApplicationDetailSheetBody({
  application,
  onClose,
}: {
  application: Application;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(application.notes ?? "");
  const lastSavedNotesRef = useRef(application.notes ?? "");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const debouncedNotes = useDebouncedValue(notes, 600);

  const notesMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => updateApplicationNotes(id, value),
    onError: () => toast.error("Couldn't save notes — try again."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
  });

  useEffect(() => {
    if (debouncedNotes === lastSavedNotesRef.current) return;
    lastSavedNotesRef.current = debouncedNotes;
    notesMutation.mutate({ id: application.id, value: debouncedNotes });
    // notesMutation is intentionally omitted — it's stable in identity terms we care
    // about (mutationFn doesn't change), including it would refire this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedNotes, application.id]);

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: ApplicationStage }) =>
      updateApplicationStage(id, stage),
    onError: () => toast.error("Couldn't change stage — try again."),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["funnel"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApplication(id),
    onError: () => toast.error("Couldn't remove this card — try again."),
    onSuccess: () => {
      toast.success("Removed from pipeline.");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["funnel"] });
      setDeleteOpen(false);
      onClose();
    },
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle className="pr-6">{application.posting.title}</SheetTitle>
        <SheetDescription className="font-mono text-xs">
          {application.posting.company.name}
          {application.posting.location ? ` · ${application.posting.location}` : ""}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-4 px-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Stage
          </span>
          <Select
            value={application.stage}
            onValueChange={(value) =>
              stageMutation.mutate({ id: application.id, stage: value as ApplicationStage })
            }
          >
            <SelectTrigger className="w-[160px] rounded-[4px] font-mono" aria-label="Change stage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGE_ORDER.map((stage) => (
                <SelectItem key={stage} value={stage} className="font-mono">
                  {STAGE_LABELS[stage]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-sm">
          {application.posting.roleCategory ? (
            <>
              <span className="text-muted-foreground">Role</span>
              <span className="text-foreground">{application.posting.roleCategory}</span>
            </>
          ) : null}
          {application.posting.seniority ? (
            <>
              <span className="text-muted-foreground">Seniority</span>
              <span className="text-foreground">{application.posting.seniority}</span>
            </>
          ) : null}
          {formatDate(application.posting.postedAt) ? (
            <>
              <span className="text-muted-foreground">Posted</span>
              <span className="text-foreground">{formatDate(application.posting.postedAt)}</span>
            </>
          ) : null}
        </div>

        <SkillBadgeRow skills={application.posting.skills} />

        <a
          href={application.posting.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-sm text-signal hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--signal)]"
        >
          View original posting <ExternalLink className="size-3.5" />
        </a>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="application-notes" className="text-sm font-medium text-foreground">
            Notes
          </label>
          <Textarea
            id="application-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Referral, interview prep, follow-up dates…"
            rows={6}
            className="rounded-[4px] font-mono"
          />
        </div>
      </div>

      <SheetFooter className="mt-auto">
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="rounded-[4px] text-gap hover:text-gap">
              <Trash2 className="size-3.5" /> Remove from pipeline
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-[4px]">
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this application?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes the card and its stage history. This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-[4px]">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-[4px]"
                onClick={() => deleteMutation.mutate(application.id)}
                disabled={deleteMutation.isPending}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetFooter>
    </>
  );
}

export function ApplicationDetailSheet({
  application,
  onClose,
}: {
  application: Application | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!application} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto border-border bg-surface sm:max-w-md">
        {application ? (
          <ApplicationDetailSheetBody key={application.id} application={application} onClose={onClose} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
