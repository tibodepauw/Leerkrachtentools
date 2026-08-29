"use client";

import { Loader2, Sparkles } from "lucide-react";
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
import { useLessonStore } from "@/stores/useLessonStore";

interface EngagementResult {
  factors: Array<{
    name: string;
    status: "aanwezig" | "gedeeltelijk" | "ontbreekt";
    evidence: string;
    suggestion: string;
  }>;
}

export function EngagementView() {
  const setField = useLessonStore((state) => state.setField);
  const [content, setContent] = useLessonPreparationText();
  const { analyze, result, loading, error } = useAnalysis<EngagementResult>();
  const actionDisabled = loading || !content.trim();

  function syncFactors() {
    if (!result) return;
    setField(
      "engagementFactors",
      result.data.factors
        .filter((factor) => factor.status !== "ontbreekt")
        .map((factor) => factor.name),
    );
  }

  return (
    <ModuleShell
      moduleId="engagement"
      title="Betrokkenheidsfactoren van Laevers"
      description="Zelfstandige analyse van Leeractiviteit, Werkelijkheidsnabijheid, Leerlingeninitiatief, Positief klasklimaat, Expressie en Samen leren."
      input={
        <ModuleInputLayout
          fields={
            <LessonPreparationInput
              id="engagement-content"
              label="Volledige lesvoorbereiding"
              value={content}
              onChange={setContent}
            />
          }
          actions={
            <>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <ModuleActionButton
                disabled={actionDisabled}
                onClick={() => analyze("/api/audit-engagement", { content })}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Analyseer zes factoren
              </ModuleActionButton>
            </>
          }
        />
      }
      output={
        result ? (
          <div className="space-y-3">
            {result.data.factors.map((factor) => (
              <Card key={factor.name}>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-sm">{factor.name}</CardTitle>
                  <Badge variant={factor.status === "aanwezig" ? "default" : "outline"}>{factor.status}</Badge>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-neutral-400">{factor.evidence}</p>
                  <div className="flex items-start justify-between gap-3 rounded-md bg-neutral-900 p-3">
                    <p>{factor.suggestion}</p><CopyButton value={factor.suggestion} />
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button onClick={syncFactors}>Sync gerealiseerde factoren</Button>
          </div>
        ) : (
          <EmptyOutput>Alle zes factoren krijgen bewijs, status en een concrete suggestie.</EmptyOutput>
        )
      }
    />
  );
}
