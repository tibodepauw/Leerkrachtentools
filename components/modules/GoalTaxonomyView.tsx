"use client";

import { Brain, Loader2 } from "lucide-react";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { LessonGoalSelector } from "@/components/shared/LessonGoalSelector";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useSelectedLessonGoal } from "@/hooks/useSelectedLessonGoal";
import { useLessonStore } from "@/stores/useLessonStore";
import type { GoalTaxonomy } from "@/types";

interface GoalTaxonomyResult {
  original: string;
  taxonomy: GoalTaxonomy;
  rationale: string;
  indicators: string[];
  definition: string;
}

const taxonomyLabels: Record<GoalTaxonomy, string> = {
  MC: "Mentaal-cognitief",
  DAS: "Dynamisch-affectief",
  SPM: "Sensomotorisch/psychomotorisch",
};

export function GoalTaxonomyView() {
  const { goals, selectedId, setSelectedId, text, setText } =
    useSelectedLessonGoal();
  const setGoal = useLessonStore((state) => state.setGoal);
  const { analyze, result, loading, error } = useAnalysis<GoalTaxonomyResult>();
  const actionDisabled = loading || !text.trim();

  return (
    <ModuleShell
      title="MC–DAS–SPM herkenner"
      description="Classificeert lesdoelen via Gemini als MC, DAS of SPM zonder het doel te herschrijven."
      input={
        <div className="space-y-4">
          <LessonGoalSelector
            id="taxonomy-goal"
            label="Kies een lesdoel"
            goals={goals}
            selectedId={selectedId}
            onSelect={setSelectedId}
            text={text}
            onTextChange={setText}
            rows={8}
            placeholder="De leerlingen kunnen zoogdieren herkennen..."
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <ModuleActionButton
            onClick={() => analyze("/api/classify-goal-taxonomy", { goal: text })}
            disabled={actionDisabled}
            disabledReason="Kies een doel met tekst of vul er eerst één in."
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Brain className="size-4" />
            )}
            Herken taxonomie voor {selectedId}
          </ModuleActionButton>
        </div>
      }
      output={
        result ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{result.data.taxonomy}</Badge>
              <Badge variant="secondary">
                {taxonomyLabels[result.data.taxonomy]}
              </Badge>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Geanalyseerd doel</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-neutral-200">
                  {result.data.original}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-3 pt-5 text-sm">
                <p>{result.data.rationale}</p>
                <p className="text-neutral-400">{result.data.definition}</p>
                {result.data.indicators.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {result.data.indicators.map((indicator) => (
                      <Badge key={indicator} variant="outline">
                        {indicator}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Button
              type="button"
              onClick={() => {
                const index = goals.findIndex((goal) => goal.id === selectedId);
                if (index >= 0) {
                  setGoal(index, {
                    text: result.data.original,
                    taxonomy: result.data.taxonomy,
                  });
                }
              }}
            >
              Bewaar taxonomie op {selectedId}
            </Button>
          </div>
        ) : (
          <EmptyOutput>
            MC, DAS of SPM met uitleg en indicatoren verschijnt hier.
          </EmptyOutput>
        )
      }
    />
  );
}
