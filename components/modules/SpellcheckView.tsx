"use client";

import { CheckCheck, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/components/shared/CopyButton";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { ModuleInputLayout } from "@/components/shared/ModuleInputLayout";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LessonPreparationInput } from "@/components/shared/LessonPreparationInput";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useLessonPreparationText } from "@/hooks/useLessonText";

interface SpellcheckIssue {
  original: string;
  replacement: string;
  reason: string;
}

interface SpellcheckResult {
  improved: string;
  issues: SpellcheckIssue[];
}

function issueKey(issue: SpellcheckIssue, index: number) {
  return `${index}:${issue.original}:${issue.replacement}`;
}

function SpellcheckIssueRow({
  issue,
  onDismiss,
}: {
  issue: SpellcheckIssue;
  onDismiss: () => void;
}) {
  return (
    <div className="relative rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2 pr-9">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-1.5 right-1.5 rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
        aria-label="Suggestie verbergen"
        title="Suggestie verbergen"
      >
        <X className="size-3.5" />
      </button>
      <p className="text-sm leading-5">
        <span className="text-red-400 line-through">{issue.original}</span>
        <span className="text-neutral-500"> → </span>
        <span className="text-emerald-400">{issue.replacement}</span>
      </p>
      <p className="mt-0.5 text-xs leading-5 text-neutral-500">{issue.reason}</p>
    </div>
  );
}

export function SpellcheckView() {
  const [content, setContent] = useLessonPreparationText();
  const { analyze, result, loading, error } = useAnalysis<SpellcheckResult>();
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const actionDisabled = loading || !content.trim();

  useEffect(() => {
    setDismissedKeys(new Set());
  }, [result]);

  const visibleIssues = useMemo(() => {
    if (!result) return [];

    return result.data.issues.filter(
      (issue, index) => !dismissedKeys.has(issueKey(issue, index)),
    );
  }, [dismissedKeys, result]);

  return (
    <ModuleShell
      title="Didactische taalfoutencheck"
      description="Controleert dt-fouten, formele instructietaal, didactische terminologie en professionele stijl."
      input={
        <ModuleInputLayout
          fields={
            <LessonPreparationInput
              id="spell-content"
              label="Lesvoorbereidingstekst"
              value={content}
              onChange={setContent}
              minHeightClassName="min-h-[calc(100vh-14rem)]"
              maxHeightClassName="max-h-none"
            />
          }
          actions={
            <>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <ModuleActionButton
                disabled={actionDisabled}
                disabledReason="Upload of plak eerst je lesvoorbereiding."
                onClick={() => analyze("/api/spellcheck", { content })}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
                Controleer tekst
              </ModuleActionButton>
            </>
          }
        />
      }
      output={
        result ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-sm">Verbeterde tekst</CardTitle>
                <CopyButton value={result.data.improved} />
              </CardHeader>
              <CardContent className="px-4 py-3">
                <p className="whitespace-pre-wrap text-sm leading-7">
                  {result.data.improved}
                </p>
              </CardContent>
            </Card>

            {result.data.issues.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Gevonden taalfouten</p>
                  <Badge variant="secondary">
                    {visibleIssues.length}/{result.data.issues.length}
                  </Badge>
                </div>
                {visibleIssues.length > 0 ? (
                  <div className="space-y-2">
                    {result.data.issues.map((issue, index) =>
                      dismissedKeys.has(issueKey(issue, index)) ? null : (
                        <SpellcheckIssueRow
                          key={issueKey(issue, index)}
                          issue={issue}
                          onDismiss={() =>
                            setDismissedKeys((current) => {
                              const next = new Set(current);
                              next.add(issueKey(issue, index));
                              return next;
                            })
                          }
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">
                    Alle suggesties zijn verborgen. De verbeterde tekst hierboven
                    blijft beschikbaar.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                Geen afzonderlijke taalfouten gevonden.
              </p>
            )}

            <Button onClick={() => setContent(result.data.improved)}>
              Vervang en verbeter
            </Button>
          </div>
        ) : (
          <EmptyOutput>Suggesties en een volledig verbeterde versie verschijnen hier.</EmptyOutput>
        )
      }
    />
  );
}
