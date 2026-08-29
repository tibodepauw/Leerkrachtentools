"use client";

import {
  BookOpenCheck,
  Landmark,
  Loader2,
  Plus,
} from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { LessonGoalSelector } from "@/components/shared/LessonGoalSelector";
import { ModuleActionButton } from "@/components/shared/ModuleActionButton";
import { ModuleInputLayout } from "@/components/shared/ModuleInputLayout";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAnalysis } from "@/hooks/useAnalysis";
import {
  formatGoalCopyText,
  formatMinimumGoalCopyText,
  networkBadgeLabel,
} from "@/lib/rag/curriculumDisplay";
import { useSelectedLessonGoal } from "@/hooks/useSelectedLessonGoal";
import { useLessonStore } from "@/stores/useLessonStore";
import type { CurriculumNetworkFilter, CurriculumSearchResult } from "@/types";
import { useState } from "react";
import { toast } from "sonner";

type SearchVariant = "leerplandoel" | "minimumdoel";

interface MatcherResult {
  goal: CurriculumSearchResult | "niet gevonden";
  alternatives: CurriculumSearchResult[];
  corpusNotice: string;
  retrievalMode: string;
}

const NETWORK_OPTIONS: Array<{
  value: Exclude<CurriculumNetworkFilter, "ALL">;
  label: string;
}> = [
  { value: "OPSTAP", label: "Op.stap · Katholiek onderwijs" },
  { value: "OVSG", label: "OVSG · LeerLokaal" },
  { value: "GO_NIEUW", label: "GO! · Nieuw leerplan" },
  { value: "ZILL", label: "ZILL · Katholiek onderwijs" },
  { value: "GO", label: "GO! · Legacy leerplan" },
];

const variantCopy: Record<
  SearchVariant,
  {
    title: string;
    description: string;
    action: string;
    empty: string;
  }
> = {
  leerplandoel: {
    title: "Leerplandoelen zoeken",
    description:
      "Zoekt semantisch in de geïndexeerde leerplandoelen en toont uitsluitend officiële doelen uit de gestructureerde corpus.",
    action: "Zoek leerplandoel",
    empty: "Officiële doelkaarten met code, discipline en doelzin verschijnen hier.",
  },
  minimumdoel: {
    title: "Minimumdoelen zoeken",
    description:
      "Zoekt leerplandoelen met gekoppelde Vlaamse minimumdoelen. Alleen gestructureerde records uit de officiële corpus.",
    action: "Zoek minimumdoel",
    empty:
      "Doelkaarten met gekoppelde minimumdoelen verschijnen hier na je zoekopdracht.",
  },
};

function GoalCard({
  result,
  onAddToLesson,
  emphasizeMinimum = false,
}: {
  result: CurriculumSearchResult;
  onAddToLesson: (text: string) => void;
  emphasizeMinimum?: boolean;
}) {
  const goalCopy = formatGoalCopyText(result);
  const minimumCopy = result.gelinktMinimumdoel
    ? formatMinimumGoalCopyText(result.gelinktMinimumdoel)
    : null;

  function handleAddToLesson() {
    onAddToLesson(goalCopy);
    toast.success("Doel toegevoegd aan actieve les");
  }

  return (
    <Card className="border-neutral-800/90">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {result.netwerk && result.netwerk !== "ALL" ? (
            <Badge variant="secondary" className="font-medium">
              {networkBadgeLabel(result.netwerk)}
            </Badge>
          ) : null}
          {result.discipline ? (
            <span className="text-xs font-medium text-neutral-300">
              {result.discipline}
            </span>
          ) : null}
          {result.subdomein ? (
            <span className="text-xs text-neutral-500">· {result.subdomein}</span>
          ) : null}
        </div>
        {result.code ? (
          <p className="font-mono text-sm font-bold tracking-tight text-neutral-50">
            {result.code}
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-neutral-100">{result.titel}</p>

        {result.toelichting ? (
          <Accordion type="single" collapsible>
            <AccordionItem value="toelichting" className="border-neutral-800">
              <AccordionTrigger className="py-2 text-xs text-neutral-400 hover:text-neutral-200">
                Toelichting
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-6 text-neutral-300">
                {result.toelichting}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}

        {result.gelinktMinimumdoel ? (
          <div
            className={
              emphasizeMinimum
                ? "rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4"
                : "rounded-lg border border-neutral-800 bg-neutral-950/60 p-4"
            }
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Gekoppeld minimumdoel
            </p>
            {result.gelinktMinimumdoel.code ? (
              <p className="mt-2 font-mono text-xs font-bold text-emerald-300/90">
                {result.gelinktMinimumdoel.code}
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-6 text-neutral-100">
              {result.gelinktMinimumdoel.tekst}
            </p>
          </div>
        ) : null}

        {result.leerjaarRoute ? (
          <p className="text-xs text-neutral-500">{result.leerjaarRoute}</p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <CopyButton value={goalCopy} label="📋 Doel kopiëren" />
          {minimumCopy ? (
            <CopyButton value={minimumCopy} label="📋 Minimumdoel kopiëren" />
          ) : null}
          <Button type="button" variant="default" size="sm" onClick={handleAddToLesson}>
            <Plus className="size-4" />
            Toevoegen aan Actieve les
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CurriculumSearch({ variant }: { variant: SearchVariant }) {
  const copy = variantCopy[variant];
  const lesson = useLessonStore((state) => state.lesson);
  const [network, setNetwork] = useState<Exclude<CurriculumNetworkFilter, "ALL">>(
    () => mapEducationNetwork(lesson.educationNetwork),
  );
  const { goals, selectedId, setSelectedId, text, setText } =
    useSelectedLessonGoal();
  const analysisScope = `${variant}:${network}:${selectedId}:${text.trim()}`;
  const { analyze, result, loading, error } =
    useAnalysis<MatcherResult>(analysisScope);
  const actionDisabled = loading || !text.trim();
  const Icon = variant === "minimumdoel" ? Landmark : BookOpenCheck;

  const results: CurriculumSearchResult[] = result
    ? [
        ...(result.data.goal !== "niet gevonden" ? [result.data.goal] : []),
        ...result.data.alternatives,
      ].filter(
        (item) =>
          item.verrijking !== "fragment" &&
          (variant === "minimumdoel" ? item.gelinktMinimumdoel?.tekst : true),
      )
    : [];

  return (
    <ModuleShell
      title={copy.title}
      description={copy.description}
      input={
        <ModuleInputLayout
          fields={
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Onderwijsnet</Label>
                <Select
                  value={network}
                  onValueChange={(value) =>
                    setNetwork(
                      value as Exclude<CurriculumNetworkFilter, "ALL">,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORK_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <LessonGoalSelector
                id={`${variant}-goal`}
                label="Kies een actief lesdoel"
                goals={goals}
                selectedId={selectedId}
                onSelect={setSelectedId}
                text={text}
                onTextChange={setText}
              />

              <p className="text-xs text-neutral-500">
                {lesson.referenceSchoolYear
                  ? `Referentie: ${lesson.referenceSchoolYear}. Pas dit aan via Actieve les.`
                  : "Schooljaar optioneel instelbaar via Actieve les."}
              </p>
            </div>
          }
          actions={
            <>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <ModuleActionButton
                disabled={actionDisabled}
                disabledReason="Kies eerst een actief lesdoel of vul er één in."
                onClick={() =>
                  analyze("/api/rag-curriculum", {
                    goal: text,
                    network,
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
            </>
          }
        />
      }
      output={
        result ? (
          <div className="space-y-4">
            {results.length > 0 ? (
              <div className="space-y-3">
                {results.map((goalResult, index) => (
                  <GoalCard
                    key={`${goalResult.code}-${goalResult.titel}-${index}`}
                    result={goalResult}
                    onAddToLesson={setText}
                    emphasizeMinimum={variant === "minimumdoel"}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-orange-900/60">
                <CardContent className="py-6">
                  <Badge variant="outline">Geen officiële doelen gevonden</Badge>
                  <p className="mt-3 text-sm text-neutral-400">
                    Er is geen betrouwbare match in de gestructureerde corpus.
                    Probeer een andere formulering of selecteer een ander netwerk.
                  </p>
                </CardContent>
              </Card>
            )}

            <p className="text-xs leading-5 text-neutral-500">
              {result.data.corpusNotice}
            </p>
          </div>
        ) : (
          <EmptyOutput>{copy.empty}</EmptyOutput>
        )
      }
    />
  );
}

function mapEducationNetwork(
  network: "ZILL" | "OVSG" | "GO",
): Exclude<CurriculumNetworkFilter, "ALL"> {
  if (network === "GO") {
    return "GO_NIEUW";
  }
  return network;
}

export function CurriculumRagView() {
  return <CurriculumSearch variant="leerplandoel" />;
}

export function MinimumGoalsView() {
  return <CurriculumSearch variant="minimumdoel" />;
}
