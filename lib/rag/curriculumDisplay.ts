import type { CurriculumSearchResult, LinkedMinimumGoal } from "@/types";

const NETWORK_BADGE_LABELS: Record<string, string> = {
  OPSTAP: "Op.stap",
  OVSG: "OVSG",
  GO_NIEUW: "GO! Nieuw",
  ZILL: "ZILL",
  GO: "GO! Legacy",
  KOV: "Katholiek Onderwijs",
  POV: "Provinciaal Onderwijs",
  AHOVOKS: "AHOVOKS",
};

const AHOVOKS_TITLE_SPLIT_PATTERN = /\s+(Verwerkingsniveau\b[\s\S]*)$/u;

const BOILERPLATE_TOELICHTING_PATTERNS = [
  /^na te streven minimumdoelen op populatieniveau$/iu,
  /^te bereiken minimumdoelen op populatieniveau$/iu,
  /^te bereiken minimumdoelen op individueel niveau$/iu,
  /^ontwikkelingsdoelen$/iu,
  /^eindtermen$/iu,
  /^basiscompetenties$/iu,
  /^specifieke eindtermen$/iu,
  /^ov\s*[123]$/iu,
  /^type\s*\d+$/iu,
  /^\d+(?:de|e|ste|nd|rd|th)?\s+graad$/iu,
] as const;

function normalizeToelichtingSegment(value: string): string {
  return sanitizeCurriculumText(value).trim().replace(/\s+/g, " ");
}

function splitToelichtingSegments(value: string): string[] {
  return value
    .split(/\n{2,}|\n|[·•;|]/u)
    .map(normalizeToelichtingSegment)
    .filter(Boolean);
}

function isBoilerplateSegment(segment: string): boolean {
  const normalized = normalizeToelichtingSegment(segment);
  if (!normalized) {
    return true;
  }
  return BOILERPLATE_TOELICHTING_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

export function isBoilerplateToelichting(text: string): boolean {
  const clean = sanitizeCurriculumText(text).trim();
  if (!clean) {
    return true;
  }

  const segments = splitToelichtingSegments(clean);
  if (segments.length === 0) {
    return true;
  }

  return segments.every(isBoilerplateSegment);
}

export function resolveDisplayToelichting(
  result: Pick<CurriculumSearchResult, "toelichting" | "gelinktMinimumdoel">,
): string {
  const parts = [result.toelichting, result.gelinktMinimumdoel?.type]
    .map((value) => sanitizeCurriculumText(value ?? "").trim())
    .filter(Boolean);

  const merged = parts.join("\n\n");
  return isBoilerplateToelichting(merged) ? "" : merged;
}

export function shouldShowToelichting(text: string): boolean {
  return Boolean(sanitizeCurriculumText(text).trim()) && !isBoilerplateToelichting(text);
}

const GOAL_CODE_PATTERNS = [
  /\d\.\d+\.[A-Z]{2}\d+(?:\.\d+)?/u,
  /[A-Z]{3}[a-z]{3}\d+[BOV]\.\d+/u,
  /[A-Z]{2,4}\.\d{2,4}/u,
  /[A-Z]{2,4}[a-z]{2,3}\d+/u,
  /[A-Z][A-Za-z]{2,4}\d+/u,
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mojibakeScore(value: string): number {
  return (
    value.match(/(?:Ã.|â[\u0080-\u00BF\u20AC]|Â.|ï¿½)/gu)?.length ?? 0
  );
}

export function repairUtf8Mojibake(value: string): string {
  if (!value || !/[\u0080-\u00FF]/.test(value)) {
    return value;
  }

  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
    const repaired = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (!repaired || repaired.includes("\uFFFD")) {
      return value;
    }

    return mojibakeScore(repaired) < mojibakeScore(value) ? repaired : value;
  } catch {
    return value;
  }
}

export function decodeHtmlEntities(value: string): string {
  return repairUtf8Mojibake(
    value
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " "),
  );
}

export function sanitizeCurriculumText(value: string): string {
  return decodeHtmlEntities(value);
}

export function splitGoalCodeAndTitle(
  code: string,
  titel: string,
): { code: string; titel: string } {
  const cleanCode = sanitizeCurriculumText(code).trim();
  let cleanTitel = sanitizeCurriculumText(titel).trim();

  if (cleanCode) {
    const duplicatePrefix = new RegExp(`^${escapeRegExp(cleanCode)}\\s*`, "u");
    cleanTitel = cleanTitel.replace(duplicatePrefix, "").trim();
    return {
      code: cleanCode,
      titel: cleanTitel || sanitizeCurriculumText(titel).trim(),
    };
  }

  for (const pattern of GOAL_CODE_PATTERNS) {
    const spacedMatch = cleanTitel.match(
      new RegExp(`^(${pattern.source})\\s+(.+)$`, "u"),
    );
    if (spacedMatch) {
      return { code: spacedMatch[1], titel: spacedMatch[2].trim() };
    }

    const gluedMatch = cleanTitel.match(
      new RegExp(`^(${pattern.source})([A-ZÀ-ÖØ-Þ"'(].+)$`, "u"),
    );
    if (gluedMatch) {
      return { code: gluedMatch[1], titel: gluedMatch[2].trim() };
    }
  }

  return { code: "", titel: cleanTitel };
}

export function shouldSplitAhovoksGoalText(
  result: Pick<CurriculumSearchResult, "netwerk" | "titel">,
): boolean {
  if (result.netwerk === "AHOVOKS") {
    return true;
  }
  return AHOVOKS_TITLE_SPLIT_PATTERN.test(sanitizeCurriculumText(result.titel));
}

export function splitAhovoksGoalText(
  titel: string,
  toelichting = "",
): { titel: string; toelichting: string } {
  const cleanTitel = sanitizeCurriculumText(titel).trim();
  const cleanToelichting = sanitizeCurriculumText(toelichting).trim();
  const match = cleanTitel.match(AHOVOKS_TITLE_SPLIT_PATTERN);

  if (!match || match.index === undefined) {
    return { titel: cleanTitel, toelichting: cleanToelichting };
  }

  const mainTitle = cleanTitel.slice(0, match.index).trim();
  const details = match[1].trim();
  const mergedToelichting = [cleanToelichting, details].filter(Boolean).join("\n\n");

  return {
    titel: mainTitle || cleanTitel,
    toelichting: mergedToelichting,
  };
}

export function presentCurriculumGoal(
  result: CurriculumSearchResult,
): CurriculumSearchResult {
  if (!shouldSplitAhovoksGoalText(result)) {
    return result;
  }

  const { titel, toelichting } = splitAhovoksGoalText(result.titel, result.toelichting);
  return { ...result, titel, toelichting };
}

export function formatGoalTitleParts(
  result: Pick<CurriculumSearchResult, "code" | "titel" | "netwerk" | "toelichting">,
) {
  const presented = presentCurriculumGoal({
    code: result.code,
    titel: result.titel,
    toelichting: result.toelichting ?? "",
    discipline: "",
    subdomein: "",
    leerjaarRoute: "",
    gelinktMinimumdoel: null,
    netwerk: result.netwerk ?? "",
    bronUrl: "",
  });
  return splitGoalCodeAndTitle(presented.code, presented.titel);
}

export function networkBadgeLabel(network: string): string {
  return NETWORK_BADGE_LABELS[network] ?? network;
}

export function formatGoalCopyText(result: CurriculumSearchResult): string {
  const presented = presentCurriculumGoal(result);
  const { code, titel } = splitGoalCodeAndTitle(presented.code, presented.titel);
  return code ? `[${code}] ${titel}` : titel;
}

export function formatMinimumGoalCopyText(goal: LinkedMinimumGoal): string {
  const tekst = sanitizeCurriculumText(goal.tekst);
  const code = sanitizeCurriculumText(goal.code).trim();
  return code ? `[${code}] ${tekst}` : tekst;
}

export function formatSearchResultMetadata(result: CurriculumSearchResult) {
  const parts = [
    result.discipline,
    result.subdomein,
    result.leerjaarRoute,
    result.netwerk !== "ALL" ? result.netwerk : "",
  ].filter(Boolean);

  return parts.join(" · ");
}
