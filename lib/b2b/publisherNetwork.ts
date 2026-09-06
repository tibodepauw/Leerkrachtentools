import type { CurriculumNetworkFilter, EducationLevelFilter } from "@/types";

export type PublisherNetwork = "KOV" | "GO" | "OVSG" | "AHOVOKS";
export type PublisherLevel = "basis" | "secundair";

export type MatchSearchTarget = {
  kind: "minimum-goals" | "curriculum";
  network: CurriculumNetworkFilter;
  educationLevel: EducationLevelFilter;
  publisherNetwork: PublisherNetwork;
};

export function resolveMatchSearchTarget(
  network: PublisherNetwork,
  level: PublisherLevel,
): MatchSearchTarget {
  const educationLevel: EducationLevelFilter =
    level === "secundair" ? "SECUNDAIR" : "BASISONDERWIJS";

  if (network === "AHOVOKS") {
    return {
      kind: "minimum-goals",
      network: "ALL",
      educationLevel,
      publisherNetwork: network,
    };
  }

  if (network === "KOV") {
    return {
      kind: "curriculum",
      network: level === "secundair" ? "KOV" : "ZILL",
      educationLevel,
      publisherNetwork: network,
    };
  }

  if (network === "GO") {
    return {
      kind: "curriculum",
      network: level === "secundair" ? "GO" : "GO_NIEUW",
      educationLevel,
      publisherNetwork: network,
    };
  }

  return {
    kind: "curriculum",
    network: "OVSG",
    educationLevel,
    publisherNetwork: network,
  };
}
