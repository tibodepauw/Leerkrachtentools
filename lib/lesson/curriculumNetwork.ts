import type {
  CurriculumNetworkFilter,
  EducationLevelPreference,
  EducationNetwork,
} from "@/types";

export function mapEducationNetworkToCurriculumFilter(
  network: EducationNetwork,
  educationLevel: EducationLevelPreference,
): CurriculumNetworkFilter {
  if (network !== "GO") {
    return network;
  }
  return educationLevel === "secundair_onderwijs" ? "GO" : "GO_NIEUW";
}

export function remapCurriculumNetworkForLevel(
  network: CurriculumNetworkFilter,
  educationLevel: EducationLevelPreference,
): CurriculumNetworkFilter {
  if (educationLevel === "secundair_onderwijs" && network === "GO_NIEUW") {
    return "GO";
  }
  if (
    (educationLevel === "basisonderwijs" ||
      educationLevel === "alle_niveaus") &&
    network === "GO"
  ) {
    return educationLevel === "basisonderwijs" ? "GO_NIEUW" : network;
  }
  return network;
}
