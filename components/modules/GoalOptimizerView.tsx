"use client";

import { ArrowRight, Brain, Loader2, Sparkles } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { EmptyOutput } from "@/components/shared/ModuleShell";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useLessonGoalText } from "@/hooks/useLessonText";
import { useLessonStore } from "@/stores/useLessonStore";
import type { GoalTaxonomy } from "@/types";

interface GoalImprovementResult {
  original: string;
  improved: string;
  rationale: string;
  removedTerms: string[];
  addedTerms: string[];
  criteria: string[];
}

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

function GoalInput({
  goal,
  onGoalChange,
}: {
  goal: string;
  onGoalChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="goal">Ruw of zelfgeschreven lesdoel</Label>
      <Textarea
        id="goal"
        value={goal}
        onChange={(event) => onGoalChange(event.target.value)}
        rows={8}
        placeholder="Leerling kan zoogdieren herkennen..."
      />
    </div>
  );
}

export function GoalOptimizerView() {
  const [goal, setGoal] = useLessonGoalText();
  const setActiveGoal = useLessonStore((state) => state.setActiveGoal);
  const improve = useAnalysis<GoalImprovementResult>();
  const taxonomy = useAnalysis<GoalTaxonomyResult>();
  const actionDisabled = (loading: boolean) => loading || !goal.trim();

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 lg:p-6">
      <div className="mb-6">
        <Badge variant="outline" className="mb-3 text-[10px] uppercase tracking-widest">
          Doelen & curriculum
        </Badge>
        <h1 className="text-2xl font-black tracking-tight">Doelverbeteraar & taxonomie</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
          Verbeter lesdoelen volgens Thomas More, of classificeer ze apart als
          MC, DAS of SPM.
        </p>
      </div>

      <Tabs defaultValue="improve" className="gap-4">
        <TabsList className="h-auto w-full justify-start rounded-full bg-neutral-900 p-1 sm:w-auto">
          <TabsTrigger value="improve" className="rounded-full px-4">
            Doelverbeteraar
          </TabsTrigger>
          <TabsTrigger value="taxonomy" className="rounded-full px-4">
            MC–DAS–SPM herkenner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="improve">
          <div className="grid min-h-[calc(100vh-14rem)] gap-px overflow-hidden rounded-xl border border-neutral-800 bg-neutral-800 xl:grid-cols-2">
            <section className="bg-neutral-950 p-4 sm:p-6">
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Invoer
              </p>
              <div className="space-y-4">
                <GoalInput goal={goal} onGoalChange={setGoal} />
                {improve.error && (
                  <p className="text-sm text-red-400">{improve.error}</p>
                )}
                <ModuleActionButton
                  onClick={() => improve.analyze("/api/analyze-goals", { goal })}
                  disabled={actionDisabled(improve.loading)}
                  disabledReason="Typ of plak eerst een lesdoel in het invoerveld."
                >
                  {improve.loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Verbeter lesdoel
                </ModuleActionButton>
              </div>
            </section>
            <section className="bg-black p-4 sm:p-6">
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Resultaat
              </p>
              {improve.result ? (
                <div className="space-y-4">
                  <Badge variant="outline">via {improve.result.provider}</Badge>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Visuele verbetering</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-red-400 line-through decoration-red-500/70">
                        {improve.result.data.original}
                      </p>
                      <ArrowRight className="size-4 text-neutral-600" />
                      <p className="text-sm leading-6 text-emerald-300">
                        {improve.result.data.improved}
                      </p>
                      <CopyButton value={improve.result.data.improved} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="space-y-3 pt-5 text-sm">
                      <p>{improve.result.data.rationale}</p>
                      {improve.result.data.removedTerms.length > 0 && (
                        <p className="text-neutral-500">
                          Verwijderd: {improve.result.data.removedTerms.join(", ")}
                        </p>
                      )}
                      {improve.result.data.addedTerms.length > 0 && (
                        <p className="text-neutral-500">
                          Toegevoegd: {improve.result.data.addedTerms.join(", ")}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {improve.result.data.criteria.map((criterion) => (
                          <Badge key={criterion} variant="secondary">
                            {criterion}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Button
                    type="button"
                    onClick={() =>
                      setActiveGoal(improve.result!.data.improved, "MC")
                    }
                  >
                    Zet als actief lesdoel
                  </Button>
                </div>
              ) : (
                <EmptyOutput>
                  Het verbeterde doel en de diff verschijnen hier. Het onderwerp
                  blijft behouden.
                </EmptyOutput>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="taxonomy">
          <div className="grid min-h-[calc(100vh-14rem)] gap-px overflow-hidden rounded-xl border border-neutral-800 bg-neutral-800 xl:grid-cols-2">
            <section className="bg-neutral-950 p-4 sm:p-6">
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Invoer
              </p>
              <div className="space-y-4">
                <GoalInput goal={goal} onGoalChange={setGoal} />
                {taxonomy.error && (
                  <p className="text-sm text-red-400">{taxonomy.error}</p>
                )}
                <ModuleActionButton
                  onClick={() =>
                    taxonomy.analyze("/api/classify-goal-taxonomy", { goal })
                  }
                  disabled={actionDisabled(taxonomy.loading)}
                  disabledReason="Typ of plak eerst een lesdoel in het invoerveld."
                >
                  {taxonomy.loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Brain className="size-4" />
                  )}
                  Herken taxonomie
                </ModuleActionButton>
              </div>
            </section>
            <section className="bg-black p-4 sm:p-6">
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Resultaat
              </p>
              {taxonomy.result ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{taxonomy.result.data.taxonomy}</Badge>
                    <Badge variant="secondary">
                      {taxonomyLabels[taxonomy.result.data.taxonomy]}
                    </Badge>
                    <Badge variant="outline">via {taxonomy.result.provider}</Badge>
                  </div>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Geanalyseerd doel</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-6 text-neutral-200">
                        {taxonomy.result.data.original}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="space-y-3 pt-5 text-sm">
                      <p>{taxonomy.result.data.rationale}</p>
                      <p className="text-neutral-400">
                        {taxonomy.result.data.definition}
                      </p>
                      {taxonomy.result.data.indicators.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {taxonomy.result.data.indicators.map((indicator) => (
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
                      setActiveGoal(
                        taxonomy.result!.data.original,
                        taxonomy.result!.data.taxonomy,
                      )
                    }
                  >
                    Bewaar taxonomie op actief lesdoel
                  </Button>
                </div>
              ) : (
                <EmptyOutput>
                  MC, DAS of SPM met uitleg en indicatoren verschijnt hier.
                </EmptyOutput>
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
