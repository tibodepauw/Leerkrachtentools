"use client";

import { BookOpenCheck, ExternalLink, Loader2 } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useLessonGoalText } from "@/hooks/useLessonText";
import { useLessonStore } from "@/stores/useLessonStore";
import type { CurriculumGoal, EducationNetwork } from "@/types";

type MatchedGoal = (CurriculumGoal & { score: number }) | "niet gevonden";
interface RagResult {
  minimumGoal: MatchedGoal;
  curriculumGoal: MatchedGoal;
  alternatives: unknown;
  futurePlans: Array<{
    code: string;
    version: string;
    approvalStatus: string;
    sourceUrl: string;
  }>;
  mode: string;
  corpusNotice: string;
}

function GoalCard({ title, match }: { title: string; match: MatchedGoal }) {
  if (match === "niet gevonden") {
    return (
      <Card className="border-orange-900/60">
        <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
        <CardContent><Badge variant="outline">niet gevonden</Badge></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant="secondary">{Math.round(match.score * 100)}%</Badge>
        </div>
        <p className="font-mono text-xs text-neutral-500">{match.code}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6">{match.text}</p>
        <p className="text-xs text-neutral-500">{match.domain} · {match.version}</p>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={`${match.code} — ${match.text}`} />
          <Button variant="outline" size="sm" asChild>
            <a href={match.sourceUrl} target="_blank" rel="noreferrer">
              Bron <ExternalLink className="size-3" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CurriculumRagView() {
  const lesson = useLessonStore((state) => state.lesson);
  const setNetwork = useLessonStore((state) => state.setNetwork);
  const [goal, setGoal] = useLessonGoalText();
  const { analyze, result, loading, error } = useAnalysis<RagResult>();
  const actionDisabled = loading || !goal.trim();

  return (
    <ModuleShell
      title="Leerplandoelen matcher"
      description="Zoekt officiële minimumdoelen en leerplandoelen in een lokale, gebrande index. Toekomstige plannen zijn fysiek gescheiden en worden nooit als huidige match gebruikt."
      input={
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Onderwijsnet</Label>
            <Select
              value={lesson.educationNetwork}
              onValueChange={(value) => setNetwork(value as EducationNetwork)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ZILL">Katholiek Onderwijs · ZILL</SelectItem>
                <SelectItem value="OVSG">OVSG · LeerLokaal</SelectItem>
                <SelectItem value="GO">GO!</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="leerplandoel-goal">Actief lesdoel</Label>
            <Textarea
              id="leerplandoel-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              rows={8}
            />
          </div>
          <p className="text-xs text-neutral-500">
            Referentie: {lesson.referenceSchoolYear}. Pas dit aan via “Actieve les”.
          </p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <ModuleActionButton
            disabled={actionDisabled}
            disabledReason="Vul eerst een actief lesdoel in of zet er één via Doelverbeteraar."
            onClick={() =>
              analyze("/api/rag-curriculum", {
                goal,
                network: lesson.educationNetwork,
                schoolYear: lesson.referenceSchoolYear,
              })
            }
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <BookOpenCheck className="size-4" />}
            Zoek officiële koppelingen
          </ModuleActionButton>
        </div>
      }
      output={
        result ? (
          <div className="space-y-4">
            <Badge variant="outline">{result.data.mode}</Badge>
            <GoalCard title="Minimumdoel" match={result.data.minimumGoal} />
            <GoalCard title={`Leerplandoel · ${lesson.educationNetwork}`} match={result.data.curriculumGoal} />
            <p className="rounded-md border border-neutral-800 bg-neutral-950 p-3 text-xs leading-5 text-neutral-500">
              {result.data.corpusNotice}
            </p>
            {result.data.futurePlans.length > 0 && (
              <Card className="border-dashed">
                <CardHeader><CardTitle className="text-xs text-neutral-400">Apart gehouden toekomstplannen</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-xs text-neutral-500">
                  {result.data.futurePlans.map((plan) => <p key={plan.code}>{plan.code} · {plan.approvalStatus}</p>)}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <EmptyOutput>Een minimumdoel en netwerkdoel met bron en matchscore verschijnen hier.</EmptyOutput>
        )
      }
    />
  );
}
