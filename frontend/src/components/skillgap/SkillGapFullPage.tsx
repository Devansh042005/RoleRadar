"use client";

import { AppHeader } from "@/components/layout/AppHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SkillGapReport } from "@/components/skillgap/SkillGapReport";

export function SkillGapFullPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-8">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Skill gap report</h1>
          <p className="text-sm text-muted-foreground">
            Ranked by demand — the highest-frequency missing skills for your target role come
            first.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Target role</CardTitle>
            <CardDescription>Compare your profile against what this role actually asks for</CardDescription>
          </CardHeader>
          <CardContent>
            <SkillGapReport />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
