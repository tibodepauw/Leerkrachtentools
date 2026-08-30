import type {
  CurriculumNetworkFilter,
  EducationLevelFilter,
  EducationLevelPreference,
} from "@/types";

export function isAhovoksDomainLevel(level: EducationLevelFilter): boolean {
  return (
    level === "BUBAO" ||
    level === "BUSO" ||
    level === "OKAN" ||
    level === "DKO" ||
    level === "VOLWASSENEN" ||
    level === "HOGER"
  );
}

export function resolveCurriculumNetwork(
  network: CurriculumNetworkFilter,
  educationLevel: EducationLevelFilter,
): CurriculumNetworkFilter {
  if (isAhovoksDomainLevel(educationLevel)) {
    return "ALL";
  }
  return network;
}

export function preferenceToFilter(
  preference: EducationLevelPreference,
): EducationLevelFilter {
  switch (preference) {
    case "alle_niveaus":
      return "ALL";
    case "basisonderwijs":
      return "BASISONDERWIJS";
    case "secundair_onderwijs":
      return "SECUNDAIR";
    case "bubao":
      return "BUBAO";
    case "buso":
      return "BUSO";
    case "okan":
      return "OKAN";
    case "dko":
      return "DKO";
    case "volwassenenonderwijs":
      return "VOLWASSENEN";
    case "hoger_onderwijs":
      return "HOGER";
    default:
      return "BASISONDERWIJS";
  }
}

export function filterToPreference(
  filter: EducationLevelFilter,
): EducationLevelPreference {
  switch (filter) {
    case "ALL":
      return "alle_niveaus";
    case "BASISONDERWIJS":
    case "KLEUTER":
    case "LAGER":
      return "basisonderwijs";
    case "SECUNDAIR":
      return "secundair_onderwijs";
    case "BUBAO":
      return "bubao";
    case "BUSO":
      return "buso";
    case "OKAN":
      return "okan";
    case "DKO":
      return "dko";
    case "VOLWASSENEN":
      return "volwassenenonderwijs";
    case "HOGER":
      return "hoger_onderwijs";
    default:
      return "basisonderwijs";
  }
}

export const EDUCATION_LEVEL_OPTIONS: Array<{
  value: EducationLevelPreference;
  label: string;
}> = [
  { value: "basisonderwijs", label: "Basisonderwijs (kleuter + lager)" },
  { value: "secundair_onderwijs", label: "Secundair onderwijs" },
  { value: "bubao", label: "Buitengewoon basisonderwijs (BuBaO)" },
  { value: "buso", label: "Buitengewoon secundair (BuSO OV1/OV2/OV3)" },
  { value: "okan", label: "Onthaalonderwijs (OKAN)" },
  { value: "dko", label: "Deeltijds kunstonderwijs (DKO)" },
  { value: "volwassenenonderwijs", label: "Volwassenenonderwijs" },
  { value: "hoger_onderwijs", label: "Hoger onderwijs (lerarenopleiding)" },
  { value: "alle_niveaus", label: "Alle onderwijsniveaus" },
];
