import type { CurriculumSearchResult, LinkedMinimumGoal } from "@/types";

const NETWORK_BADGE_LABELS: Record<string, string> = {
  OPSTAP: "Op.stap",
  OVSG: "OVSG",
  GO_NIEUW: "GO! Nieuw",
  ZILL: "ZILL",
  GO: "GO! Legacy",
  KOV: "Katholiek Onderwijs",
  POV: "Provinciaal Onderwijs",
};

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

export function formatGoalTitleParts(result: Pick<CurriculumSearchResult, "code" | "titel">) {
  return splitGoalCodeAndTitle(result.code, result.titel);
}

export function networkBadgeLabel(network: string): string {
  return NETWORK_BADGE_LABELS[network] ?? network;
}

export function formatGoalCopyText(result: CurriculumSearchResult): string {
  const { code, titel } = formatGoalTitleParts(result);
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
