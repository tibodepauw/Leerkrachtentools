"use client";

import {
  BookOpenCheck,
  ExternalLink,
  Landmark,
  Loader2,
} from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import { LessonGoalSelector } from "@/components/shared/LessonGoalSelector";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
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
import { useAnalysis } from "@/hooks/useAnalysis";
import { useSelectedLessonGoal } from "@/hooks/useSelectedLessonGoal";
import { useLessonStore } from "@/stores/useLessonStore";
import type {
  CurriculumGoal,
  EducationNetwork,
} from "@/types";

type GoalSource = CurriculumGoal["source"];
type MatchedGoal = (CurriculumGoal & { score: number }) | "niet gevonden";

interface MatcherResult {
  goal: MatchedGoal;
  alternatives: Array<CurriculumGoal & { score: number }>;
  futurePlans: Array<{
    code: string;
    version: string;
    approvalStatus: string;
    sourceUrl: string;
  }>;
  corpusNotice: string;
}

const sourceCopy: Record<
  GoalSource,
  {
    title: string;
    description: string;
    resultTitle: string;
    action: string;
    empty: string;
  }
> = {
  leerplandoel: {
    title: "Leerplandoelen matcher",
    description:
      "Zoekt een passend leerplandoel binnen het leerplan van het gekozen onderwijsnet.",
    resultTitle: "Leerplandoel",
    action: "Zoek leerplandoel",
    empty:
      "De beste match en alternatieven met score verschijnen hier.",
  },
  minimumdoel: {
    title: "Minimumdoelen matcher",
    description:
      "Zoekt een passend minimumdoel van de Vlaamse overheid, onafhankelijk van het onderwijsnet.",
    resultTitle: "Minimumdoel Vlaamse overheid",
    action: "Zoek minimumdoel",
    empty:
      "De beste match en alternatieven met score verschijnen hier.",
  },
};

function GoalCard({
  title,
  match,
  subdued = false,
}: {
  title: string;
  match: MatchedGoal;
  subdued?: boolean;
}) {
  if (match === "niet gevonden") {
    return (
      <Card className="border-orange-900/60">
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="outline">Niet gevonden</Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={subdued ? "border-neutral-800/80" : undefined}>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant={subdued ? "outline" : "secondary"}>
            {Math.round(match.score * 100)}%
          </Badge>
        </div>
        <p className="font-mono text-xs text-neutral-500">{match.code}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6">{match.text}</p>
        <p className="text-xs text-neutral-500">
          {match.domain} · {match.version}
        </p>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={`${match.code} — ${match.text}`} />
          <Button variant="outline" size="sm" asChild>
            <a href={match.sourceUrl} target="_blank" rel="noreferrer">
              Officiële bron <ExternalLink className="size-3" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function GoalMatcher({ source }: { source: GoalSource }) {
  const copy = sourceCopy[source];
  const lesson = useLessonStore((state) => state.lesson);
  const setNetwork = useLessonStore((state) => state.setNetwork);
  const { goals, selectedId, setSelectedId, text, setText } =
    useSelectedLessonGoal();
  const analysisScope = `${source}:${selectedId}:${text.trim()}`;
  const { analyze, result, loading, error } =
    useAnalysis<MatcherResult>(analysisScope);
  const actionDisabled = loading || !text.trim();
  const Icon = source === "minimumdoel" ? Landmark : BookOpenCheck;

  return (
    <ModuleShell
      title={copy.title}
      description={copy.description}
      input={
        <div className="space-y-5">
          {source === "leerplandoel" ? (
            <div className="space-y-2">
              <Label>Onderwijsnet</Label>
              <Select
                value={lesson.educationNetwork}
                onValueChange={(value) =>
                  setNetwork(value as EducationNetwork)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZILL">
                    Katholiek Onderwijs · ZILL
                  </SelectItem>
                  <SelectItem value="OVSG">OVSG · LeerLokaal</SelectItem>
                  <SelectItem value="GO">GO!</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-800 p-3 text-sm">
              <p className="font-medium">Bronniveau: Vlaamse overheid</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Minimumdoelen gelden over de onderwijsnetten heen. Daarom hoef
                je hier geen onderwijsnet te kiezen.
              </p>
            </div>
          )}

          <LessonGoalSelector
            id={`${source}-goal`}
            label="Kies een actief lesdoel"
            goals={goals}
            selectedId={selectedId}
            onSelect={setSelectedId}
            text={text}
            onTextChange={setText}
            rows={8}
          />

          <p className="text-xs text-neutral-500">
            {lesson.referenceSchoolYear
              ? `Referentie: ${lesson.referenceSchoolYear}. Pas dit aan via Actieve les.`
              : "Schooljaar optioneel instelbaar via Actieve les."}
          </p>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <ModuleActionButton
            disabled={actionDisabled}
            disabledReason="Kies eerst een actief lesdoel of vul er één in."
            onClick={() =>
              analyze("/api/rag-curriculum", {
                goal: text,
                source,
                network:
                  source === "leerplandoel"
                    ? lesson.educationNetwork
                    : undefined,
                schoolYear: lesson.referenceSchoolYear,
              })
            }
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Icon className="size-4" />
            )}
            {copy.action}
          </ModuleActionButton>
        </div>
      }
      output={
        result ? (
          <div className="space-y-4">
            <GoalCard
              title={
                source === "leerplandoel"
                  ? `Beste match · ${lesson.educationNetwork}`
                  : "Beste match · Vlaamse overheid"
              }
              match={result.data.goal}
            />
            {result.data.alternatives.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  Alternatieven
                </p>
                {result.data.alternatives.map((alternative, index) => (
                  <GoalCard
                    key={alternative.id}
                    title={`Alternatief ${index + 2}`}
                    match={alternative}
                    subdued
                  />
                ))}
              </div>
            ) : null}
            <p className="rounded-md border border-neutral-800 bg-neutral-950 p-3 text-xs leading-5 text-neutral-500">
              {result.data.corpusNotice}
            </p>
            {result.data.futurePlans.length > 0 ? (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-xs text-neutral-400">
                    Apart gehouden toekomstplannen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-neutral-500">
                  {result.data.futurePlans.map((plan) => (
                    <p key={plan.code}>
                      {plan.code} · {plan.approvalStatus}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : (
          <EmptyOutput>{copy.empty}</EmptyOutput>
        )
      }
    />
  );
}

export function CurriculumRagView() {
  return <GoalMatcher source="leerplandoel" />;
}

export function MinimumGoalsView() {
  return <GoalMatcher source="minimumdoel" />;
}
