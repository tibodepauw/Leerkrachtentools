import type { CurriculumGoal } from "@/types";

const LO10_DISCIPLINES: Record<string, string> = {
  NL: "Nederlands",
  WI: "Wiskunde",
  MM: "Geschiedenis",
  WT: "Wetenschappen en techniek",
  LO: "Lichamelijke opvoeding",
  MV: "Muzische vorming",
};

export function disciplineFromMinimumCode(code: string) {
  const prefix = code.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
  return LO10_DISCIPLINES[prefix] ?? prefix;
}

export function gradeLevelFromMinimumCode(code: string) {
  const match = code.match(/\b(\d)\.\d+\b/u);
  if (!match) return "";
  return `${match[1]}e leerjaar`;
}

export function formatGoalMetadata(goal: CurriculumGoal) {
  const parts = [
    goal.discipline,
    goal.gradeLevel,
    goal.framework,
    goal.schoolYears.length > 0
      ? `schooljaar ${goal.schoolYears.join(", ")}`
      : "",
  ].filter(Boolean);

  return parts.join(" · ");
}
