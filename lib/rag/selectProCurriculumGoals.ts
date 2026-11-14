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

/** Code en tekst zoals de kandidaat voor dit soort doel getoond wordt. */
function candidateFields(
  item: CurriculumSearchResult,
  kind: ProCurriculumKind,
): { code: string; titel: string } {
  if (kind === "minimumdoel") {
    return {
      code: item.gelinktMinimumdoel?.code?.trim() || item.code,
      titel: item.gelinktMinimumdoel?.tekst?.trim() || item.titel,
    };
  }
  return { code: item.code, titel: item.titel };
}

function candidateCodes(item: CurriculumSearchResult): string[] {
  return [item.code, item.gelinktMinimumdoel?.code ?? ""]
    .map(normalizeCurriculumCode)
    .filter(Boolean);
}

/** Wat de leerkracht als hetzelfde doel ziet: twee kaarten hiermee zijn dubbel. */
function outputIdentity(
  item: CurriculumSearchResult,
  kind: ProCurriculumKind,
  position: number,
): string {
  const { code, titel } = candidateFields(item, kind);
  const normalizedCode = normalizeCurriculumCode(code);
  const normalizedTitel = titel.trim().toLocaleLowerCase("nl-BE");
  if (!normalizedCode && !normalizedTitel) {
    return `#${position}`;
  }
  // Een minimumdoel is netwerkoverstijgend; een leerplandoel met dezelfde code
  // in een ander netwerk is een ander doel.
  return kind === "minimumdoel"
    ? normalizedCode || normalizedTitel
    : [normalizedCode, normalizedTitel, item.netwerk].join("|");
}

/**
 * Koppelt AI-keuzes aan officiële kandidaten. Het kandidaatnummer bepaalt de
 * kandidaat, want codes zijn niet uniek over netwerken. Een meegegeven code
 * moet bij dat nummer horen; anders wordt de keuze genegeerd.
 */
export function groundProPicks(
  retrieved: CurriculumSearchResult[],
  picks: Array<{ nr?: number; code?: string; why?: string; lessonPhase?: string }>,
  kind: ProCurriculumKind = "leerplandoel",
): GroundedProGoal[] {
  const seen = new Set<string>();
  const grounded: GroundedProGoal[] = [];

  for (const pick of picks) {
    if (grounded.length >= CURRICULUM_PRO_PICK_MAX) {
      break;
    }
    const pickedCode = normalizeCurriculumCode(String(pick.code ?? ""));
    let official: CurriculumSearchResult | undefined;
    if (pick.nr !== undefined) {
      if (
        typeof pick.nr !== "number" ||
        !Number.isInteger(pick.nr) ||
        pick.nr < 1 ||
        pick.nr > retrieved.length
      ) {
        continue;
      }
      official = retrieved[pick.nr - 1];
      if (pickedCode && official && !candidateCodes(official).includes(pickedCode)) {
        continue;
      }
    } else {
      // Antwoorden zonder nr blijven alleen bruikbaar als de code precies één
      // kandidaat aanwijst.
      if (!pickedCode) continue;
      const matches = retrieved.filter((item) =>
        candidateCodes(item).includes(pickedCode),
      );
      if (matches.length === 1) official = matches[0];
    }
    if (!official) continue;
    const identity = outputIdentity(official, kind, retrieved.indexOf(official));
    if (seen.has(identity)) continue;
    const why = sanitizeSnippet(String(pick.why ?? ""), 400);
    if (!why) {
      continue;
    }
    const phaseRaw = String(pick.lessonPhase ?? "").trim();
    const lessonPhase = isProLessonPhase(phaseRaw) ? phaseRaw : "Verwerking";
    seen.add(identity);
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
    code: candidateFields(item, kind).code,
    netwerk: item.netwerk,
    discipline: item.discipline,
    subdomein: item.subdomein,
    titel: candidateFields(item, kind).titel,
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

Selecteer 2 of 3 doelen die de activiteit het best dekken. Geef per keuze het exacte nr uit de lijst en de bijbehorende code. Het nr bepaalt de kandidaat, ook als codes in verschillende netwerken gelijk zijn.
Per doel: why (waarom dekt dit de activiteit, maximaal twee zinnen) en lessonPhase (Instap, Instructie, Verwerking of Afronding).`;
}
