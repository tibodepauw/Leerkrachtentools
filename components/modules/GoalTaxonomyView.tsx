"use client";

import { Brain, Loader2 } from "lucide-react";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useLessonGoalText } from "@/hooks/useLessonText";
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
  const [goal, setGoal] = useLessonGoalText();
  const setActiveGoal = useLessonStore((state) => state.setActiveGoal);
  const { analyze, result, loading, error } = useAnalysis<GoalTaxonomyResult>();
  const actionDisabled = loading || !goal.trim();

  return (
    <ModuleShell
      eyebrow="Doelen & leerplandoelen"
      title="MC–DAS–SPM herkenner"
      description="Classificeert één lesdoel via Gemini als MC, DAS of SPM zonder het doel te herschrijven."
      input={
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="taxonomy-goal">Lesdoel om te classificeren</Label>
            <Textarea
              id="taxonomy-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              rows={8}
              placeholder="De leerlingen kunnen zoogdieren herkennen..."
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <ModuleActionButton
            onClick={() => analyze("/api/classify-goal-taxonomy", { goal })}
            disabled={actionDisabled}
            disabledReason="Typ of plak eerst een lesdoel in het invoerveld."
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Brain className="size-4" />}
            Herken taxonomie
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
              <Badge variant="outline">via {result.provider}</Badge>
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
              onClick={() =>
                setActiveGoal(result.data.original, result.data.taxonomy)
              }
            >
              Bewaar taxonomie op actief lesdoel
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
