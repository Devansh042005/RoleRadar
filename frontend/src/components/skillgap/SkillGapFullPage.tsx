"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SkillGapReport } from "@/components/skillgap/SkillGapReport";

export function SkillGapFullPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">
            Skill gap report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by demand — the highest-frequency missing skills for your target role come
            first.
          </p>
        </div>

        <Card className="rounded-[4px] border-border bg-surface shadow-none">
          <CardHeader>
            <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
              Target role
            </h2>
          </CardHeader>
          <CardContent>
            <SkillGapReport />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
