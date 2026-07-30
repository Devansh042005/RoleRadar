import { Badge } from "@/components/ui/badge";
import type { PostingSkillSummary } from "@/lib/types";

export function SkillBadgeRow({
  skills,
  emptyLabel = "Skills not extracted yet",
}: {
  skills: PostingSkillSummary[];
  emptyLabel?: string;
}) {
  if (skills.length === 0) {
    if (!emptyLabel) return null;
    return <p className="text-xs text-muted-foreground italic">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <Badge key={skill.name} variant={skill.requirementType === "REQUIRED" ? "default" : "outline"}>
          {skill.name}
        </Badge>
      ))}
    </div>
  );
}
