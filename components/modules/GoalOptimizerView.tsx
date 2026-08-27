"use client";

import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useLessonGoalText } from "@/hooks/useLessonText";
import { useLessonStore } from "@/stores/useLessonStore";
import type { GoalTaxonomy } from "@/types";

interface GoalResult {
  original: string;
  improved: string;
  taxonomy: GoalTaxonomy;
  rationale: string;
  removedTerms: string[];
  addedTerms: string[];
  criteria: string[];
}

export function GoalOptimizerView() {
  const [goal, setGoal] = useLessonGoalText();
  const setActiveGoal = useLessonStore((state) => state.setActiveGoal);
  const { analyze, result, loading, error } = useAnalysis<GoalResult>();
  const actionDisabled = loading || !goal.trim();

  return (
    <ModuleShell
      eyebrow="Doelen & curriculum"
      title="Doelverbeteraar & MC–DAS–SPM"
      description="Herschrijft één doel volgens de Thomas More-regels en maakt de verbeteringen zichtbaar."
      input={
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal">Ruw of zelfgeschreven lesdoel</Label>
            <Textarea
              id="goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              rows={8}
              placeholder="De leerlingen begrijpen de Romeinen..."
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <ModuleActionButton
            onClick={() => analyze("/api/analyze-goals", { goal })}
            disabled={actionDisabled}
            disabledReason="Typ of plak eerst een lesdoel in het invoerveld."
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Verbeter lesdoel
          </ModuleActionButton>
        </div>
      }
      output={
        result ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{result.data.taxonomy}</Badge>
              <Badge variant="outline">via {result.provider}</Badge>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-sm">Visuele verbetering</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-red-400 line-through decoration-red-500/70">
                  {result.data.original}
                </p>
                <ArrowRight className="size-4 text-neutral-600" />
                <p className="text-sm leading-6 text-emerald-300">
                  {result.data.improved}
                </p>
                <CopyButton value={result.data.improved} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-3 pt-5 text-sm">
                <p>{result.data.rationale}</p>
                <div className="flex flex-wrap gap-2">
                  {result.data.criteria.map((criterion) => (
                    <Badge key={criterion} variant="secondary">{criterion}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Button onClick={() => setActiveGoal(result.data.improved, result.data.taxonomy)}>
              Zet als actief lesdoel
            </Button>
          </div>
        ) : (
          <EmptyOutput>Het verbeterde doel, de diff en taxonomie verschijnen hier.</EmptyOutput>
        )
      }
    />
  );
}
