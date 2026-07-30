import { AppHeader } from "@/components/layout/AppHeader";
import { FunnelSummary } from "@/components/pipeline/FunnelSummary";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";

export function Pipeline() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-6 py-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Your pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Drag cards between stages, or open one for details.
          </p>
        </div>
        <FunnelSummary />
        <KanbanBoard />
      </main>
    </div>
  );
}
