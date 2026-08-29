"use client";

import { useState } from "react";
import { Loader2, MessageSquareQuote } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { ModuleInputLayout } from "@/components/shared/ModuleInputLayout";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LessonPreparationInput } from "@/components/shared/LessonPreparationInput";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useLessonPreparationText } from "@/hooks/useLessonText";
import {
  WRITING_STYLES,
  WRITING_STYLE_LABELS,
  type WritingStyle,
} from "@/lib/ai/writingStyle";
import { useLessonStore } from "@/stores/useLessonStore";

interface DialogueResult {
  formatted: string;
  interventions: number;
}

export function DialogueFormatterView() {
  const syncPreparation = useLessonStore((state) => state.syncPreparation);
  const [content, setContent] = useLessonPreparationText();
  const [writingStyle, setWritingStyle] = useState<WritingStyle>("thomas-more");
  const { analyze, result, setResult, loading, error } =
    useAnalysis<DialogueResult>();
  const actionDisabled = loading || !content.trim();

  async function formatText() {
    setResult(null);
    await analyze("/api/format-dialogue", { content, style: writingStyle });
  }

  return (
    <ModuleShell
      moduleId="dialogue-formatter"
      title="Schrijfstijl"
      description="Herschrijf lesnotities in de gekozen schrijfstijl, van Thomas More-dialogen tot bondige of uitgewerkte varianten."
      input={
        <ModuleInputLayout
          fields={
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="writing-style">Schrijfstijl</Label>
                <Select
                  value={writingStyle}
                  onValueChange={(value) => setWritingStyle(value as WritingStyle)}
                >
                  <SelectTrigger id="writing-style" className="w-fit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WRITING_STYLES.map((style) => (
                      <SelectItem key={style} value={style}>
                        {WRITING_STYLE_LABELS[style]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <LessonPreparationInput
                id="dialogue"
                label="Ruwe lesfase of instructie"
                value={content}
                onChange={setContent}
              />
            </div>
          }
          actions={
            <>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <ModuleActionButton
                disabled={actionDisabled}
                onClick={formatText}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageSquareQuote className="size-4" />
                )}
                Toepassen
              </ModuleActionButton>
            </>
          }
        />
      }
      output={
        result ? (
          <div className="space-y-4">
            <div className="flex justify-between gap-2">
              <Badge variant="secondary">
                {result.data.interventions} interacties
              </Badge>
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
          <EmptyOutput>De geformatteerde tekst verschijnt hier.</EmptyOutput>
        )
      }
    />
  );
}
