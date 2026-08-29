"use client";

import {
  BookOpenCheck,
  ExternalLink,
  Landmark,
  Loader2,
  Sparkles,
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
import { formatSearchResultMetadata } from "@/lib/rag/curriculumDisplay";
import { useSelectedLessonGoal } from "@/hooks/useSelectedLessonGoal";
import { useLessonStore } from "@/stores/useLessonStore";
import type { CurriculumNetworkFilter, CurriculumSearchResult } from "@/types";
import { useState } from "react";

type SearchVariant = "leerplandoel" | "minimumdoel";

interface MatcherResult {
  goal: CurriculumSearchResult | "niet gevonden";
  alternatives: CurriculumSearchResult[];
  summary: string;
  citations: Array<{ title?: string; uri?: string; startIndex?: number }>;
  totalSize: number;
  corpusNotice: string;
  retrievalMode: string;
}

const NETWORK_OPTIONS: Array<{
  value: CurriculumNetworkFilter;
  label: string;
}> = [
  { value: "ALL", label: "Alle netwerken" },
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
    resultTitle: string;
    action: string;
    empty: string;
    defaultNetwork: CurriculumNetworkFilter;
  }
> = {
  leerplandoel: {
    title: "Leerplandoelen zoeken",
    description:
      "Zoekt semantisch in de geïndexeerde leerplandoelen via Google Discovery Engine, verrijkt met officiële codes, disciplines en doelzinnen uit de corpus.",
    resultTitle: "Beste match",
    action: "Zoek leerplandoel",
    empty: "Zoekresultaten met doelcode, discipline en doelzin verschijnen hier.",
    defaultNetwork: "ALL",
  },
  minimumdoel: {
    title: "Minimumdoelen zoeken",
    description:
      "Zoekt in dezelfde curriculumindex met focus op gekoppelde Vlaamse minimumdoelen. Filter optioneel op onderwijsnet.",
    resultTitle: "Beste match · minimumdoel",
    action: "Zoek minimumdoel",
    empty:
      "Gekoppelde minimumdoelen en alternatieven verschijnen hier na je zoekopdracht.",
    defaultNetwork: "ALL",
  },
};

function networkLabel(value: string): string {
  return NETWORK_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function ResultCard({
  title,
  result,
  subdued = false,
  emphasizeMinimum = false,
}: {
  title: string;
  result: CurriculumSearchResult;
  subdued?: boolean;
  emphasizeMinimum?: boolean;
}) {
  const copyValue = [
    result.code,
    result.titel,
    result.gelinktMinimumdoel
      ? `${result.gelinktMinimumdoel.code} — ${result.gelinktMinimumdoel.tekst}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Card className={subdued ? "border-neutral-800/80" : undefined}>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm">{title}</CardTitle>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {result.netwerk && result.netwerk !== "ALL" ? (
              <Badge variant="outline">{networkLabel(result.netwerk)}</Badge>
            ) : null}
            {typeof result.score === "number" ? (
              <Badge variant={subdued ? "outline" : "secondary"}>
                {Math.round(result.score * 100)}%
              </Badge>
            ) : null}
          </div>
        </div>
        {result.code ? (
          <p className="font-mono text-xs text-neutral-500">{result.code}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {result.discipline ? (
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {result.discipline}
            {result.subdomein ? ` · ${result.subdomein}` : ""}
          </p>
        ) : null}

        <p className="text-sm leading-6">{result.titel}</p>

        {result.toelichting ? (
          <Accordion type="single" collapsible>
            <AccordionItem value="toelichting" className="border-neutral-800">
              <AccordionTrigger className="py-2 text-xs text-neutral-400">
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
                ? "rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-3"
                : "rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"
            }
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Gekoppeld minimumdoel
            </p>
            {result.gelinktMinimumdoel.code ? (
              <p className="mt-1 font-mono text-xs text-neutral-500">
                {result.gelinktMinimumdoel.code}
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-6">
              {result.gelinktMinimumdoel.tekst}
            </p>
          </div>
        ) : null}

        <p className="text-xs text-neutral-500">
          {formatSearchResultMetadata(result)}
        </p>

        <div className="flex flex-wrap gap-2">
          <CopyButton value={copyValue} />
          {result.bronUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={result.bronUrl} target="_blank" rel="noreferrer">
                Officiële bron <ExternalLink className="size-3" />
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({
  summary,
  citations,
  totalSize,
}: {
  summary: string;
  citations: MatcherResult["citations"];
  totalSize: number;
}) {
  if (!summary) {
    return null;
  }

  return (
    <Card className="border-violet-900/40 bg-violet-950/10">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet-400" />
          <CardTitle className="text-sm">AI-samenvatting</CardTitle>
        </div>
        <p className="text-xs text-neutral-500">
          Gebaseerd op {totalSize} document{totalSize === 1 ? "" : "en"} in de
          datastore
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-6 text-neutral-200">{summary}</p>
        {citations.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Bronverwijzingen
            </p>
            <ul className="space-y-1 text-xs text-neutral-400">
              {citations.map((citation, index) => (
                <li key={`${citation.uri ?? citation.title ?? index}`}>
                  {citation.uri ? (
                    <a
                      href={citation.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 hover:text-neutral-200"
                    >
                      {citation.title ?? citation.uri}
                    </a>
                  ) : (
                    (citation.title ?? `Bron ${index + 1}`)
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CurriculumSearch({ variant }: { variant: SearchVariant }) {
  const copy = variantCopy[variant];
  const lesson = useLessonStore((state) => state.lesson);
  const [network, setNetwork] = useState<CurriculumNetworkFilter>(
    variant === "leerplandoel"
      ? mapEducationNetwork(lesson.educationNetwork)
      : copy.defaultNetwork,
  );
  const { goals, selectedId, setSelectedId, text, setText } =
    useSelectedLessonGoal();
  const analysisScope = `${variant}:${network}:${selectedId}:${text.trim()}`;
  const { analyze, result, loading, error } =
    useAnalysis<MatcherResult>(analysisScope);
  const actionDisabled = loading || !text.trim();
  const Icon = variant === "minimumdoel" ? Landmark : BookOpenCheck;

  const primaryGoal =
    result?.data.goal === "niet gevonden" ? null : result?.data.goal ?? null;

  const alternatives =
    variant === "minimumdoel" && result
      ? result.data.alternatives.filter(
          (item) => item.gelinktMinimumdoel?.tekst,
        )
      : (result?.data.alternatives ?? []);

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
                    setNetwork(value as CurriculumNetworkFilter)
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
            {result.data.summary ? (
              <SummaryCard
                summary={result.data.summary}
                citations={result.data.citations}
                totalSize={result.data.totalSize}
              />
            ) : null}

            {primaryGoal ? (
              <ResultCard
                title={copy.resultTitle}
                result={primaryGoal}
                emphasizeMinimum={variant === "minimumdoel"}
              />
            ) : (
              <Card className="border-orange-900/60">
                <CardHeader>
                  <CardTitle className="text-sm">{copy.resultTitle}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">Niet gevonden</Badge>
                </CardContent>
              </Card>
            )}

            {alternatives.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  Alternatieven
                </p>
                {alternatives.map((alternative, index) => (
                  <ResultCard
                    key={`${alternative.code}-${alternative.titel}-${index}`}
                    title={`Alternatief ${index + 2}`}
                    result={alternative}
                    subdued
                    emphasizeMinimum={variant === "minimumdoel"}
                  />
                ))}
              </div>
            ) : null}

            <p className="rounded-md border border-neutral-800 bg-neutral-950 p-3 text-xs leading-5 text-neutral-500">
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
): CurriculumNetworkFilter {
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
