"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/AppHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
      toast.success("Target role saved");
      invalidateProfileQueries();
    },
    onError: () => toast.error("Couldn't save target role — try again."),
  });

  const displayedTargetRole = (targetRoleTouched ? targetRole : data?.targetRole) ?? "";

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-8">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Your profile</h1>
          <p className="text-sm text-muted-foreground">
            Skills and target role here drive semantic matching and grounded answers in Ask —
            add what you know and we&apos;ll rank postings by meaning, not just keyword overlap.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Target role</CardTitle>
            <CardDescription>What role are you aiming for?</CardDescription>
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
            />
            <Button
              variant="outline"
              disabled={targetRoleMutation.isPending}
              onClick={() => targetRoleMutation.mutate(displayedTargetRole || null)}
            >
              Save
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
            <CardDescription>
              {data?.hasEmbedding
                ? "Profile embedding is up to date."
                : "Add at least one skill or a target role to enable recommendations."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="e.g. Node.js"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                className="max-w-56"
              />
              <Select value={proficiency} onValueChange={(v) => setProficiency(v as Proficiency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROFICIENCY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={skillName.trim().length === 0 || addSkillMutation.isPending}
                onClick={() => addSkillMutation.mutate()}
              >
                {addSkillMutation.isPending ? "Adding…" : "Add skill"}
              </Button>
            </div>

            {isLoading ? (
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ) : data && data.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.skills.map((skill) => (
                  <Badge key={skill.id} variant="outline" className="gap-1.5 py-1 pr-1">
                    {skill.name}
                    <span className="text-muted-foreground">
                      · {PROFICIENCY_LABELS[skill.proficiency].toLowerCase()}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${skill.name}`}
                      onClick={() => deleteSkillMutation.mutate(skill.id)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No skills added yet.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
