import type {
  CurriculumSearchResult,
  DomainDetailFilter,
  EducationLevelFilter,
} from "@/types";

export const DOMAIN_FILTER_BONUS = 0.28;
export const DOMAIN_FILTER_BOTH_BONUS = 0.12;

export function domainFilterOptions(
  level: EducationLevelFilter,
): Array<{ value: DomainDetailFilter; label: string }> {
  switch (level) {
    case "SECUNDAIR":
      return [
        { value: "all", label: "Alle graden" },
        { value: "1ste_graad", label: "1ste graad" },
        { value: "2de_graad", label: "2de graad" },
        { value: "3de_graad", label: "3de graad" },
        { value: "7de_specialisatie", label: "7de specialisatiejaar" },
      ];
    case "BUBAO":
      return [
        { value: "all", label: "Alle types" },
        { value: "basisaanbod", label: "Basisaanbod" },
        { value: "type_1", label: "Type 1" },
        { value: "type_2", label: "Type 2" },
        { value: "type_3", label: "Type 3" },
        { value: "type_4", label: "Type 4" },
        { value: "type_6", label: "Type 6" },
        { value: "type_7", label: "Type 7" },
        { value: "type_9", label: "Type 9" },
      ];
    case "BUSO":
      return [
        { value: "all", label: "Alle opleidingsvormen" },
        { value: "ov1", label: "OV1" },
        { value: "ov2", label: "OV2" },
        { value: "ov3", label: "OV3" },
      ];
    case "OKAN":
      return [
        { value: "all", label: "Alle doelen" },
        { value: "nt2", label: "NT2" },
        { value: "integratie", label: "Integratie" },
      ];
    case "DKO":
      return [
        { value: "all", label: "Alle graden" },
        { value: "1ste_graad", label: "1ste graad" },
        { value: "2de_graad", label: "2de graad" },
        { value: "3de_graad", label: "3de graad" },
        { value: "4de_graad", label: "4de graad" },
      ];
    case "VOLWASSENEN":
      return [
        { value: "all", label: "Alle trajecten" },
        { value: "basiseducatie", label: "Basiseducatie" },
        { value: "secundair_volwassenen", label: "Secundair volwassenen (CVO)" },
      ];
    case "HOGER":
      return [
        { value: "all", label: "Alle competenties" },
        { value: "basiscompetentie", label: "Basiscompetentie" },
        { value: "dlr", label: "DLR" },
      ];
    default:
      return [];
  }
}

export function domainSecondaryFinalityOptions(
  level: EducationLevelFilter,
): Array<{ value: DomainDetailFilter; label: string }> {
  if (level !== "SECUNDAIR") {
    return [];
  }
  return [
    { value: "all", label: "Alle finaliteiten" },
    { value: "doorstroom", label: "Doorstroom (D)" },
    { value: "dubbel", label: "Dubbele finaliteit (D/A)" },
    { value: "arbeidsmarkt", label: "Arbeidsmarkt (A)" },
  ];
}

function normalizeHaystack(value: string): string {
  return value
    .toLocaleLowerCase("nl-BE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function domainResultHaystack(result: CurriculumSearchResult): string {
  return normalizeHaystack(
    [
      result.leerjaarRoute,
      result.titel,
      result.toelichting,
      result.discipline,
      result.subdomein,
      result.gelinktMinimumdoel?.tekst,
      result.gelinktMinimumdoel?.code,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

const FILTER_PATTERNS: Record<string, RegExp[]> = {
  "1ste_graad": [/\b(?:1ste|eerste)\s+graad\b/u],
  "2de_graad": [/\b(?:2de|tweede)\s+graad\b/u],
  "3de_graad": [/\b(?:3de|derde)\s+graad\b/u],
  "4de_graad": [/\b(?:4de|vierde)\s+graad\b/u],
  "7de_specialisatie": [/\b7de\b/u, /\bspecialisatie(?:jaar)?\b/u],
  basisaanbod: [/\bbasisaanbod\b/u],
  type_1: [/\btype\s*1\b/u],
  type_2: [/\btype\s*2\b/u],
  type_3: [/\btype\s*3\b/u],
  type_4: [/\btype\s*4\b/u],
  type_6: [/\btype\s*6\b/u],
  type_7: [/\btype\s*7\b/u],
  type_9: [/\btype\s*9\b/u],
  ov1: [/\bov\s*1\b/u, /\bopleidingsvorm\s*1\b/u],
  ov2: [/\bov\s*2\b/u, /\bopleidingsvorm\s*2\b/u],
  ov3: [/\bov\s*3\b/u, /\bopleidingsvorm\s*3\b/u],
  nt2: [/\bnt2\b/u, /\btweede taal\b/u],
  integratie: [/\bintegratie\b/u, /\bonthaal\b/u],
  basiseducatie: [/\bbasiseducatie\b/u],
  secundair_volwassenen: [
    /\bsecundair volwassenen\b/u,
    /\bcvo\b/u,
  ],
  basiscompetentie: [/\bbasiscompetentie\b/u],
  dlr: [/\bdlr\b/u, /\bdidactische leerresultaten\b/u],
  doorstroom: [/\bdoorstroom(?:finaliteit)?\b/u],
  dubbel: [/\bdubbele\s+finaliteit\b/u],
  arbeidsmarkt: [/\barbeidsmarkt(?:finaliteit)?\b/u],
};

export function matchesDomainDetailFilter(
  haystack: string,
  filter: DomainDetailFilter,
): boolean {
  if (filter === "all") {
    return false;
  }
  const patterns = FILTER_PATTERNS[filter];
  if (!patterns) {
    return haystack.includes(normalizeHaystack(filter));
  }
  return patterns.some((pattern) => pattern.test(haystack));
}

export function scoreDomainFilterBonus(
  level: EducationLevelFilter,
  filters: {
    domainDetail?: DomainDetailFilter;
    domainFinality?: DomainDetailFilter;
  },
  result: CurriculumSearchResult,
): number {
  const detailFilter = filters.domainDetail ?? "all";
  const finalityFilter = filters.domainFinality ?? "all";

  if (detailFilter === "all" && finalityFilter === "all") {
    return 0;
  }

  const haystack = domainResultHaystack(result);
  if (!haystack) {
    return 0;
  }

  const detailMatch =
    detailFilter !== "all" &&
    matchesDomainDetailFilter(haystack, detailFilter);
  const finalityMatch =
    finalityFilter !== "all" &&
    matchesDomainDetailFilter(haystack, finalityFilter);

  if (detailMatch && finalityMatch) {
    return DOMAIN_FILTER_BONUS + DOMAIN_FILTER_BOTH_BONUS;
  }
  if (detailMatch || finalityMatch) {
    return DOMAIN_FILTER_BONUS;
  }

  if (level !== "ALL" && detailFilter === "all" && finalityFilter === "all") {
    return 0;
  }

  return 0;
}

export function supportsDomainDetailFilter(
  level: EducationLevelFilter,
): boolean {
  return domainFilterOptions(level).length > 1;
}

export function supportsDomainFinalityFilter(
  level: EducationLevelFilter,
): boolean {
  return domainSecondaryFinalityOptions(level).length > 1;
}
