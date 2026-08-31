"use client";

import { Brain, Loader2 } from "lucide-react";
import { LessonGoalSelector } from "@/components/shared/LessonGoalSelector";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { ModuleInputLayout } from "@/components/shared/ModuleInputLayout";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
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
  subcategory: string;
  behaviorLevel: string;
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
  const { goals, selectedId, setSelectedId, text, setText, addGoal } =
    useSelectedLessonGoal();
  const setGoal = useLessonStore((state) => state.setGoal);
  const analysisScope = `${selectedId}:${text.trim()}`;
  const { analyze, result, loading, error } =
    useAnalysis<GoalTaxonomyResult>(analysisScope);
  const actionDisabled = loading || !text.trim();

  return (
    <ModuleShell
      moduleId="goal-taxonomy"
      title="MC-DAS-SPM herkenner"
      description="Classificeert lesdoelen als MC, DAS of SPM zonder het doel te herschrijven."
      input={
        <ModuleInputLayout
          fields={
            <LessonGoalSelector
              id="taxonomy-goal"
              label="Kies een lesdoel"
              goals={goals}
              selectedId={selectedId}
              onSelect={setSelectedId}
              text={text}
              onTextChange={setText}
              onAddGoal={addGoal}
              placeholder="De leerlingen kunnen zoogdieren herkennen..."
            />
          }
          actions={
            <>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <ModuleActionButton
                onClick={async () => {
                  const payload = await analyze("/api/classify-goal-taxonomy", {
                    goal: text,
                  });
                  if (!payload) return;

                  const index = goals.findIndex((goal) => goal.id === selectedId);
                  if (index >= 0) {
                    setGoal(index, { taxonomy: payload.data.taxonomy });
                  }
                }}
                disabled={actionDisabled}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Brain className="size-4" />
                )}
                Herken taxonomie voor {selectedId}
              </ModuleActionButton>
            </>
          }
        />
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
              <CardContent className="space-y-3 text-sm">
                <p className="font-medium text-neutral-200">{result.data.subcategory}</p>
                <p className="text-neutral-400">
                  Gedragsniveau: {result.data.behaviorLevel}
                </p>
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
