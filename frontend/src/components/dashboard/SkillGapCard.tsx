import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SkillGapReport } from "@/components/skillgap/SkillGapReport";

export function SkillGapCard() {
  return (
    <Card className="rounded-[4px] border-border bg-surface shadow-none">
      <CardHeader>
        <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
          Skill gap
        </h2>
      </CardHeader>
      <CardContent>
        <SkillGapReport compact />
      </CardContent>
    </Card>
  );
}
