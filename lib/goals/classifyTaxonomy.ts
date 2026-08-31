import type { GoalTaxonomy } from "@/types";
import {
  DAS_INDICATOR_PATTERN,
  SPM_INDICATOR_PATTERN,
} from "@/lib/goals/ko1Rules";

const TAXONOMY_DEFINITIONS: Record<
  GoalTaxonomy,
  { title: string; description: string }
> = {
  MC: {
    title: "Mentaal-cognitief (MC)",
    description:
      "Kennis (reproductie en inzicht) en vaardigheden (productie: toepassen, analyseren, evalueren, creëren).",
  },
  DAS: {
    title: "Dynamisch-affectief (DAS)",
    description:
      "Wilsaspect (attitudes, motieven), gevoelsaspect (emoties, welbevinden) en sociale vaardigheden.",
  },
  SPM: {
    title: "Sensomotorisch/psychomotorisch (SPM)",
    description:
      "Grove en fijne motoriek, doelgerichte psychomotoriek en sensomotorisch waarnemen.",
  },
};

const PRODUCTIVE_VERBS =
  /\b(toepassen|analyseren|evalueren|cre[eë]ren|ontwerpen|redeneren|vergelijken|uitleggen|formuleren|oplossen)\b/iu;

const REPRODUCTIVE_VERBS =
  /\b(benoemen|herkennen|opsommen|aanduiden|teruggeven|reproduceren|memoriseren|situeren)\b/iu;

const ROUTINE_DAS =
  /\b(plicht|volgens de regels|in de rij|stil zijn|mee doen|zonder protest)\b/iu;

const PRODUCTIVE_DAS =
  /\b(durven|willen|bereid|plezier|interesse|respect|waarden|verinnerlijkt|eigen keuze)\b/iu;

function matchedIndicators(text: string, pattern: RegExp) {
  return [...text.matchAll(new RegExp(pattern.source, "giu"))].map((match) =>
    match[0].toLocaleLowerCase("nl-BE"),
  );
}

function classifyMcSubcategory(lower: string) {
  if (PRODUCTIVE_VERBS.test(lower)) {
    return {
      subcategory: "Vaardigheden (productie)",
      behaviorLevel: "Productie: toepassen, analyseren, evalueren of creëren",
    };
  }
  if (/\b(uitleggen|verklaren|vergelijken|ordenen|classificeren)\b/iu.test(lower)) {
    return {
      subcategory: "Kennis (reproductie: inzicht)",
      behaviorLevel: "Reproductie op inzichtsniveau",
    };
  }
  return {
    subcategory: "Kennis (reproductie)",
    behaviorLevel: "Reproductie op geheugenniveau",
  };
}

function classifyDasSubcategory(lower: string) {
  if (/\b(samenwerken|co[öo]pereren|groepswerk|helpen|conflict|communiceren)\b/iu.test(
    lower,
  )) {
    return {
      subcategory: "Sociale vaardigheden",
      behaviorLevel: PRODUCTIVE_DAS.test(lower)
        ? "Productief (verinnerlijkt waardenkader)"
        : "Routinematig (extern aangestuurd)",
    };
  }
  if (/\b(plezier|emotie|gevoel|welbevinden|angst|trots|boos)\b/iu.test(lower)) {
    return {
      subcategory: "Gevoelsaspect",
      behaviorLevel: PRODUCTIVE_DAS.test(lower)
        ? "Productief (verinnerlijkt waardenkader)"
        : "Routinematig (extern aangestuurd)",
    };
  }
  return {
    subcategory: "Wilsaspect (attitudes, motieven)",
    behaviorLevel: PRODUCTIVE_DAS.test(lower)
      ? "Productief (verinnerlijkt waardenkader)"
      : ROUTINE_DAS.test(lower)
        ? "Routinematig (extern aangestuurd)"
        : "Routinematig of productief (context bepaalt diepte)",
  };
}

function classifySpmSubcategory(lower: string) {
  if (/\b(waarnemen|zintuig|voelen|horen|zien|ruiken|proeven|tasten)\b/iu.test(lower)) {
    return {
      subcategory: "Sensomotoriek",
      behaviorLevel: "Zintuiglijk waarnemen",
    };
  }
  if (/\b(penvast|grijpen|knippen|schrijven|tekenen|fijne)\b/iu.test(lower)) {
    return {
      subcategory: "Fijne motoriek / doelgerichte psychomotoriek",
      behaviorLevel: "Doelgerichte psychomotoriek (bv. pengreep, precisie)",
    };
  }
  return {
    subcategory: "Grove motoriek",
    behaviorLevel: "Grove motoriek of balvaardigheid",
  };
}

export function classifyGoalTaxonomy(original: string) {
  const trimmed = original.trim();
  const lower = trimmed.toLocaleLowerCase("nl-BE");

  const spmHits = matchedIndicators(lower, SPM_INDICATOR_PATTERN);
  const dasHits = matchedIndicators(lower, DAS_INDICATOR_PATTERN);
  const mcHits = matchedIndicators(lower, REPRODUCTIVE_VERBS);

  let taxonomy: GoalTaxonomy = "MC";
  let indicators = mcHits;

  if (spmHits.length > 0 && spmHits.length >= dasHits.length) {
    taxonomy = "SPM";
    indicators = spmHits;
  } else if (dasHits.length > 0 && dasHits.length >= mcHits.length) {
    taxonomy = "DAS";
    indicators = dasHits;
  } else if (mcHits.length > 0 || PRODUCTIVE_VERBS.test(lower)) {
    taxonomy = "MC";
    indicators = mcHits.length
      ? mcHits
      : matchedIndicators(lower, PRODUCTIVE_VERBS);
  }

  const definition = TAXONOMY_DEFINITIONS[taxonomy];
  const detail =
    taxonomy === "MC"
      ? classifyMcSubcategory(lower)
      : taxonomy === "DAS"
        ? classifyDasSubcategory(lower)
        : classifySpmSubcategory(lower);

  const leadIndicator = indicators[0] ?? "observeerbaar gedrag";

  return {
    original: trimmed,
    taxonomy,
    subcategory: detail.subcategory,
    behaviorLevel: detail.behaviorLevel,
    rationale: `Classificatie ${definition.title}: ${detail.subcategory}. Gedragsniveau: ${detail.behaviorLevel}. Kernindicator: "${leadIndicator}".`,
    indicators: [...new Set(indicators)].slice(0, 5),
    definition: definition.description,
  };
}
