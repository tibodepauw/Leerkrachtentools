import type {
  CurriculumSearchResult,
  LessonGrade,
  SecondaryFinalityFilter,
  SecondaryGradeFilter,
} from "@/types";

export const SECONDARY_GRADE_FILTER_OPTIONS: Array<{
  value: SecondaryGradeFilter;
  label: string;
}> = [
  { value: "all", label: "Alle graden" },
  { value: "1ste_graad", label: "1ste graad" },
  { value: "2de_graad", label: "2de graad" },
  { value: "3de_graad", label: "3de graad" },
  { value: "7de_specialisatie", label: "7de specialisatiejaar" },
];

export const SECONDARY_FINALITY_FILTER_OPTIONS: Array<{
  value: SecondaryFinalityFilter;
  label: string;
}> = [
  { value: "all", label: "Alle finaliteiten" },
  { value: "doorstroom", label: "Doorstroom (D)" },
  { value: "dubbel", label: "Dubbele finaliteit (D/A)" },
  { value: "arbeidsmarkt", label: "Arbeidsmarkt (A)" },
];

export const SECONDARY_FILTER_BONUS = 0.28;
export const SECONDARY_FILTER_BOTH_BONUS = 0.12;

const GRADE_PATTERNS: Record<
  Exclude<SecondaryGradeFilter, "all">,
  RegExp[]
> = {
  "1ste_graad": [/\b(?:1ste|eerste)\s+graad\b/u, /\b1\s*a\b/u, /\b1\s*b\b/u],
  "2de_graad": [/\b(?:2de|tweede)\s+graad\b/u, /\b3de\s+middelbaar\b/u, /\b4de\s+middelbaar\b/u],
  "3de_graad": [/\b(?:3de|derde)\s+graad\b/u, /\b5de\s+middelbaar\b/u, /\b6de\s+middelbaar\b/u],
  "7de_specialisatie": [
    /\b7de\b/u,
    /\bspecialisatie(?:jaar)?\b/u,
    /\bspecialisatiejaar\b/u,
  ],
};

const FINALITY_PATTERNS: Record<
  Exclude<SecondaryFinalityFilter, "all">,
  RegExp[]
> = {
  doorstroom: [
    /\bdoorstroom(?:finaliteit)?\b/u,
    /\bfinaliteit\s+doorstroom\b/u,
    /\b\(d\)\b/u,
    /\bd-finaliteit\b/u,
  ],
  dubbel: [
    /\bdubbele\s+finaliteit\b/u,
    /\bd\s*\/\s*a\b/u,
    /\bd\/a\b/u,
    /\bd\/a-finaliteit\b/u,
  ],
  arbeidsmarkt: [
    /\barbeidsmarkt(?:finaliteit)?\b/u,
    /\bfinaliteit\s+arbeidsmarkt\b/u,
    /\b\(a\)\b/u,
    /\ba-finaliteit\b/u,
  ],
};

const LESSON_GRADE_TO_FILTER: Partial<Record<LessonGrade, SecondaryGradeFilter>> =
  {
    s1: "1ste_graad",
    s2: "2de_graad",
    s3: "3de_graad",
    s7: "7de_specialisatie",
  };

export function isSecondaryLessonGrade(grade: LessonGrade | ""): grade is "s1" | "s2" | "s3" | "s7" {
  return grade === "s1" || grade === "s2" || grade === "s3" || grade === "s7";
}

export function secondaryGradeFilterFromLessonGrade(
  grade: LessonGrade | "",
): SecondaryGradeFilter | null {
  if (!grade) {
    return null;
  }
  return LESSON_GRADE_TO_FILTER[grade] ?? null;
}

function normalizeHaystack(value: string): string {
  return value
    .toLocaleLowerCase("nl-BE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function secondaryResultHaystack(result: CurriculumSearchResult): string {
  return normalizeHaystack(
    [
      result.leerjaarRoute,
      result.titel,
      result.toelichting,
      result.discipline,
      result.subdomein,
      result.gelinktMinimumdoel?.tekst,
      result.gelinktMinimumdoel?.code,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function matchesSecondaryGradeFilter(
  haystack: string,
  filter: SecondaryGradeFilter,
): boolean {
  if (filter === "all") {
    return false;
  }
  return GRADE_PATTERNS[filter].some((pattern) => pattern.test(haystack));
}

export function matchesSecondaryFinalityFilter(
  haystack: string,
  filter: SecondaryFinalityFilter,
): boolean {
  if (filter === "all") {
    return false;
  }
  return FINALITY_PATTERNS[filter].some((pattern) => pattern.test(haystack));
}

export function scoreSecondaryFilterBonus(
  filters: {
    secondaryGrade?: SecondaryGradeFilter;
    secondaryFinality?: SecondaryFinalityFilter;
  },
  result: CurriculumSearchResult,
): number {
  const gradeFilter = filters.secondaryGrade ?? "all";
  const finalityFilter = filters.secondaryFinality ?? "all";

  if (gradeFilter === "all" && finalityFilter === "all") {
    return 0;
  }

  const haystack = secondaryResultHaystack(result);
  if (!haystack) {
    return 0;
  }

  const gradeMatch =
    gradeFilter !== "all" && matchesSecondaryGradeFilter(haystack, gradeFilter);
  const finalityMatch =
    finalityFilter !== "all" &&
    matchesSecondaryFinalityFilter(haystack, finalityFilter);

  if (gradeMatch && finalityMatch) {
    return SECONDARY_FILTER_BONUS + SECONDARY_FILTER_BOTH_BONUS;
  }
  if (gradeMatch || finalityMatch) {
    return SECONDARY_FILTER_BONUS;
  }

  return 0;
}

export function formatSecondaryRouteLabel(
  graad?: string,
  finaliteit?: string,
  leerjaarRoute?: string,
): string {
  const parts = [graad, finaliteit, leerjaarRoute]
    .map((value) => value?.trim())
    .filter(Boolean);
  return [...new Set(parts)].join(" · ");
}
