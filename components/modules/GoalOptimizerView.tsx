"use client";

import { ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { LessonGoalSelector } from "@/components/shared/LessonGoalSelector";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { ModuleInputLayout } from "@/components/shared/ModuleInputLayout";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useSelectedLessonGoal } from "@/hooks/useSelectedLessonGoal";
import { useLessonStore } from "@/stores/useLessonStore";

interface GoalImprovementResult {
  status: "goed" | "verbeterd";
  original: string;
  improved: string;
  rationale: string;
  goalDomain: "MC" | "DAS" | "spreek" | "muzisch";
  removedTerms: string[];
  addedTerms: string[];
  criteria: string[];
  splitRecommendation?: string;
}

export function GoalOptimizerView() {
  const { goals, selectedId, setSelectedId, text, setText, addGoal } =
    useSelectedLessonGoal();
  const replaceGoalText = useLessonStore((state) => state.replaceGoalText);
  const analysisScope = `${selectedId}:${text.trim()}`;
  const { analyze, result, loading, error } =
    useAnalysis<GoalImprovementResult>(analysisScope);
  const actionDisabled = loading || !text.trim();
  const isAlreadyGood =
    result?.data.status === "goed" ||
    (result?.data.original.trim() === result?.data.improved.trim() &&
      result?.data.addedTerms.length === 0 &&
      result?.data.removedTerms.length === 0);

  return (
    <ModuleShell
      moduleId="goal-optimizer"
      title="Doelverbeteraar"
      description="Herschrijft lesdoelen volgens de regels voor een goed lesdoel. Kies het doel dat je wilt verbeteren; doelen uit je handleiding staan automatisch in Actieve les."
      input={
        <ModuleInputLayout
          fields={
            <LessonGoalSelector
              id="goal"
              label="Kies een lesdoel"
              goals={goals}
              selectedId={selectedId}
              onSelect={setSelectedId}
              text={text}
              onTextChange={setText}
              onAddGoal={addGoal}
              placeholder="Leerling kan zoogdieren herkennen..."
            />
          }
          actions={
            <>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <ModuleActionButton
                onClick={() => analyze("/api/analyze-goals", { goal: text })}
                disabled={actionDisabled}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Verbeter {selectedId}
              </ModuleActionButton>
            </>
          }
        />
      }
      output={
        result ? (
          <div className="space-y-4">
            {isAlreadyGood ? (
              <Card>
                <CardContent className="space-y-3 pt-5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-5" />
                    <p className="font-medium">Dit doel is al goed</p>
                  </div>
                  <p className="text-sm leading-6">{result.data.original}</p>
                  <p className="text-sm text-neutral-400">
                    {result.data.rationale}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Visuele verbetering</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-neutral-400 line-through">
                    {result.data.original}
                  </p>
                  <ArrowRight className="size-4 text-neutral-600" />
                  <p className="text-sm leading-6">
                    {result.data.improved}
                  </p>
                  <CopyButton value={result.data.improved} />
                </CardContent>
              </Card>
            )}
            {!isAlreadyGood ? (
              <>
                <Card>
                  <CardContent className="space-y-3 pt-5 text-sm">
                    <p>{result.data.rationale}</p>
                    {result.data.removedTerms.length > 0 && (
                      <p className="text-neutral-500">
                        Verwijderd: {result.data.removedTerms.join(", ")}
                      </p>
                    )}
                    {result.data.addedTerms.length > 0 && (
                      <p className="text-neutral-500">
                        Toegevoegd: {result.data.addedTerms.join(", ")}
                      </p>
                    )}
                    {result.data.splitRecommendation ? (
                      <p className="text-neutral-500">
                        Split-advies: {result.data.splitRecommendation}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
                <Button
                  type="button"
                  onClick={() => {
                    const index = goals.findIndex((goal) => goal.id === selectedId);
                    if (index >= 0) {
                      replaceGoalText(index, result.data.improved);
                    }
                  }}
                >
                  Vervang {selectedId} met verbeterde versie
                </Button>
              </>
            ) : null}
          </div>
        ) : (
          <EmptyOutput>
            Het verbeterde doel en de diff verschijnen hier. Het onderwerp blijft
            behouden.
          </EmptyOutput>
        )
      }
    />
  );
}
