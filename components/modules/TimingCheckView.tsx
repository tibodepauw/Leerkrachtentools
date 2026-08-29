"use client";

import { useMemo } from "react";
import { Clock3, Loader2 } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { ModuleInputLayout } from "@/components/shared/ModuleInputLayout";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LessonPreparationInput } from "@/components/shared/LessonPreparationInput";
import { cn } from "@/lib/utils";
import { parsePhaseMinutes, timingDeviation } from "@/lib/timing";
import { trafficLightLabel } from "@/lib/ui/trafficLight";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useLessonPreparationText } from "@/hooks/useLessonText";
import { useLessonStore } from "@/stores/useLessonStore";

interface TimingResult {
  suggestions: string[];
  rationale: string;
}

export function TimingCheckView() {
  const lesson = useLessonStore((state) => state.lesson);
  const setField = useLessonStore((state) => state.setField);
  const [content, setContent] = useLessonPreparationText();
  const { analyze, result, loading, error } = useAnalysis<TimingResult>();
  const minutes = useMemo(() => parsePhaseMinutes(content), [content]);
  const sum = minutes.reduce((total, value) => total + value, 0);
  const deviation = timingDeviation(content, lesson.totalMinutes);
  const status =
    deviation === 0 ? "groen" : Math.abs(deviation) <= 5 ? "oranje" : "rood";
  const actionDisabled = loading || minutes.length === 0;

  return (
    <ModuleShell
      title="Timing"
      description="Controleer of de minuten in je vier lesfasen samen kloppen met je totale lestijd."
      input={
        <ModuleInputLayout
          fields={
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="total-time">Totale lestijd (minuten)</Label>
                <Input
                  id="total-time"
                  type="number"
                  min={1}
                  max={240}
                  value={lesson.totalMinutes}
                  onChange={(event) =>
                    setField(
                      "totalMinutes",
                      Math.max(1, Number(event.target.value) || 1),
                    )
                  }
                />
                <p className="text-xs text-neutral-500">
                  Standaard 50 minuten; pas aan naar 45 of 60 min indien nodig.
                </p>
              </div>
              <LessonPreparationInput
                id="timing-content"
                label="Vier lesfasen met minuten in de headers"
                value={content}
                onChange={setContent}
                placeholder={
                  "Instapfase - 5 min\n...\nInstructiefase - 15 minuten\n...\nVerwerking - 25 m\n...\nAfronding - 5 min"
                }
              />
            </div>
          }
          actions={
            <>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <ModuleActionButton
                disabled={actionDisabled}
                disabledReason='Upload of plak eerst minuten in je fase-headers, bv. "Instap - 5 min".'
                onClick={() =>
                  analyze("/api/audit-timing", {
                    totalMinutes: String(lesson.totalMinutes),
                    content: `Gevonden fasetijden: ${minutes.join(", ")}. Som: ${sum}. Doel: ${lesson.totalMinutes} min. Afwijking: ${deviation}.`,
                  })
                }
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Clock3 className="size-4" />
                )}
                Vraag optimalisaties
              </ModuleActionButton>
            </>
          }
        />
      }
      output={
        <div className="space-y-4">
          <Card
            className={cn(
              status === "groen" && "border-emerald-800",
              status === "oranje" && "border-orange-800",
              status === "rood" && "border-red-900",
            )}
          >
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm">Wiskundige controle</CardTitle>
              <Badge
                className={cn(
                  status === "groen" && "bg-emerald-600",
                  status === "oranje" && "bg-orange-600",
                  status === "rood" && "bg-red-700",
                )}
              >
                {trafficLightLabel(status)}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-3xl font-semibold">
                {sum} / {lesson.totalMinutes} min
              </p>
              <p className="text-sm text-neutral-500">
                {minutes.length
                  ? `${minutes.length} fasetijden: ${minutes.join(" + ")}`
                  : "Nog geen fasetijden gevonden in headers."}
              </p>
              {deviation === 0 ? (
                <p className="text-sm text-emerald-400">
                  De som klopt met je totale lestijd.
                </p>
              ) : (
                <p className="text-sm">
                  {Math.abs(deviation)} minuten{" "}
                  {deviation > 0 ? "te veel" : "te weinig"} t.o.v.{" "}
                  {lesson.totalMinutes} min.
                </p>
              )}
            </CardContent>
          </Card>
          {result ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-sm">Didactische suggesties</CardTitle>
                <CopyButton value={result.data.suggestions.join("\n")} />
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {result.data.suggestions.map((suggestion) => (
                  <p key={suggestion}>• {suggestion}</p>
                ))}
              </CardContent>
            </Card>
          ) : (
            <EmptyOutput>
              De tijdsstatus werkt direct; vraag daarna optionele suggesties.
            </EmptyOutput>
          )}
        </div>
      }
    />
  );
}
