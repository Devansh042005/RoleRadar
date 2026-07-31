"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addProfileSkill, deleteProfileSkill, fetchProfile, updateTargetRole } from "@/lib/api";
import type { Proficiency } from "@/lib/types";

const PROFICIENCY_LABELS: Record<Proficiency, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

// Every profile mutation invalidates all four queries: the profile view itself,
// dashboard recommendations (ranked against the profile embedding this page
// recomputes on every change), and the skill-gap feature's two queries — a skill
// add/remove changes which skills count as "covered", and can also change which
// RoleCategory gets inferred as the default.
const INVALIDATE_KEYS = [
  ["profile"],
  ["postings-recommended"],
  ["skill-gap"],
  ["infer-role"],
] as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{children}</p>
  );
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const [skillName, setSkillName] = useState("");
  const [proficiency, setProficiency] = useState<Proficiency>("INTERMEDIATE");
  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [targetRoleTouched, setTargetRoleTouched] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
  });

  function invalidateProfileQueries() {
    for (const key of INVALIDATE_KEYS) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  }

  const addSkillMutation = useMutation({
    mutationFn: () => addProfileSkill(skillName.trim(), proficiency),
    onSuccess: () => {
      setSkillName("");
      invalidateProfileQueries();
    },
    onError: () => toast.error("Couldn't add that skill — try again."),
  });

  const deleteSkillMutation = useMutation({
    mutationFn: (id: string) => deleteProfileSkill(id),
    onSuccess: invalidateProfileQueries,
    onError: () => toast.error("Couldn't remove that skill — try again."),
  });

  const targetRoleMutation = useMutation({
    mutationFn: (role: string | null) => updateTargetRole(role),
    onSuccess: () => {
      toast.success("Target role saved.");
      invalidateProfileQueries();
    },
    onError: () => toast.error("Couldn't save target role — try again."),
  });

  const displayedTargetRole = (targetRoleTouched ? targetRole : data?.targetRole) ?? "";

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">
            Profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Skills and target role drive semantic matching and grounded answers in Ask — ranked by
            meaning, not keyword overlap.
          </p>
        </div>

        <Card className="rounded-[4px] border-border bg-surface shadow-none">
          <CardHeader className="gap-1.5">
            <SectionLabel>Target role</SectionLabel>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              placeholder="e.g. Backend Engineer"
              value={displayedTargetRole}
              onChange={(e) => {
                setTargetRoleTouched(true);
                setTargetRole(e.target.value);
              }}
              disabled={isLoading}
              className="rounded-[4px] font-mono"
            />
            <Button
              variant="outline"
              className="rounded-[4px]"
              disabled={targetRoleMutation.isPending}
              onClick={() => targetRoleMutation.mutate(displayedTargetRole || null)}
            >
              Save
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[4px] border-border bg-surface shadow-none">
          <CardHeader className="gap-1.5">
            <SectionLabel>Skills</SectionLabel>
            <p className="text-sm text-muted-foreground">
              {data?.hasEmbedding
                ? "Profile embedding is up to date."
                : "Add at least one skill or a target role to enable recommendations."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="e.g. Node.js"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                className="max-w-56 rounded-[4px] font-mono"
              />
              <Select value={proficiency} onValueChange={(v) => setProficiency(v as Proficiency)}>
                <SelectTrigger className="rounded-[4px] font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROFICIENCY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value} className="font-mono">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="rounded-[4px]"
                disabled={skillName.trim().length === 0 || addSkillMutation.isPending}
                onClick={() => addSkillMutation.mutate()}
              >
                {addSkillMutation.isPending ? "Adding…" : "Add skill"}
              </Button>
            </div>

            {isLoading ? (
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-24 rounded-[4px]" />
                <Skeleton className="h-6 w-20 rounded-[4px]" />
              </div>
            ) : data && data.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="inline-flex items-center gap-1.5 rounded-[3px] border border-border py-1 pr-1 pl-2 font-mono text-xs text-foreground"
                  >
                    {skill.name}
                    <span className="text-muted-foreground">
                      · {PROFICIENCY_LABELS[skill.proficiency].toLowerCase()}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${skill.name}`}
                      onClick={() => deleteSkillMutation.mutate(skill.id)}
                      className="rounded-[2px] p-0.5 text-muted-foreground hover:bg-surface-2 hover:text-gap focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--signal)]"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No skills added yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
