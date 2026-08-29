import type { LessonGrade } from "@/types";

export interface GradeOption {
  value: LessonGrade;
  label: string;
  ageRange: string;
  displayTargetGroup: string;
  group: "kleuter" | "lager" | "custom";
  matchTerms: string[];
}

export const GRADE_OPTIONS: GradeOption[] = [
  {
    value: "peuters",
    label: "Instap / Peuters",
    ageRange: "2.5j",
    displayTargetGroup: "Instap/Peuters (2.5j)",
    group: "kleuter",
    matchTerms: ["peuter", "instap", "2.5", "0-2.5"],
  },
  {
    value: "k1",
    label: "1ste kleuter",
    ageRange: "3-4j",
    displayTargetGroup: "1ste kleuter (3-4j)",
    group: "kleuter",
    matchTerms: ["1ste kleuter", "jongste kleuter", "1de kleuter", "3-4"],
  },
  {
    value: "k2",
    label: "2de kleuter",
    ageRange: "4-5j",
    displayTargetGroup: "2de kleuter (4-5j)",
    group: "kleuter",
    matchTerms: ["2de kleuter", "4-5"],
  },
  {
    value: "k3",
    label: "3de kleuter",
    ageRange: "5-6j",
    displayTargetGroup: "3de kleuter (5-6j)",
    group: "kleuter",
    matchTerms: ["3de kleuter", "oudste kleuter", "5-6"],
  },
  {
    value: "l1",
    label: "1ste leerjaar",
    ageRange: "6-7j",
    displayTargetGroup: "1ste leerjaar (6-7j)",
    group: "lager",
    matchTerms: ["1ste leerjaar", "1de leerjaar", "fase 1", "6-7"],
  },
  {
    value: "l2",
    label: "2de leerjaar",
    ageRange: "7-8j",
    displayTargetGroup: "2de leerjaar (7-8j)",
    group: "lager",
    matchTerms: ["2de leerjaar", "2de leer", "7-8"],
  },
  {
    value: "l3",
    label: "3de leerjaar",
    ageRange: "8-9j",
    displayTargetGroup: "3de leerjaar (8-9j)",
    group: "lager",
    matchTerms: ["3de leerjaar", "3de leer", "8-9"],
  },
  {
    value: "l4",
    label: "4de leerjaar",
    ageRange: "9-10j",
    displayTargetGroup: "4de leerjaar (9-10j)",
    group: "lager",
    matchTerms: ["4de leerjaar", "4de leer", "9-10"],
  },
  {
    value: "l5",
    label: "5de leerjaar",
    ageRange: "10-11j",
    displayTargetGroup: "5de leerjaar (10-11j)",
    group: "lager",
    matchTerms: ["5de leerjaar", "5de leer", "10-11"],
  },
  {
    value: "l6",
    label: "6de leerjaar",
    ageRange: "11-12j",
    displayTargetGroup: "6de leerjaar (11-12j)",
    group: "lager",
    matchTerms: ["6de leerjaar", "6de leer", "11-12"],
  },
  {
    value: "custom",
    label: "Aangepast / Graadsklas",
    ageRange: "",
    displayTargetGroup: "",
    group: "custom",
    matchTerms: [],
  },
];

const GRADE_BY_VALUE = new Map(GRADE_OPTIONS.map((option) => [option.value, option]));

export function gradeOption(value: LessonGrade | ""): GradeOption | null {
  if (!value) {
    return null;
  }
  return GRADE_BY_VALUE.get(value) ?? null;
}

export function resolveTargetGroupFields({
  grade,
  customLabel = "",
  customAgeRange = "",
}: {
  grade: LessonGrade | "";
  customLabel?: string;
  customAgeRange?: string;
}): {
  grade: LessonGrade | "";
  ageRange: string;
  displayTargetGroup: string;
  targetGroup: string;
} {
  if (!grade) {
    return {
      grade: "",
      ageRange: "",
      displayTargetGroup: "",
      targetGroup: "",
    };
  }

  if (grade === "custom") {
    const label = customLabel.trim();
    const age = customAgeRange.trim();
    const displayTargetGroup =
      label && age ? `${label} (${age})` : label || age;
    return {
      grade,
      ageRange: age,
      displayTargetGroup,
      targetGroup: displayTargetGroup,
    };
  }

  const option = gradeOption(grade);
  if (!option) {
    return {
      grade: "",
      ageRange: "",
      displayTargetGroup: "",
      targetGroup: "",
    };
  }

  return {
    grade,
    ageRange: option.ageRange,
    displayTargetGroup: option.displayTargetGroup,
    targetGroup: option.displayTargetGroup,
  };
}

export function inferGradeFromLegacyTargetGroup(
  targetGroup: string,
): LessonGrade | "" {
  const normalized = targetGroup
    .toLocaleLowerCase("nl-BE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  for (const option of GRADE_OPTIONS) {
    if (option.value === "custom") {
      continue;
    }
    if (
      option.matchTerms.some((term) => normalized.includes(term)) ||
      normalized.includes(option.displayTargetGroup.toLocaleLowerCase("nl-BE"))
    ) {
      return option.value;
    }
  }

  return targetGroup.trim() ? "custom" : "";
}

export function migrateLessonTargetGroup(lesson: {
  targetGroup?: string;
  grade?: LessonGrade | "";
  ageRange?: string;
  displayTargetGroup?: string;
}): {
  grade: LessonGrade | "";
  ageRange: string;
  displayTargetGroup: string;
  targetGroup: string;
} {
  if (lesson.grade) {
    const resolved = resolveTargetGroupFields({
      grade: lesson.grade,
      customLabel:
        lesson.grade === "custom"
          ? lesson.displayTargetGroup || lesson.targetGroup || ""
          : "",
      customAgeRange: lesson.ageRange ?? "",
    });
    return {
      ...resolved,
      targetGroup: resolved.displayTargetGroup || lesson.targetGroup || "",
    };
  }

  const legacy = lesson.targetGroup?.trim() ?? "";
  if (!legacy) {
    return {
      grade: "",
      ageRange: "",
      displayTargetGroup: "",
      targetGroup: "",
    };
  }

  const inferred = inferGradeFromLegacyTargetGroup(legacy);
  if (inferred && inferred !== "custom") {
    return resolveTargetGroupFields({ grade: inferred });
  }

  return {
    grade: "custom",
    ageRange: lesson.ageRange?.trim() ?? "",
    displayTargetGroup: legacy,
    targetGroup: legacy,
  };
}

export function targetGroupHeaderLabel(lesson: {
  displayTargetGroup?: string;
  targetGroup?: string;
}): string {
  return (
    lesson.displayTargetGroup?.trim() ||
    lesson.targetGroup?.trim() ||
    "Doelgroep nog niet ingevuld"
  );
}
