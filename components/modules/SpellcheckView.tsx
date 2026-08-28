"use client";

import { CheckCheck, Loader2 } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LessonPreparationInput } from "@/components/shared/LessonPreparationInput";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useLessonPreparationText } from "@/hooks/useLessonText";

interface SpellcheckResult {
  improved: string;
  issues: Array<{ original: string; replacement: string; reason: string }>;
}

export function SpellcheckView() {
  const [content, setContent] = useLessonPreparationText();
  const { analyze, result, loading, error } = useAnalysis<SpellcheckResult>();
  const actionDisabled = loading || !content.trim();

  return (
    <ModuleShell
      title="Didactische taalfoutencheck"
      description="Controleert dt-fouten, formele instructietaal, didactische terminologie en professionele stijl."
      input={
        <div className="space-y-4">
          <LessonPreparationInput
            id="spell-content"
            label="Lesvoorbereidingstekst"
            value={content}
            onChange={setContent}
            rows={18}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <ModuleActionButton
            disabled={actionDisabled}
            disabledReason="Upload of plak eerst je lesvoorbereiding."
            onClick={() => analyze("/api/spellcheck", { content })}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
            Controleer tekst
          </ModuleActionButton>
        </div>
      }
      output={
        result ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-sm">Verbeterde tekst</CardTitle>
                <CopyButton value={result.data.improved} />
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm leading-7">{result.data.improved}</CardContent>
            </Card>
            {result.data.issues.map((issue) => (
              <Card key={`${issue.original}-${issue.replacement}`}>
                <CardContent className="space-y-2 pt-5 text-sm">
                  <p><span className="text-red-400 line-through">{issue.original}</span> → <span className="text-emerald-400">{issue.replacement}</span></p>
                  <p className="text-xs text-neutral-500">{issue.reason}</p>
                </CardContent>
              </Card>
            ))}
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
