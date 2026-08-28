"use client";

import { Loader2, MessageSquareQuote } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LessonPreparationInput } from "@/components/shared/LessonPreparationInput";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useLessonPreparationText } from "@/hooks/useLessonText";
import { useLessonStore } from "@/stores/useLessonStore";

interface DialogueResult {
  formatted: string;
  interventions: number;
}

export function DialogueFormatterView() {
  const syncPreparation = useLessonStore((state) => state.syncPreparation);
  const [content, setContent] = useLessonPreparationText();
  const { analyze, result, loading, error } = useAnalysis<DialogueResult>();
  const actionDisabled = loading || !content.trim();

  return (
    <ModuleShell
      eyebrow="Lesvoorbereiding"
      title="Thomas More stijl"
      description="Zet ruwe instructies strikt om naar Lk/Lln-dialogen en cursieve bord- of organisatieacties."
      input={
        <div className="space-y-4">
          <LessonPreparationInput
            id="dialogue"
            label="Ruwe lesfase of instructie"
            value={content}
            onChange={setContent}
            rows={16}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <ModuleActionButton
            disabled={actionDisabled}
            disabledReason="Upload of plak eerst een lesfase of instructie."
            onClick={() => analyze("/api/format-dialogue", { content })}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <MessageSquareQuote className="size-4" />}
            Format voor Thomas More
          </ModuleActionButton>
        </div>
      }
      output={
        result ? (
          <div className="space-y-4">
            <div className="flex justify-between gap-2">
              <Badge variant="secondary">{result.data.interventions} interacties</Badge>
              <CopyButton value={result.data.formatted} />
            </div>
            <Card>
              <CardContent className="whitespace-pre-wrap pt-5 text-sm leading-7">
                {result.data.formatted}
              </CardContent>
            </Card>
            <Button variant="outline" onClick={() => syncPreparation(result.data.formatted)}>
              Sync naar actieve lesvoorbereiding
            </Button>
          </div>
        ) : (
          <EmptyOutput>De geformatteerde Lk/Lln-dialoog verschijnt hier.</EmptyOutput>
        )
      }
    />
  );
}
