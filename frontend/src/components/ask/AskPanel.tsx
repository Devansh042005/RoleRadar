"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { ExternalLink, Loader2, Send, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function AskPanel() {
  const [question, setQuestion] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);

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

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-8">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Ask</h1>
          <p className="text-sm text-muted-foreground">
            Ask questions in plain English — answers are generated from the actual job postings
            in your database, with sources cited below the answer.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <Textarea
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
            />
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_QUESTIONS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => submit(example)}
                    disabled={mutation.isPending}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <Button
                className="gap-1.5"
                disabled={question.trim().length === 0 || mutation.isPending}
                onClick={() => submit(question)}
              >
                {mutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Ask
              </Button>
            </div>
          </CardContent>
        </Card>

        {mutation.isPending ? (
          <Card>
            <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Retrieving relevant postings and generating an answer…
            </CardContent>
          </Card>
        ) : errorMessage ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {errorMessage}
            </CardContent>
          </Card>
        ) : result ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <Sparkles className="size-4 text-muted-foreground" />
                  Answer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.answer}</p>
                <p className="text-xs text-muted-foreground">
                  Grounded in {result.retrieved.length} retrieved posting
                  {result.retrieved.length === 1 ? "" : "s"} from your database — not general
                  knowledge.
                </p>
              </CardContent>
            </Card>

            {result.sources.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Cited sources</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {result.sources.map((source) => (
                    <a
                      key={source.id}
                      href={source.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{source.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {source.company}
                        </span>
                      </span>
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
