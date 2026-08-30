import { ahovoksMetaFromGoal } from "@/lib/rag/ahovoksMinimumGoals";
import { gradeOption } from "@/lib/lesson/targetGroup";
import type {
  CurriculumSearchResult,
  DomainDetailFilter,
  EducationLevelFilter,
  LessonGrade,
  SecondaryFinalityFilter,
  SecondaryGradeFilter,
} from "@/types";
import { scoreDomainFilterBonus } from "@/lib/lesson/domainFilters";
import { scoreSecondaryFilterBonus } from "@/lib/lesson/secondaryFilters";

export const TARGET_GROUP_BONUS = 0.15;

export interface TargetGroupContext {
  grade?: LessonGrade | "" | null;
  ageRange?: string | null;
  secondaryGrade?: SecondaryGradeFilter;
  secondaryFinality?: SecondaryFinalityFilter;
  domainDetail?: DomainDetailFilter;
  domainFinality?: DomainDetailFilter;
  educationLevel?: EducationLevelFilter;
}

type AgeBounds = { min: number; max: number };

function normalizeHaystack(value: string): string {
  return value
    .toLocaleLowerCase("nl-BE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function parseAgeBounds(ageRange: string): AgeBounds | null {
  const normalized = ageRange
    .toLocaleLowerCase("nl-BE")
    .replace(/jaar/g, "")
    .replace(/\s+/g, "")
    .trim();

  const rangeMatch = normalized.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)j?$/);
  if (rangeMatch) {
    return {
      min: Number.parseFloat(rangeMatch[1]),
      max: Number.parseFloat(rangeMatch[2]),
    };
  }

  const singleMatch = normalized.match(/^(\d+(?:\.\d+)?)j?$/);
  if (singleMatch) {
    const value = Number.parseFloat(singleMatch[1]);
    return { min: value, max: value };
  }

  return null;
}

function rangesOverlap(left: AgeBounds, right: AgeBounds): boolean {
  return left.min <= right.max && right.min <= left.max;
}

function extractAgeRangesFromText(text: string): AgeBounds[] {
  const normalized = normalizeHaystack(text);
  const ranges: AgeBounds[] = [];

  for (const match of normalized.matchAll(
    /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*j/g,
  )) {
    ranges.push({
      min: Number.parseFloat(match[1]),
      max: Number.parseFloat(match[2]),
    });
  }

  for (const match of normalized.matchAll(/\b(\d+(?:\.\d+)?)\s*j\b/g)) {
    const value = Number.parseFloat(match[1]);
    ranges.push({ min: value, max: value });
  }

  return ranges;
}

function matchesGradeTerms(grade: LessonGrade, haystack: string): boolean {
  const option = gradeOption(grade);
  if (!option) {
    return false;
  }

  return option.matchTerms.some((term) => haystack.includes(normalizeHaystack(term)));
}

function matchesAhovoksIjkpunt(grade: LessonGrade, haystack: string): boolean {
  if (["peuters", "k1", "k2", "k3"].includes(grade)) {
    return (
      haystack.includes("kleuter") ||
      haystack.includes("ontwikkelingsdoel") ||
      haystack.includes("k-")
    );
  }
  if (grade === "l4") {
    return haystack.includes("4de leerjaar");
  }
  if (grade === "l6") {
    return (
      haystack.includes("6de leerjaar") || haystack.includes("einddoel")
    );
  }
  return false;
}

function resultHaystack(result: CurriculumSearchResult): string {
  return normalizeHaystack(
    [
      result.leerjaarRoute,
      result.titel,
      result.toelichting,
      result.discipline,
      result.subdomein,
      result.gelinktMinimumdoel?.tekst,
      result.gelinktMinimumdoel?.code,
      result.gelinktMinimumdoel?.ijkpuntLabel,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function scoreTargetGroupBonus(
  context: TargetGroupContext,
  result: CurriculumSearchResult,
): number {
  const grade = context.grade?.trim() as LessonGrade | "" | undefined;
  const ageRange = context.ageRange?.trim() ?? "";

  if (!grade && !ageRange) {
    return 0;
  }

  const haystack = resultHaystack(result);
  if (!haystack) {
    return 0;
  }

  if (grade && grade !== "custom" && matchesGradeTerms(grade, haystack)) {
    return TARGET_GROUP_BONUS;
  }

  const selectedBounds =
    parseAgeBounds(ageRange) ?? (grade ? parseAgeBounds(gradeOption(grade)?.ageRange ?? "") : null);

  if (selectedBounds) {
    const corpusRanges = extractAgeRangesFromText(haystack);
    if (corpusRanges.some((range) => rangesOverlap(selectedBounds, range))) {
      return TARGET_GROUP_BONUS;
    }
  }

  if (grade && grade !== "custom") {
    const parsedMinimum = ahovoksMetaFromGoal(result.gelinktMinimumdoel);
    if (parsedMinimum) {
      if (
        (["peuters", "k1", "k2", "k3"].includes(grade) &&
          parsedMinimum.ijkpunt === "kleuter") ||
        (grade === "l4" && parsedMinimum.ijkpunt === "4de") ||
        (grade === "l6" && parsedMinimum.ijkpunt === "6de")
      ) {
        return TARGET_GROUP_BONUS;
      }
    }

    if (matchesAhovoksIjkpunt(grade, haystack)) {
      return TARGET_GROUP_BONUS;
    }
  }

  if (grade === "custom" && ageRange) {
    const customTerms = normalizeHaystack(ageRange)
      .split(/[^a-z0-9.]+/)
      .filter((term) => term.length > 1);
    if (customTerms.some((term) => haystack.includes(term))) {
      return TARGET_GROUP_BONUS;
    }
  }

  return 0;
}

export function applyTargetGroupRanking<T extends CurriculumSearchResult & { score?: number }>(
  results: T[],
  context: TargetGroupContext,
): T[] {
  const hasContext =
    context.grade ||
    context.ageRange?.trim() ||
    (context.secondaryGrade && context.secondaryGrade !== "all") ||
    (context.secondaryFinality && context.secondaryFinality !== "all") ||
    (context.domainDetail && context.domainDetail !== "all") ||
    (context.domainFinality && context.domainFinality !== "all");

  if (!hasContext) {
    return results;
  }

  const educationLevel = context.educationLevel ?? "ALL";

  return [...results]
    .map((result) => ({
      ...result,
      score: Math.min(
        1.45,
        (result.score ?? 0) +
          scoreTargetGroupBonus(context, result) +
          scoreSecondaryFilterBonus(
            {
              secondaryGrade: context.secondaryGrade,
              secondaryFinality: context.secondaryFinality,
            },
            result,
          ) +
          scoreDomainFilterBonus(
            educationLevel,
            {
              domainDetail: context.domainDetail ?? context.secondaryGrade,
              domainFinality: context.domainFinality ?? context.secondaryFinality,
            },
            result,
          ),
      ),
    }))
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
}
