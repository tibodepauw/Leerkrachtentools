import type { CurriculumSearchResult } from "@/types";

export const CURRICULUM_PRO_RETRIEVAL_N = 15;
export const CURRICULUM_PRO_PICK_MAX = 3;

export const PRO_LESSON_PHASES = [
  "Instap",
  "Instructie",
  "Verwerking",
  "Afronding",
] as const;

export type ProLessonPhase = (typeof PRO_LESSON_PHASES)[number];

export type ProLessonContext = {
  topic: string;
  learningArea: string;
  grade: string;
  ageRange: string;
  phases: Array<{ name: ProLessonPhase; text: string }>;
};

export type GroundedProGoal = CurriculumSearchResult & {
  proWhy: string;
  proLessonPhase: ProLessonPhase;
};

export const PRO_FALLBACK_NOTICES = {
  noProvider:
    "Er is geen AI-provider ingesteld. Dit zijn de snelle zoekkaarten.",
  quota:
    "Het dagelijkse AI-quotum is bereikt. Dit zijn de snelle zoekkaarten.",
  aiError:
    "De didactische analyse is niet gelukt. Dit zijn de snelle zoekkaarten.",
  ungrounded:
    "De AI-selectie kon niet aan officiële doelen worden gekoppeld. Dit zijn de snelle zoekkaarten.",
} as const;

export function parseCurriculumSearchMode(value: unknown): "snel" | "pro" {
  return value === "pro" ? "pro" : "snel";
}

export function normalizeCurriculumCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function isProLessonPhase(value: string): value is ProLessonPhase {
  return (PRO_LESSON_PHASES as readonly string[]).includes(value);
}

function sanitizeSnippet(text: string, max: number): string {
  const trimmed = text.trim().replace(/[\p{C}<>]/gu, "");
  if (trimmed.length <= max) {
    return trimmed;
  }
  return trimmed.slice(0, max).trimEnd();
}

export function withProFallbackSentence(message: string): string {
  const trimmed = message.trim().replace(/\.+$/u, "");
  if (/snelle zoekkaarten/i.test(trimmed)) {
    return `${trimmed}.`;
  }
  return `${trimmed}. Dit zijn de snelle zoekkaarten.`;
}

export function parseProLessonContext(input: {
  topic?: unknown;
  learningArea?: unknown;
  grade?: unknown;
  ageRange?: unknown;
  phases?: unknown;
}): ProLessonContext {
  const phases: ProLessonContext["phases"] = [];
  if (Array.isArray(input.phases)) {
    for (const item of input.phases) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const record = item as { name?: unknown; text?: unknown };
      const name = String(record.name ?? "").trim();
      if (!isProLessonPhase(name)) {
        continue;
      }
      phases.push({
        name,
        text: sanitizeSnippet(String(record.text ?? ""), 400),
      });
      if (phases.length >= 4) {
        break;
      }
    }
  }

  return {
    topic: sanitizeSnippet(String(input.topic ?? ""), 200),
    learningArea: sanitizeSnippet(String(input.learningArea ?? ""), 200),
    grade: sanitizeSnippet(String(input.grade ?? ""), 40),
    ageRange: sanitizeSnippet(String(input.ageRange ?? ""), 80),
    phases,
  };
}

export type ProCurriculumKind = "leerplandoel" | "minimumdoel";

function officialCandidateCode(item: CurriculumSearchResult): string {
  return item.gelinktMinimumdoel?.code?.trim() || item.code;
}

function officialCandidateTitel(item: CurriculumSearchResult): string {
  return item.gelinktMinimumdoel?.tekst?.trim() || item.titel;
}

function registerOfficialCode(
  byCode: Map<string, CurriculumSearchResult>,
  code: string,
  item: CurriculumSearchResult,
) {
  const key = normalizeCurriculumCode(code);
  if (key && !byCode.has(key)) {
    byCode.set(key, item);
  }
}

export function groundProPicks(
  retrieved: CurriculumSearchResult[],
  picks: Array<{ code?: string; why?: string; lessonPhase?: string }>,
): GroundedProGoal[] {
  const byCode = new Map<string, CurriculumSearchResult>();
  for (const item of retrieved) {
    registerOfficialCode(byCode, item.code, item);
    registerOfficialCode(byCode, item.gelinktMinimumdoel?.code ?? "", item);
  }

  const seen = new Set<string>();
  const grounded: GroundedProGoal[] = [];

  for (const pick of picks) {
    if (grounded.length >= CURRICULUM_PRO_PICK_MAX) {
      break;
    }
    const key = normalizeCurriculumCode(String(pick.code ?? ""));
    if (!key || seen.has(key)) {
      continue;
    }
    const official = byCode.get(key);
    if (!official) {
      continue;
    }
    const why = sanitizeSnippet(String(pick.why ?? ""), 400);
    if (!why) {
      continue;
    }
    const phaseRaw = String(pick.lessonPhase ?? "").trim();
    const lessonPhase = isProLessonPhase(phaseRaw) ? phaseRaw : "Verwerking";
    seen.add(key);
    grounded.push({
      ...official,
      proWhy: why,
      proLessonPhase: lessonPhase,
    });
  }

  return grounded;
}

export function buildProCurriculumPrompt({
  query,
  retrieved,
  lesson,
  kind = "leerplandoel",
}: {
  query: string;
  retrieved: CurriculumSearchResult[];
  lesson: ProLessonContext;
  kind?: ProCurriculumKind;
}): string {
  const goals = retrieved.map((item, index) => ({
    nr: index + 1,
    code: officialCandidateCode(item),
    netwerk: item.netwerk,
    discipline: item.discipline,
    subdomein: item.subdomein,
    titel: officialCandidateTitel(item),
    toelichting: sanitizeSnippet(item.toelichting ?? "", 280),
  }));

  const phaseLines =
    lesson.phases.length > 0
      ? lesson.phases
          .map((phase) => `- ${phase.name}: ${phase.text || "(leeg)"}`)
          .join("\n")
      : "- (geen lesfasen ingevuld)";

  const corpusLabel =
    kind === "minimumdoel"
      ? "Vlaamse minimumdoelen"
      : "officiële leerplandoelen";

  return `Lesactiviteit of lesdoel van de leerkracht:
${query}

Doelgroep: graad ${lesson.grade || "onbekend"}, leeftijd ${lesson.ageRange || "onbekend"}.
Thema: ${lesson.topic || "niet ingevuld"}.
Leergebied: ${lesson.learningArea || "niet ingevuld"}.

Lesfasen:
${phaseLines}

${corpusLabel} als kandidaat-doelen (kies ALLEEN hieruit, verzin geen codes of doelteksten):
${JSON.stringify(goals, null, 2)}

Selecteer 2 of 3 doelen die de activiteit het best dekken. Gebruik exact de code uit de lijst.
Per doel: why (waarom dekt dit de activiteit, maximaal twee zinnen) en lessonPhase (Instap, Instructie, Verwerking of Afronding).`;
}
