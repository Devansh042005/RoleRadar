"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { ExternalLink, FileText, Send } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askQuestion } from "@/lib/api";
import type { ApiErrorShape, AskResponse } from "@/lib/types";

const EXAMPLE_QUESTIONS = [
  "What backend roles want Redis but not Kubernetes?",
  "Which companies hire the most senior engineers?",
  "What skills should I learn for remote fullstack roles?",
  "What's the most in-demand skill across all postings?",
];

// Reflects the two real steps inside the /api/ask endpoint (retrieve relevant
// postings, then generate an answer from them) — the backend doesn't stream
// intermediate progress, so this is a fixed-delay approximation of where the
// request actually is, not fabricated data.
const RETRIEVING_TO_GENERATING_MS = 1100;

function RagLoadingIndicator() {
  const [step, setStep] = useState<"retrieving" | "generating">("retrieving");

  useEffect(() => {
    const timer = setTimeout(() => setStep("generating"), RETRIEVING_TO_GENERATING_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 border border-border bg-surface px-4 py-6 font-mono text-sm text-muted-foreground">
      <span className="text-signal">›</span>
      {step === "retrieving" ? "RETRIEVING…" : "GENERATING…"}
    </div>
  );
}

export function AskPanel() {
  const [question, setQuestion] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const mutation = useMutation({
    mutationFn: (q: string) => askQuestion(q),
    onSuccess: (data) => {
      setResult(data);
      setErrorMessage(null);
    },
    onError: (err: AxiosError<ApiErrorShape>) => {
      setResult(null);
      if (err.response?.status === 429) {
        // The global axios interceptor in lib/api.ts already toasts on 429 —
        // just show a lightweight inline note here, don't double up.
        setErrorMessage("Too many questions in a short window — try again in a moment.");
      } else {
        setErrorMessage("Couldn't get an answer — try again.");
      }
    },
  });

  function submit(q: string) {
    const trimmed = q.trim();
    if (trimmed.length === 0 || mutation.isPending) return;
    setQuestion(trimmed);
    mutation.mutate(trimmed);
  }

  const postingExcerptCount =
    result?.retrieved.filter((item) => item.type === "posting").length ?? 0;
  const referenceExcerptCount =
    result?.retrieved.filter((item) => item.type === "document").length ?? 0;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">Ask</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask questions in plain English — answers are generated from the actual job postings in
            your database, with sources cited below the answer.
          </p>
        </div>

        <Card className="rounded-[4px] border-border bg-surface shadow-none">
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-start gap-2">
              <span className="pt-2 font-mono text-signal select-none">›</span>
              <Textarea
                ref={inputRef}
                placeholder="Ask a question about the job postings in your database…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(question);
                  }
                }}
                rows={3}
                className="rounded-[4px] border-none bg-transparent px-0 font-mono shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_QUESTIONS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => submit(example)}
                    disabled={mutation.isPending}
                    className="border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--signal)]"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <Button
                className="shrink-0 gap-1.5 rounded-[4px]"
                disabled={question.trim().length === 0 || mutation.isPending}
                onClick={() => submit(question)}
              >
                <Send className="size-3.5" />
                Ask
              </Button>
            </div>
          </CardContent>
        </Card>

        {mutation.isPending ? (
          <RagLoadingIndicator />
        ) : errorMessage ? (
          <div className="border border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
            {errorMessage}
          </div>
        ) : result ? (
          <div className="space-y-4">
            <Card className="rounded-[4px] border-border bg-surface shadow-none">
              <CardHeader>
                <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                  Answer
                </h2>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {result.answer}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  Grounded in {postingExcerptCount} posting excerpt
                  {postingExcerptCount === 1 ? "" : "s"}
                  {referenceExcerptCount > 0
                    ? ` and ${referenceExcerptCount} reference excerpt${referenceExcerptCount === 1 ? "" : "s"}`
                    : ""}{" "}
                  from your database — not general knowledge.
                </p>
              </CardContent>
            </Card>

            {result.sources.length > 0 ? (
              <div className="space-y-2">
                <h3 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                  Cited sources
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {result.sources.map((source) =>
                    source.type === "posting" ? (
                      <a
                        key={`posting-${source.id}`}
                        href={source.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--signal)]"
                      >
                        <span className="min-w-0">
                          <span className="block font-mono text-[10px] tracking-wide text-signal uppercase">
                            Posting
                          </span>
                          <span className="block truncate font-medium text-foreground">
                            {source.title}
                          </span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {source.company}
                          </span>
                        </span>
                        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    ) : (
                      <div
                        key={`document-${source.id}`}
                        className="flex items-center justify-between gap-2 border border-border px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                            Reference
                          </span>
                          <span className="block truncate font-medium text-foreground">
                            {source.title}
                          </span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {source.sourceRef}
                          </span>
                        </span>
                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                      </div>
                    ),
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
