import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SkillGapReport } from "@/components/skillgap/SkillGapReport";

export function SkillGapCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your skill gap</CardTitle>
        <CardDescription>See how your profile stacks up against market demand</CardDescription>
      </CardHeader>
      <CardContent>
        <SkillGapReport compact />
      </CardContent>
    </Card>
  );
}
