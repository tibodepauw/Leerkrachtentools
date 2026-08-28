import type { GoalTaxonomy } from "@/types";

const TAXONOMY_DEFINITIONS: Record<
  GoalTaxonomy,
  { title: string; description: string }
> = {
  MC: {
    title: "Mentaal-cognitief (MC)",
    description:
      "Kennis oproepen, benoemen, verklaren, vergelijken, ordenen of redeneren.",
  },
  DAS: {
    title: "Dynamisch-affectief-sociaal (DAS)",
    description:
      "Houding, motivatie, samenwerking, waarden, zelfbeeld of sociaal gedrag.",
  },
  SPM: {
    title: "Sensomotorisch/psychomotorisch (SPM)",
    description:
      "Beweging, manipulatie, bouwen, tekenen, knippen, plakken of andere motorische handelingen.",
  },
};

const SPM_INDICATORS =
  /\b(tekenen|teken|tekening|knippen|plakken|bouwen|bewegen|dansen|springen|gooien|vangen|maken|vouwen|rollen|motor|lichaam|materialen hanteren|fijne motoriek)\b/iu;

const DAS_INDICATORS =
  /\b(voelen|waarderen|houding|motivatie|samenwerken|respect|durven|interesse|enthousiasme|coopereren|groepswerk|zelfvertrouwen|gedrag|emotie|gevoel|hulpvaardig|vriendelijk)\b/iu;

const MC_INDICATORS =
  /\b(benoemen|herkennen|uitleggen|vergelijken|ordenen|beschrijven|analyseren|redeneren|situeren|classificeren|formuleren|opnoemen|teruggeven|verklaren|berekenen|lezen|schrijven|begrijpen)\b/iu;

function matchedIndicators(text: string, pattern: RegExp) {
  return [...text.matchAll(new RegExp(pattern.source, "giu"))].map(
    (match) => match[0].toLocaleLowerCase("nl-BE"),
  );
}

export function classifyGoalTaxonomy(original: string) {
  const trimmed = original.trim();
  const lower = trimmed.toLocaleLowerCase("nl-BE");

  const spmHits = matchedIndicators(lower, SPM_INDICATORS);
  const dasHits = matchedIndicators(lower, DAS_INDICATORS);
  const mcHits = matchedIndicators(lower, MC_INDICATORS);

  let taxonomy: GoalTaxonomy = "MC";
  let indicators = mcHits;

  if (spmHits.length > 0 && spmHits.length >= dasHits.length) {
    taxonomy = "SPM";
    indicators = spmHits;
  } else if (dasHits.length > 0 && dasHits.length > mcHits.length) {
    taxonomy = "DAS";
    indicators = dasHits;
  } else if (mcHits.length > 0) {
    taxonomy = "MC";
    indicators = mcHits;
  }

  const definition = TAXONOMY_DEFINITIONS[taxonomy];

  return {
    original: trimmed,
    taxonomy,
    rationale: `Dit doel classificeer ik als ${definition.title} omdat de kernactiviteit ${indicators.length ? `"${indicators[0]}"` : "observeerbaar gedrag"} bevat.`,
    indicators: [...new Set(indicators)].slice(0, 5),
    definition: definition.description,
  };
}
