"use client";

import {
  BookOpenCheck,
  Landmark,
  Loader2,
  Plus,
} from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { LessonGoalSelector } from "@/components/shared/LessonGoalSelector";
import { ModuleErrorBoundary } from "@/components/shared/ModuleErrorBoundary";
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
  formatGoalTitleParts,
  formatMinimumGoalCopyText,
  networkBadgeLabel,
  sanitizeCurriculumText,
} from "@/lib/rag/curriculumDisplay";
import { preferenceToFilter } from "@/lib/lesson/educationLevelPreference";
import { formatMinimumGoalCopy } from "@/lib/rag/minimumGoalCopy";
import { useSelectedLessonGoal } from "@/hooks/useSelectedLessonGoal";
import { useLessonStore } from "@/stores/useLessonStore";
import type {
  CurriculumNetworkFilter,
  CurriculumSearchResult,
  EducationLevelFilter,
  EducationLevelPreference,
} from "@/types";
import { useState } from "react";
import { toast } from "sonner";

type SearchVariant = "leerplandoel" | "minimumdoel";

interface MatcherResult {
  goal: CurriculumSearchResult | "niet gevonden";
  alternatives: CurriculumSearchResult[];
  corpusNotice: string;
  networkFallbackNotice?: string;
  retrievalMode: string;
}

const NETWORK_OPTIONS: Array<{
  value: CurriculumNetworkFilter;
  label: string;
}> = [
  { value: "ALL", label: "Alle leerplannen" },
  { value: "OPSTAP", label: "Op.stap · Katholiek onderwijs" },
  { value: "OVSG", label: "OVSG · LeerLokaal" },
  { value: "GO_NIEUW", label: "GO! · Nieuw leerplan" },
  { value: "ZILL", label: "ZILL · Katholiek onderwijs" },
  { value: "GO", label: "GO! · Legacy leerplan" },
  { value: "KOV", label: "Katholiek onderwijs · Secundair" },
  { value: "POV", label: "Provinciaal onderwijs · Secundair" },
];

const EDUCATION_LEVEL_OPTIONS: Array<{
  value: EducationLevelPreference;
  label: string;
}> = [
  { value: "kleuteronderwijs", label: "Kleuteronderwijs" },
  { value: "lager_onderwijs", label: "Lager onderwijs" },
  { value: "secundair_onderwijs", label: "Secundair onderwijs" },
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
      "Zoekt het bestpassende Vlaamse minimumdoel bij je lesdoel in basisonderwijs of secundair onderwijs.",
    action: "Zoek minimumdoel",
    empty:
      "Minimumdoelkaarten met code, graad of leerjaar en doelzin verschijnen hier na je zoekopdracht.",
  },
};

function GoalCard({
  result,
  onAddToLesson,
}: {
  result: CurriculumSearchResult;
  onAddToLesson: (text: string) => void;
}) {
  const goalCopy = formatGoalCopyText(result);
  const { code, titel } = formatGoalTitleParts(result);
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
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-foreground">
          {code ? (
            <>
              <strong className="mr-2 inline font-bold font-mono">{code}</strong>
              {titel}
            </>
          ) : (
            titel
          )}
        </p>

        {result.toelichting ? (
          <Accordion type="single" collapsible>
            <AccordionItem value="toelichting" className="border-neutral-800">
              <AccordionTrigger className="py-2 text-xs text-neutral-400 hover:text-neutral-200">
                Toelichting
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-6 text-neutral-300">
                {sanitizeCurriculumText(result.toelichting)}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}

        {result.gelinktMinimumdoel ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Gekoppeld minimumdoel
            </p>
            {result.gelinktMinimumdoel.code ? (
              <p className="mt-2 font-mono text-xs font-bold text-emerald-300/90">
                {sanitizeCurriculumText(result.gelinktMinimumdoel.code)}
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-6 text-neutral-100">
              {sanitizeCurriculumText(result.gelinktMinimumdoel.tekst)}
            </p>
          </div>
        ) : null}

        {result.leerjaarRoute ? (
          <p className="text-xs text-neutral-500">
            {sanitizeCurriculumText(result.leerjaarRoute)}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <CopyButton value={goalCopy} label="Doel kopiëren" />
          {minimumCopy ? (
            <CopyButton value={minimumCopy} label="Minimumdoel kopiëren" />
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

function MinimumGoalCard({
  result,
  onAddToLesson,
  rank,
  isBestMatch = false,
}: {
  result: CurriculumSearchResult;
  onAddToLesson: (text: string) => void;
  rank: number;
  isBestMatch?: boolean;
}) {
  const minimum = result.gelinktMinimumdoel;
  if (!minimum?.tekst) {
    return null;
  }

  const minimumCopy = formatMinimumGoalCopy(minimum);
  const ijkpuntLabel =
    minimum.ijkpuntLabel ?? result.leerjaarRoute ?? "Minimumdoel";

  function handleAddToLesson() {
    onAddToLesson(minimumCopy);
    toast.success("Minimumdoel toegevoegd aan actieve les");
  }

  return (
    <Card
      className={
        isBestMatch
          ? "border-emerald-700/60 bg-emerald-950/10 ring-1 ring-emerald-900/40"
          : "border-emerald-900/40 bg-emerald-950/5"
      }
    >
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {isBestMatch ? (
            <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">
              Beste match #{rank}
            </Badge>
          ) : (
            <Badge variant="outline">Alternatief #{rank}</Badge>
          )}
          <Badge variant="secondary">{ijkpuntLabel}</Badge>
          {result.discipline ? (
            <span className="text-xs font-medium text-neutral-300">
              {result.discipline}
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-neutral-100">
          {minimum.code ? (
            <>
              <strong className="mr-2 inline font-bold font-mono">
                {sanitizeCurriculumText(minimum.code)}
              </strong>
              {sanitizeCurriculumText(minimum.tekst)}
            </>
          ) : (
            sanitizeCurriculumText(minimum.tekst)
          )}
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <CopyButton value={minimumCopy} label="Minimumdoel kopiëren" />
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
  const [network, setNetwork] = useState<CurriculumNetworkFilter>(() =>
    mapEducationNetwork(lesson.educationNetwork),
  );
  const educationLevel = useLessonStore((state) => state.educationLevel);
  const setEducationLevel = useLessonStore((state) => state.setEducationLevel);
  const educationLevelFilter = preferenceToFilter(educationLevel);
  const { goals, selectedId, setSelectedId, text, setText, addGoal } =
    useSelectedLessonGoal();
  const analysisScope =
    variant === "minimumdoel"
      ? `${variant}:${educationLevelFilter}:${selectedId}:${text.trim()}:${lesson.grade}:${lesson.ageRange}`
      : `${variant}:${network}:${educationLevelFilter}:${selectedId}:${text.trim()}:${lesson.grade}:${lesson.ageRange}`;
  const { analyze, result, loading, error } =
    useAnalysis<MatcherResult>(analysisScope);
  const actionDisabled = loading || !text.trim();
  const Icon = variant === "minimumdoel" ? Landmark : BookOpenCheck;

  const results: CurriculumSearchResult[] = result
    ? [
        ...(result.data.goal !== "niet gevonden" ? [result.data.goal] : []),
        ...result.data.alternatives,
      ]
        .filter(
          (item) =>
            (item.verrijking !== "fragment" ||
              result.data.retrievalMode === "semantic-fallback") &&
            (variant === "minimumdoel" ? item.gelinktMinimumdoel?.tekst : true),
        )
        .slice(0, variant === "minimumdoel" ? 3 : 5)
    : [];

  const moduleId = variant === "minimumdoel" ? "minimum-goals" : "curriculum-rag";
  const visibleNetworks = networkOptionsForLevel(educationLevelFilter);

  function handleEducationLevelChange(value: EducationLevelPreference) {
    setEducationLevel(value);
    const options = networkOptionsForLevel(preferenceToFilter(value));
    if (!options.some((option) => option.value === network)) {
      setNetwork(options[0]?.value ?? "ALL");
    }
  }

  return (
    <ModuleShell
      moduleId={moduleId}
      title={copy.title}
      description={copy.description}
      input={
        <ModuleInputLayout
          fields={
            <div className="space-y-5">
              <div
                className={
                  variant === "leerplandoel"
                    ? "grid gap-4 sm:grid-cols-2"
                    : undefined
                }
              >
                {variant === "leerplandoel" ? (
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
                        {visibleNetworks.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>Onderwijsniveau</Label>
                  <Select
                    value={educationLevel}
                    onValueChange={(value) =>
                      handleEducationLevelChange(
                        value as EducationLevelPreference,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EDUCATION_LEVEL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <LessonGoalSelector
                id={`${variant}-goal`}
                label="Kies een actief lesdoel"
                goals={goals}
                selectedId={selectedId}
                onSelect={setSelectedId}
                text={text}
                onTextChange={setText}
                onAddGoal={addGoal}
              />

              {variant === "leerplandoel" ? (
                <p className="text-xs text-neutral-500">
                  {lesson.displayTargetGroup || lesson.referenceSchoolYear
                    ? [
                        lesson.displayTargetGroup
                          ? `Doelgroep: ${lesson.displayTargetGroup}`
                          : null,
                        lesson.referenceSchoolYear
                          ? `Referentie: ${lesson.referenceSchoolYear}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : "Doelgroep en schooljaar instelbaar via Actieve les."}
                </p>
              ) : (
                <p className="text-xs text-neutral-500">
                  {minimumGoalHelperText(
                    educationLevelFilter,
                    lesson.displayTargetGroup,
                  )}
                </p>
              )}
            </div>
          }
          actions={
            <>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <ModuleActionButton
                disabled={actionDisabled}
                onClick={() =>
                  analyze(
                    variant === "minimumdoel"
                      ? "/api/rag-minimum-goals"
                      : "/api/rag-curriculum",
                    variant === "minimumdoel"
                      ? {
                          goal: text,
                          educationLevel: educationLevelFilter,
                          grade: lesson.grade,
                          ageRange: lesson.ageRange,
                        }
                      : {
                          goal: text,
                          network,
                          educationLevel: educationLevelFilter,
                          grade: lesson.grade,
                          ageRange: lesson.ageRange,
                        },
                  )
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
                {variant === "leerplandoel" && result.data.networkFallbackNotice ? (
                  <Card className="border-amber-900/50 bg-amber-950/20">
                    <CardContent className="py-4 text-sm leading-6 text-amber-100/90">
                      {result.data.networkFallbackNotice}
                    </CardContent>
                  </Card>
                ) : null}
                {variant === "leerplandoel" ? (
                  <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                    Top {Math.min(results.length, 5)} leerplandoel
                    {Math.min(results.length, 5) === 1 ? "" : "en"}
                  </p>
                ) : null}
                {variant === "minimumdoel" ? (
                  <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                    Top {Math.min(results.length, 3)} minimumdoel
                    {Math.min(results.length, 3) === 1 ? "" : "en"}
                  </p>
                ) : null}
                {results.map((goalResult, index) =>
                  variant === "minimumdoel" ? (
                    <MinimumGoalCard
                      key={`${goalResult.gelinktMinimumdoel?.code}-${index}`}
                      result={goalResult}
                      onAddToLesson={setText}
                      rank={index + 1}
                      isBestMatch={index === 0}
                    />
                  ) : (
                    <GoalCard
                      key={`${goalResult.code}-${goalResult.titel}-${index}`}
                      result={goalResult}
                      onAddToLesson={setText}
                    />
                  ),
                )}
              </div>
            ) : (
              <Card className="border-orange-900/60">
                <CardContent className="py-6">
                  <Badge variant="outline">
                    {variant === "minimumdoel"
                      ? "Geen minimumdoelen gevonden"
                      : "Geen officiële doelen gevonden"}
                  </Badge>
                  <p className="mt-3 text-sm text-neutral-400">
                    {variant === "minimumdoel"
                      ? "Er is geen passend Vlaams minimumdoel gevonden. Probeer je lesdoel anders te formuleren."
                      : "Er is geen betrouwbare match in de gestructureerde corpus. Probeer een andere formulering of selecteer een ander netwerk."}
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

function networkOptionsForLevel(
  level: EducationLevelFilter,
): Array<{ value: CurriculumNetworkFilter; label: string }> {
  if (level === "SECUNDAIR") {
    return NETWORK_OPTIONS.filter((option) =>
      ["ALL", "GO", "KOV", "POV", "OVSG"].includes(option.value),
    );
  }
  if (level === "KLEUTER" || level === "LAGER") {
    return NETWORK_OPTIONS.filter((option) =>
      ["ALL", "OPSTAP", "OVSG", "GO_NIEUW", "ZILL"].includes(option.value),
    );
  }
  return NETWORK_OPTIONS;
}

function minimumGoalHelperText(
  level: EducationLevelFilter,
  targetGroup?: string,
): string {
  const prefix = targetGroup
    ? `Doelgroep: ${targetGroup} - leeftijdsspecifieke doelen krijgen een zachte bonus, maar blijven altijd zichtbaar. `
    : "Stel een doelgroep in via Actieve les voor leeftijdsgerichte ranking. ";

  if (level === "SECUNDAIR") {
    return `${prefix}We tonen minimumdoelen per graad, finaliteit (doorstroom, dubbel, arbeidsmarkt) en sleutelcompetentie (SC 1-16).`;
  }
  if (level === "KLEUTER" || level === "LAGER") {
    return `${prefix}We tonen minimumdoelen op vaste ijkpunten: 4de leerjaar, 6de leerjaar of kleuter (K-codes).`;
  }
  return `${prefix}Basisonderwijs: minimumdoelen (4de, 6de, kleuter). Secundair: minimumdoelen per graad en SC 1-16.`;
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
  return (
    <ModuleErrorBoundary moduleName="Leerplandoelen">
      <CurriculumSearch variant="leerplandoel" />
    </ModuleErrorBoundary>
  );
}

export function MinimumGoalsView() {
  return (
    <ModuleErrorBoundary moduleName="Minimumdoelen">
      <CurriculumSearch variant="minimumdoel" />
    </ModuleErrorBoundary>
  );
}
