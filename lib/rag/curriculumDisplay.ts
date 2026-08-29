import type { CurriculumSearchResult } from "@/types";

export function formatSearchResultMetadata(result: CurriculumSearchResult) {
  const parts = [
    result.discipline,
    result.subdomein,
    result.leerjaarRoute,
    result.netwerk !== "ALL" ? result.netwerk : "",
  ].filter(Boolean);

  return parts.join(" · ");
}
