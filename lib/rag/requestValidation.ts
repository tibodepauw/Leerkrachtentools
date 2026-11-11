const GRADES = new Set([
  "",
  "peuters",
  "k1",
  "k2",
  "k3",
  "l1",
  "l2",
  "l3",
  "l4",
  "l5",
  "l6",
  "s1",
  "s2",
  "s3",
  "s7",
  "custom",
]);
const SECONDARY_GRADES = new Set([
  "all",
  "1ste_graad",
  "2de_graad",
  "3de_graad",
  "7de_specialisatie",
]);
const SECONDARY_FINALITIES = new Set([
  "all",
  "doorstroom",
  "dubbel",
  "arbeidsmarkt",
]);

export function isValidRagTargetContext(value: {
  grade?: unknown;
  ageRange?: unknown;
  secondaryGrade?: unknown;
  secondaryFinality?: unknown;
  domainDetail?: unknown;
  domainFinality?: unknown;
}) {
  if (value.grade !== undefined && (typeof value.grade !== "string" || !GRADES.has(value.grade))) {
    return false;
  }
  if (
    value.secondaryGrade !== undefined &&
    (typeof value.secondaryGrade !== "string" || !SECONDARY_GRADES.has(value.secondaryGrade))
  ) {
    return false;
  }
  if (
    value.secondaryFinality !== undefined &&
    (typeof value.secondaryFinality !== "string" || !SECONDARY_FINALITIES.has(value.secondaryFinality))
  ) {
    return false;
  }

  return [
    value.ageRange,
    value.domainDetail,
    value.domainFinality,
  ].every(
    (field) =>
      field === undefined ||
      (typeof field === "string" &&
        field.length <= 100 &&
        !/[\p{C}<>]/u.test(field)),
  );
}

const EDUCATION_LEVELS = new Set([
  "ALL",
  "KLEUTER",
  "LAGER",
  "BASISONDERWIJS",
  "SECUNDAIR",
  "BUBAO",
  "BUSO",
  "OKAN",
  "DKO",
  "VOLWASSENEN",
  "HOGER",
]);
// Inclusief de schrijfwijzen zonder scheidingsteken die de curriculumroute aanvaardt.
const NETWORKS = new Set([
  "ALL",
  "OPSTAP",
  "OVSG",
  "GO_NIEUW",
  "GO_OUD",
  "GONIEUW",
  "GOOUD",
  "ZILL",
  "GO",
  "KOV",
  "POV",
]);
const SEARCH_MODES = new Set(["snel", "pro"]);

export const RAG_BODY_LIMITS = {
  goal: 10000,
  filter: 100,
  lessonText: 2000,
  phases: 20,
  phaseName: 100,
  phaseText: 10000,
} as const;

/** Maximale lengte per tekstveld. Velden die hier ontbreken zijn geen tekst. */
const TEXT_FIELD_LIMITS: Record<string, number> = {
  goal: RAG_BODY_LIMITS.goal,
  query: RAG_BODY_LIMITS.goal,
  network: RAG_BODY_LIMITS.filter,
  curriculum: RAG_BODY_LIMITS.filter,
  educationLevel: RAG_BODY_LIMITS.filter,
  level: RAG_BODY_LIMITS.filter,
  grade: RAG_BODY_LIMITS.filter,
  ageRange: RAG_BODY_LIMITS.filter,
  secondaryGrade: RAG_BODY_LIMITS.filter,
  secondaryFinality: RAG_BODY_LIMITS.filter,
  domainDetail: RAG_BODY_LIMITS.filter,
  domainFinality: RAG_BODY_LIMITS.filter,
  searchMode: RAG_BODY_LIMITS.filter,
  topic: RAG_BODY_LIMITS.lessonText,
  learningArea: RAG_BODY_LIMITS.lessonText,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeEnum(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

/** Een lege waarde betekent "geen keuze": de route valt dan terug op haar standaard. */
function isUnknownEnumValue(value: unknown, allowed: Set<string>): boolean {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }
  return !allowed.has(normalizeEnum(value));
}

function isValidPhase(phase: unknown): boolean {
  return (
    isPlainObject(phase) &&
    typeof phase.name === "string" &&
    phase.name.length <= RAG_BODY_LIMITS.phaseName &&
    typeof phase.text === "string" &&
    phase.text.length <= RAG_BODY_LIMITS.phaseText
  );
}

/**
 * Gedeelde bodyvalidatie voor `/api/rag-curriculum` en `/api/rag-minimum-goals`.
 * Controleert types, lengtes en enumwaarden van elk veld dat de routes lezen,
 * vóór een route er een stringbewerking op uitvoert. Ontbrekende velden zijn
 * toegestaan; `null`, arrays en objecten op de plaats van tekst niet. `limit`
 * houdt zijn eigen foutmelding via `parsePublicGoalLimit`. Onbekende velden
 * worden genegeerd omdat de routes ze niet lezen.
 */
export function isValidRagBody(body: unknown): body is Record<string, unknown> {
  if (!isPlainObject(body)) {
    return false;
  }

  for (const [field, maxLength] of Object.entries(TEXT_FIELD_LIMITS)) {
    const value = body[field];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== "string" || value.length > maxLength) {
      return false;
    }
  }

  if (
    body.enableLlmQueryRewriting !== undefined &&
    typeof body.enableLlmQueryRewriting !== "boolean"
  ) {
    return false;
  }

  if (body.phases !== undefined) {
    if (
      !Array.isArray(body.phases) ||
      body.phases.length > RAG_BODY_LIMITS.phases ||
      !body.phases.every(isValidPhase)
    ) {
      return false;
    }
  }

  for (const field of ["educationLevel", "level"]) {
    const value = body[field];
    if (isUnknownEnumValue(value, EDUCATION_LEVELS)) {
      return false;
    }
  }
  for (const field of ["network", "curriculum"]) {
    const value = body[field];
    if (isUnknownEnumValue(value, NETWORKS)) {
      return false;
    }
  }
  if (typeof body.searchMode === "string" && !SEARCH_MODES.has(body.searchMode)) {
    return false;
  }

  return isValidRagTargetContext(body);
}
