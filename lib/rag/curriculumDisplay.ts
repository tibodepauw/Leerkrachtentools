import type { CurriculumSearchResult, LinkedMinimumGoal } from "@/types";

const NETWORK_BADGE_LABELS: Record<string, string> = {
  OPSTAP: "Op.stap",
  OVSG: "OVSG",
  GO_NIEUW: "GO! Nieuw",
  ZILL: "ZILL",
  GO: "GO! Legacy",
};

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function networkBadgeLabel(network: string): string {
  return NETWORK_BADGE_LABELS[network] ?? network;
}

export function formatGoalCopyText(result: CurriculumSearchResult): string {
  const titel = decodeHtmlEntities(result.titel);
  return result.code ? `[${result.code}] ${titel}` : titel;
}

export function formatMinimumGoalCopyText(goal: LinkedMinimumGoal): string {
  const tekst = decodeHtmlEntities(goal.tekst);
  return goal.code ? `[${goal.code}] ${tekst}` : tekst;
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
