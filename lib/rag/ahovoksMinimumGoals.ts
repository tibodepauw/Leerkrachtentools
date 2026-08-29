import type { CurriculumSearchResult, LinkedMinimumGoal } from "@/types";
import { decodeHtmlEntities } from "@/lib/rag/curriculumDisplay";

export type AhovoksIjkpunt = "4de" | "6de" | "kleuter";

export interface AhovoksMinimumGoalMeta {
  rawCode: string;
  displayCode: string;
  ijkpunt: AhovoksIjkpunt;
  ijkpuntLabel: string;
  ijkpuntShort: string;
}

const IJKPUNT_META: Record<
  AhovoksIjkpunt,
  { label: string; short: string }
> = {
  "4de": {
    label: "4de leerjaar",
    short: "4de leerjaar",
  },
  "6de": {
    label: "6de leerjaar (einddoel)",
    short: "6de leerjaar",
  },
  kleuter: {
    label: "Kleuteronderwijs (ontwikkelingsdoel)",
    short: "Kleuteronderwijs",
  },
};

const AHOVOKS_CODE_PATTERN =
  /^(?:([46])-(\d+(?:\.\d+)*)|(K-\d+(?:\.\d+)*))$/iu;

export function isAhovoksMinimumGoalCode(code: string): boolean {
  return parseAhovoksCode(code) !== null;
}

export function parseAhovoksCode(code: string): AhovoksMinimumGoalMeta | null {
  const rawCode = code.trim();
  if (!rawCode) {
    return null;
  }

  const match = rawCode.match(AHOVOKS_CODE_PATTERN);
  if (!match) {
    return null;
  }

  if (match[1] && match[2]) {
    const ijkpunt = match[1] === "4" ? "4de" : "6de";
    const meta = IJKPUNT_META[ijkpunt];
    return {
      rawCode,
      displayCode: match[2],
      ijkpunt,
      ijkpuntLabel: meta.label,
      ijkpuntShort: meta.short,
    };
  }

  const kleuterCode = match[3] ?? rawCode;
  const meta = IJKPUNT_META.kleuter;
  return {
    rawCode,
    displayCode: kleuterCode.toUpperCase().startsWith("K-")
      ? kleuterCode
      : `K-${kleuterCode.replace(/^K-?/iu, "")}`,
    ijkpunt: "kleuter",
    ijkpuntLabel: meta.label,
    ijkpuntShort: meta.short,
  };
}

export function normalizeLinkedMinimumGoal(
  goal: LinkedMinimumGoal,
): (LinkedMinimumGoal & AhovoksMinimumGoalMeta) | null {
  const parsed = parseAhovoksCode(goal.code);
  if (!parsed) {
    return null;
  }

  return {
    ...goal,
    code: parsed.displayCode,
    tekst: decodeHtmlEntities(goal.tekst),
    rawCode: parsed.rawCode,
    ijkpuntLabel: parsed.ijkpuntLabel,
    ijkpuntShort: parsed.ijkpuntShort,
    type: goal.type || parsed.ijkpuntLabel,
  };
}

export function normalizeAhovoksMinimumGoalResult(
  result: CurriculumSearchResult,
): CurriculumSearchResult | null {
  const minimum = result.gelinktMinimumdoel;
  if (!minimum?.tekst) {
    return null;
  }

  const normalizedMinimum = normalizeLinkedMinimumGoal(minimum);
  if (!normalizedMinimum) {
    return null;
  }

  return {
    ...result,
    code: "",
    titel: "",
    toelichting: "",
    leerjaarRoute: normalizedMinimum.ijkpuntLabel,
    gelinktMinimumdoel: normalizedMinimum,
  };
}

export function formatAhovoksMinimumGoalCopy(goal: LinkedMinimumGoal): string {
  const tekst = decodeHtmlEntities(goal.tekst);
  const parsed = parseAhovoksCode(goal.rawCode ?? goal.code);
  if (!parsed) {
    return goal.code ? `[${goal.code}] ${tekst}` : tekst;
  }

  return `[Code ${parsed.displayCode} - ${parsed.ijkpuntShort}] ${tekst}`;
}

export function ahovoksMetaFromGoal(
  goal: LinkedMinimumGoal | null | undefined,
): AhovoksMinimumGoalMeta | null {
  if (!goal) {
    return null;
  }
  return parseAhovoksCode(goal.rawCode ?? goal.code);
}
