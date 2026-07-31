import { cn } from "@/lib/utils";
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
      {skills.map((skill) => {
        const required = skill.requirementType === "REQUIRED";
        return (
          <span
            key={skill.name}
            className={cn(
              "inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[11px] leading-none",
              required
                ? "border-signal/40 text-signal"
                : "border-border text-muted-foreground",
            )}
          >
            {skill.name}
          </span>
        );
      })}
    </div>
  );
}
