import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SkillGapPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your skill gap</CardTitle>
        <CardDescription>See how your profile stacks up against market demand</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Sparkles className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Set your profile to unlock</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Compare your skills against what&apos;s trending in the market — coming in Phase 7.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled>
            Set up profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
