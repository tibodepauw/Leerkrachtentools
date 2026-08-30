import type { EducationLevelFilter, EducationLevelPreference } from "@/types";

export function preferenceToFilter(
  preference: EducationLevelPreference,
): EducationLevelFilter {
  switch (preference) {
    case "kleuteronderwijs":
      return "KLEUTER";
    case "lager_onderwijs":
      return "LAGER";
    case "secundair_onderwijs":
      return "SECUNDAIR";
    default:
      return "LAGER";
  }
}

export function filterToPreference(
  filter: EducationLevelFilter,
): EducationLevelPreference {
  switch (filter) {
    case "KLEUTER":
      return "kleuteronderwijs";
    case "LAGER":
      return "lager_onderwijs";
    case "SECUNDAIR":
      return "secundair_onderwijs";
    default:
      return "lager_onderwijs";
  }
}
