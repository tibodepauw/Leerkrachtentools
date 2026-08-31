/** Didactic rules for well-formulated lesson goals. */

export type GoalDomain = "MC" | "DAS" | "spreek" | "muzisch";

export const FORBIDDEN_VERBS = [
  "kennen",
  "weten",
  "inzien",
  "begrijpen",
  "verstaan",
  "leren",
  "onderzoeken",
  "ervaren",
  "ontdekken",
  "bewust worden",
] as const;

export const OBSERVABLE_VERBS = [
  "benoemen",
  "aanduiden",
  "opsommen",
  "berekenen",
  "vergelijken",
  "schetsen",
  "uitleggen",
  "rangschikken",
  "herkennen",
  "beschrijven",
  "formuleren",
  "toepassen",
  "situeren",
  "ordenen",
  "classificeren",
  "tekenen",
  "knippen",
  "plakken",
  "durven",
  "tonen",
  "zijn",
] as const;

const FORBIDDEN_VERB_PATTERN = new RegExp(
  `\\b(${FORBIDDEN_VERBS.join("|")})\\b`,
  "iu",
);

const TEACHER_ACTIVITY_PATTERN =
  /\bde\s+leerkracht\b|\bde\s+juf\b|\bde\s+meester\b|\bde\s+leerkrachten\b/iu;

const CONTENT_GOAL_PATTERN =
  /^(?:het\s+(?:begrip|fenomeen|concept|thema|onderwerp)|de\s+(?:stof|inhoud|thema'?s?))\b/iu;

const LEARNING_PROCESS_PATTERN =
  /\b(kijken\s+naar|luisteren\s+naar|bekijken\s+van|maken\s+van\s+een\s+film|naar\s+een\s+film|naar\s+een\s+video|bezoeken\s+van)\b/iu;

const PRODUCTIVE_COOPERATION_PATTERN =
  /\b(samenwerken|co[öo]pereren|doelgericht\s+samenwerken|groepswerk|samen\s+tot\s+een\s+oplossing)\b/iu;

const DOUBLE_GOAL_PATTERN =
  /\b(?:en|\/)\s*(?:benoemen|aanduiden|opsommen|berekenen|vergelijken|uitleggen|rangschikken|herkennen|beschrijven|formuleren|tekenen|knippen)\b/iu;

const DAS_OPENING_PATTERN =
  /\bde\s+leerlingen\s+(?:durven|willen|zijn\s+bereid\s+om|beleven\s+plezier\s+aan|tonen\s+interesse\s+voor|zijn)\b/iu;

const MC_OPENING_PATTERN = /^De\s+leerlingen\s+kunnen\b/u;

const SPEEK_GOAL_PATTERN =
  /\b(spreekdoel|presenteren|presentatie|vertellen\s+aan|spreken\s+voor|monoloog|referaat)\b/iu;

const MUZISCH_GOAL_PATTERN =
  /\b(muzisch|zingen|zang|ritme|melodie|instrument|begeleiding|muziekstuk)\b/iu;

export const DAS_INDICATOR_PATTERN =
  /\b(durven|willen|bereid|plezier|interesse|houding|motivatie|respect|co[öo]pereren|samenwerken|emotie|gevoel|waarderen|zelfvertrouwen|gedrag)\b/iu;

export const SPM_INDICATOR_PATTERN =
  /\b(tekenen|knippen|plakken|bouwen|bewegen|dansen|springen|gooien|vangen|vouwen|grijpen|penvast|balvaardig|motor|lichaam|zintuig|waarnemen|voelen\s+met)\b/iu;

export function containsForbiddenVerb(text: string) {
  FORBIDDEN_VERB_PATTERN.lastIndex = 0;
  return FORBIDDEN_VERB_PATTERN.test(text);
}

export function findForbiddenVerbs(text: string) {
  FORBIDDEN_VERB_PATTERN.lastIndex = 0;
  return [
    ...new Set(
      [...text.matchAll(new RegExp(FORBIDDEN_VERB_PATTERN.source, "giu"))].map(
        (match) => match[0].toLocaleLowerCase("nl-BE"),
      ),
    ),
  ];
}

export function isTeacherActivityGoal(text: string) {
  return TEACHER_ACTIVITY_PATTERN.test(text);
}

export function isContentGoal(text: string) {
  const trimmed = text.trim();
  return (
    CONTENT_GOAL_PATTERN.test(trimmed) &&
    !/^de\s+leerlingen\b/iu.test(trimmed)
  );
}

export function isLearningProcessGoal(text: string) {
  return (
    LEARNING_PROCESS_PATTERN.test(text) &&
    !PRODUCTIVE_COOPERATION_PATTERN.test(text)
  );
}

export function hasDoubleGoalWording(text: string) {
  const lower = text.toLocaleLowerCase("nl-BE");
  const verbHits = [
    ...lower.matchAll(
      /\b(benoemen|aanduiden|opsommen|berekenen|vergelijken|uitleggen|rangschikken|herkennen|beschrijven|formuleren|tekenen|knippen|plakken)\b/giu,
    ),
  ];
  if (verbHits.length < 2) return false;
  return DOUBLE_GOAL_PATTERN.test(lower);
}

export function inferGoalDomain(text: string): GoalDomain {
  const lower = text.toLocaleLowerCase("nl-BE");
  if (MUZISCH_GOAL_PATTERN.test(lower)) return "muzisch";
  if (SPEEK_GOAL_PATTERN.test(lower)) return "spreek";
  if (DAS_OPENING_PATTERN.test(text) || DAS_INDICATOR_PATTERN.test(lower)) {
    if (!MC_OPENING_PATTERN.test(text) && !SPM_INDICATOR_PATTERN.test(lower)) {
      return "DAS";
    }
  }
  return "MC";
}

export function replaceForbiddenVerbs(text: string) {
  const replacements: Array<{ pattern: RegExp; replacement: string; term: string }> =
    [
      { pattern: /\bkennen\b/giu, replacement: "benoemen", term: "kennen" },
      { pattern: /\bkent\b/giu, replacement: "benoemt", term: "kennen" },
      { pattern: /\bweten\b/giu, replacement: "benoemen", term: "weten" },
      { pattern: /\bweet\b/giu, replacement: "benoemt", term: "weten" },
      { pattern: /\binzien\b/giu, replacement: "uitleggen", term: "inzien" },
      { pattern: /\bbegrijpen\b/giu, replacement: "uitleggen", term: "begrijpen" },
      { pattern: /\bbegrijpt\b/giu, replacement: "legt uit", term: "begrijpen" },
      { pattern: /\bverstaan\b/giu, replacement: "uitleggen", term: "verstaan" },
      { pattern: /\b(lere?n)\b/giu, replacement: "toepassen", term: "leren" },
      { pattern: /\bonderzoeken\b/giu, replacement: "beschrijven", term: "onderzoeken" },
      { pattern: /\bervaren\b/giu, replacement: "beschrijven", term: "ervaren" },
      { pattern: /\bontdekken\b/giu, replacement: "aanduiden", term: "ontdekken" },
      {
        pattern: /\bbewust worden\b/giu,
        replacement: "benoemen",
        term: "bewust worden",
      },
    ];

  let next = text;
  const removedTerms: string[] = [];
  const addedTerms: string[] = [];

  for (const rule of replacements) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(next)) {
      removedTerms.push(rule.term);
      next = next.replace(rule.pattern, rule.replacement);
      if (!addedTerms.includes(rule.replacement)) {
        addedTerms.push(rule.replacement);
      }
    }
  }

  return { text: next, removedTerms, addedTerms };
}

export function collapseDoubleGoalVerbs(text: string) {
  return text
    .replace(
      /\b(aanduiden|herkennen|opsommen)\s+en\s+benoemen\b/giu,
      "benoemen",
    )
    .replace(
      /\bbenoemen\s+en\s+(aanduiden|herkennen|opsommen)\b/giu,
      "benoemen",
    )
    .replace(/\b(\w+)\s+en\s+\1\b/giu, "$1");
}

export function usesMcOpening(text: string) {
  return MC_OPENING_PATTERN.test(text.trim());
}

export function usesDasOpening(text: string) {
  return DAS_OPENING_PATTERN.test(text.trim());
}

export function validateMcImprovedGoal(text: string) {
  return usesMcOpening(text) && !containsForbiddenVerb(text);
}

export function validateDasImprovedGoal(text: string) {
  return usesDasOpening(text) && !/\bde\s+leerlingen\s+kunnen\b/iu.test(text);
}

export function openGoalChecklist(domain: GoalDomain, text: string) {
  const lower = text.toLocaleLowerCase("nl-BE");
  if (domain === "spreek") {
    return {
      wat: /\b(wat|inhoud|onderwerp|boodschap|tekst)\b/iu.test(lower),
      voorWie: /\b(voor\s+wie|doelpubliek|klas|leerlingen|ouders|jury)\b/iu.test(
        lower,
      ),
      hoe: /\b(hoe|via|kanaal|vorm|presentatie|monoloog|poster|video)\b/iu.test(
        lower,
      ),
      waarom: /\b(waarom|doel|bedoeling|overtuigen|informeren)\b/iu.test(lower),
    };
  }
  if (domain === "muzisch") {
    return {
      rond: /\b(rond|over|thema|onderwerp)\b/iu.test(lower),
      met: /\b(met|werkvorm|instrument|techniek|ritme|melodie)\b/iu.test(lower),
      aan: /\b(aan|bouwsteen|focus|aspect|basisondersteuning)\b/iu.test(lower),
    };
  }
  return null;
}
