import type { CurriculumSearchResult } from "@/types";
import { dedupeByMinimumGoalCode } from "@/lib/rag/curriculumCorpus";

export const MINIMUM_GOALS_TOP_N = 3;

export type QueryNumericSignal = {
  numbers: number[];
  primaryNumber: number | null;
  phases: Set<MinimumGoalPhase>;
};

export type MinimumGoalPhase = "kommagetallen" | "breuken" | "brug";

const PHASE_PATTERNS: Array<{
  phase: MinimumGoalPhase;
  patterns: RegExp[];
}> = [
  {
    phase: "kommagetallen",
    patterns: [/kommagetallen?/i, /decimale?\s+getallen?/i, /tiende?\s+getallen?/i],
  },
  {
    phase: "breuken",
    patterns: [/breuken?/i, /breukgetallen?/i],
  },
  {
    phase: "brug",
    patterns: [/bruggetallen?/i, /\bbrug\s*getallen?/i],
  },
];

function normalizeNumericText(text: string): string {
  return text
    .toLocaleLowerCase("nl-BE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/(\d)[.\s](\d{3})(?!\d)/g, "$1$2");
}

function parseNumbers(text: string): number[] {
  const normalized = normalizeNumericText(text);
  const matches = normalized.match(/\b\d{1,7}\b/g) ?? [];
  return [...new Set(matches.map((value) => Number.parseInt(value, 10)).filter(Number.isFinite))];
}

function extractPhases(text: string): Set<MinimumGoalPhase> {
  const normalized = normalizeNumericText(text);
  const phases = new Set<MinimumGoalPhase>();
  for (const { phase, patterns } of PHASE_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      phases.add(phase);
    }
  }
  return phases;
}

export function extractQuerySignals(query: string): QueryNumericSignal {
  const normalized = normalizeNumericText(query);
  const numbers = parseNumbers(normalized);
  const totMatch = normalized.match(
    /(?:tot(?:\s+en\s+met)?|t\/m|tem|max(?:imaal)?|totaan)\s+(\d{1,7})/,
  );
  const primaryNumber = totMatch
    ? Number.parseInt(totMatch[1], 10)
    : numbers.length === 1
      ? numbers[0]
      : null;

  return {
    numbers,
    primaryNumber,
    phases: extractPhases(normalized),
  };
}

function goalHaystack(result: CurriculumSearchResult): string {
  return [
    result.gelinktMinimumdoel?.tekst,
    result.gelinktMinimumdoel?.code,
    result.titel,
    result.leerjaarRoute,
    result.toelichting,
    result.subdomein,
  ]
    .filter(Boolean)
    .join(" ");
}

function numbersConflict(queryNumber: number, candidateNumber: number): boolean {
  if (queryNumber === candidateNumber) {
    return false;
  }
  if (queryNumber <= 100 && candidateNumber >= 1000) {
    return true;
  }
  if (queryNumber <= 1000 && candidateNumber >= 10000) {
    return true;
  }
  if (queryNumber >= 10 && candidateNumber >= 10) {
    const ratio = Math.max(queryNumber, candidateNumber) / Math.min(queryNumber, candidateNumber);
    return ratio >= 10;
  }
  return false;
}

export function applyMinimumGoalRangeBonus(
  query: string,
  result: CurriculumSearchResult,
  baseScore: number,
): number {
  const signals = extractQuerySignals(query);
  const haystack = goalHaystack(result);
  const textNumbers = parseNumbers(haystack);
  const textPhases = extractPhases(haystack);

  let score = baseScore;

  for (const phase of signals.phases) {
    if (textPhases.has(phase)) {
      score += 0.18;
    } else {
      score -= 0.12;
    }
  }

  const primary =
    signals.primaryNumber ??
    (signals.numbers.length === 1 ? signals.numbers[0] : null);

  if (primary !== null) {
    if (textNumbers.includes(primary)) {
      score += 0.28;
    } else if (textNumbers.some((value) => numbersConflict(primary, value))) {
      score -= 0.35;
    } else if (
      signals.numbers.some((queryNumber) => textNumbers.includes(queryNumber))
    ) {
      score += 0.1;
    }
  } else if (signals.numbers.length > 0) {
    const sharedNumbers = signals.numbers.filter((value) =>
      textNumbers.includes(value),
    );
    if (sharedNumbers.length > 0) {
      score += 0.12;
    }
  }

  return Math.max(0, Math.min(1, score));
}

export function rankMinimumGoalResults(
  query: string,
  results: Array<CurriculumSearchResult & { score?: number }>,
  limit = MINIMUM_GOALS_TOP_N,
): Array<CurriculumSearchResult & { score?: number }> {
  const adjusted = results.map((result) => ({
    ...result,
    score: applyMinimumGoalRangeBonus(query, result, result.score ?? 0),
  }));

  return dedupeByMinimumGoalCode(adjusted, limit);
}
