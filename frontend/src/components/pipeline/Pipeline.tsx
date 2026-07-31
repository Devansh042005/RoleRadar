import { AppShell } from "@/components/layout/AppShell";
import { FunnelSummary } from "@/components/pipeline/FunnelSummary";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";

export function Pipeline() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">
            Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Drag cards between stages, or open one for details.
          </p>
        </div>
        <FunnelSummary />
        <KanbanBoard />
      </div>
    </AppShell>
  );
}
