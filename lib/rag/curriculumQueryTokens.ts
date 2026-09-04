import { tokenize } from "@/lib/rag/curriculumCorpus";
import {
  DIDACTIC_STOPWORDS,
  isDidacticStopword,
  stripDidacticPhrases,
} from "@/lib/rag/didacticStopwords";
import {
  applyPhoneticTypos,
  fuzzyMatchHaystackWords,
  fuzzySimilarity,
  haystackWordsFromText,
  isFuzzySimilar,
} from "@/lib/rag/fuzzyMatch";

const CONTENT_TOKEN_WEIGHT = 3;
const HIGH_IDF_TOKEN_WEIGHT = 14;
const STOPWORD_TOKEN_WEIGHT = 0;
const DEFAULT_TOKEN_WEIGHT = 1;
const MATH_DOMAIN_MULTIPLIER = 5;
const TECH_DOMAIN_MULTIPLIER = 5;
const WRONG_DOMAIN_MULTIPLIER = 0.18;

const MATH_HIGH_IDF_STEMS = [
  "maaltafel",
  "maal",
  "tafel",
  "optell",
  "aftrek",
  "vermenigvuld",
  "delen",
  "deeltafel",
  "breuk",
  "kommagetal",
  "komma",
  "cijfer",
  "meetlat",
  "vraagstuk",
  "reken",
] as const;

const TECH_HIGH_IDF_STEMS = [
  "brug",
  "bouw",
  "gewicht",
  "kracht",
  "tape",
  "papier",
  "krantenpapier",
  "materiaal",
  "construct",
  "techniek",
  "kilo",
] as const;

const QUERY_STEM_HINTS: Array<{ pattern: RegExp; stems: string[] }> = [
  {
    pattern: /vermenigvuld|vermeningvuld|maaltafel|maal[^a-z]|tafel/i,
    stems: ["vermenigvuld", "maal", "maaltafel", "tafel", "product", "keer"],
  },
  {
    pattern: /\bdel(?:en|ing)\b|deeltafel|verdel|quot/i,
    stems: ["deel", "deeltafel", "verdel", "quotient"],
  },
  {
    pattern: /optell|optel[^a-z]|som|plus|opptell/i,
    stems: ["optell", "som", "plus"],
  },
  {
    pattern: /aftrek|aftreken|verschil|min[^a-z]/i,
    stems: ["aftrek", "verschil", "min"],
  },
  {
    pattern: /vraagstuk|cijferen|meetlat|kommagetal/i,
    stems: ["vraagstuk", "cijfer", "meetlat", "kommagetal", "reken"],
  },
  {
    pattern:
      /(?:stevige\s+)?brug|bouwen|constructie|krantenpapier|\btape\b|gewicht van|\bkilo\b|technisch systeem/i,
    stems: [
      "brug",
      "bouw",
      "construct",
      "materiaal",
      "techniek",
      "gewicht",
      "papier",
      "krantenpapier",
      "tape",
    ],
  },
  {
    pattern: /liedje|zingen|\bzang\b|\bdansen\b|\bdans\b|muziek|muzisch/i,
    stems: ["liedje", "zingen", "zang", "dansen", "muzisch", "muziek"],
  },
  {
    pattern: /tikker|tikkertje|mikken|pionneke|pionnen|\bpion\b/i,
    stems: ["tikker", "spel", "spelen", "werp", "vang", "bal", "beweg", "motor"],
  },
  {
    pattern: /breuk/i,
    stems: ["breuk"],
  },
  {
    pattern: /komma|decim/i,
    stems: ["komma", "decim"],
  },
  {
    pattern: /splitz|splits/i,
    stems: ["split", "splits"],
  },
  {
    pattern: /zoogdier|zoogdieren|\bdieren\b|\bdier\b|planten|plant|\bbomen\b|\bboom\b|natuur|organismen|organisme|biotoop|leefwereld/i,
    stems: ["dier", "organism", "natuur", "plant", "boom", "biotoop", "leefwereld"],
  },
  {
    pattern: /sleutelwoord|sleutelwoorden|tekst|alinea|lezen|begrijpend|woordbetekenis|woordkennis/i,
    stems: ["sleutelwoord", "tekst", "alinea", "lees", "begrip", "woord"],
  },
  {
    pattern:
      /kasteel|kastelen|burcht|ridder|ridders|middeleeuw|vroeger|erfgoed|monument|historisch|tijdlijn|vulkaan|heerser|tijdvak/i,
    stems: [
      "kasteel",
      "burcht",
      "ridder",
      "middeleeuw",
      "erfgoed",
      "monument",
      "histor",
      "tijd",
      "vulkaan",
    ],
  },
  {
    pattern:
      /koprol|tuimel|rollen|springen|klimmen|klauteren|zwaaien|turnen|gymnastiek|balvaardigheid|werpen|vangen|lopen|evenwicht|balanceren|motoriek|bewegen|lichamelijk|gym|\bturnen\b|\bturn\b/i,
    stems: [
      "koprol",
      "tuimel",
      "roll",
      "spring",
      "klim",
      "klauter",
      "zwaai",
      "turn",
      "gymnast",
      "balvaardig",
      "werp",
      "vang",
      "loop",
      "evenwicht",
      "balanc",
      "motor",
      "beweg",
      "grootmotor",
      "lichaam",
    ],
  },
  {
    pattern:
      /powerpoint|presentatie|presntatie|presenteren|spreekbeurt|slides|canva|digitaal|digitale media|computer|tablet|software|\bapp\b|voordragen|mondeling|toelichten|media/i,
    stems: [
      "powerpoint",
      "present",
      "presntat",
      "spreekbeurt",
      "slide",
      "canva",
      "digitaal",
      "media",
      "computer",
      "tablet",
      "software",
      "voordrag",
      "mondel",
      "toelicht",
    ],
  },
  {
    pattern: /\bopstel\b|\bessay\b|schrijfopdracht|tekst schrijven/i,
    stems: ["opstel", "essay", "schrijfopdr", "schrijven", "schrijf"],
  },
  {
    pattern:
      /programm|prorgamm|coding|\bcode\b|algoritme|computationeel denken|computational thinking/i,
    stems: ["programm", "code", "coding", "algoritm", "comput", "informatica"],
  },
  {
    pattern:
      /(?:snijpunt|x-as|y-as|x as|y as|grafiek|eerstegraadsfunctie|voorschrift|tabel).{0,48}\bfunctie\b|\bfunctie\b.{0,48}(?:snijpunt|x-as|y-as|x as|y as|grafiek|eerstegraadsfunctie|voorschrift|tabel)/i,
    stems: [
      "functie",
      "grafiek",
      "snijpunt",
      "voorschrift",
      "eerstegraads",
      "x-as",
      "y-as",
    ],
  },
  {
    pattern:
      /broeikas|broeikaseffect|klimaatverandering|klimaat|opwarming|fossiel|brandstof|co2|milieu|duurzaam/i,
    stems: [
      "broeikas",
      "broeikase",
      "broeikaseffect",
      "klimaat",
      "klimaatverander",
      "opwarming",
      "fossiel",
      "brandstof",
      "energie",
      "co2",
      "milieu",
    ],
  },
];

const CANONICAL_QUERY_TERMS: Array<{
  canonical: string;
  stems: string[];
}> = [
  {
    canonical: "vermenigvuldigen",
    stems: ["vermenigvuld", "maal", "maaltafel", "tafel", "product", "keer"],
  },
  {
    canonical: "vermenigvuldiging",
    stems: ["vermenigvuld", "maal", "maaltafel", "product", "keer"],
  },
  {
    canonical: "optellen",
    stems: ["optell", "som", "plus"],
  },
  {
    canonical: "aftrekken",
    stems: ["aftrek", "verschil", "min"],
  },
  {
    canonical: "delen",
    stems: ["deel", "deeltafel", "verdel", "quotient"],
  },
  {
    canonical: "splitsen",
    stems: ["split", "splits"],
  },
  {
    canonical: "zoogdieren",
    stems: ["dier", "organism", "natuur", "zoogdier"],
  },
  {
    canonical: "sleutelwoorden",
    stems: ["sleutelwoord", "tekst", "lees", "woord"],
  },
  {
    canonical: "kastelen",
    stems: ["kasteel", "burcht", "ridder", "middeleeuw", "erfgoed", "monument"],
  },
  {
    canonical: "koprol",
    stems: ["koprol", "roll", "tuimel", "turn", "gymnast", "beweg", "balanc"],
  },
  {
    canonical: "springen",
    stems: ["spring", "klim", "klauter", "loop", "beweg", "grootmotor"],
  },
  {
    canonical: "presentatie",
    stems: [
      "present",
      "presntat",
      "spreekbeurt",
      "slide",
      "powerpoint",
      "canva",
      "digitaal",
      "media",
      "voordrag",
      "mondel",
    ],
  },
  {
    canonical: "presenteren",
    stems: [
      "present",
      "presntat",
      "spreekbeurt",
      "slide",
      "powerpoint",
      "canva",
      "digitaal",
      "media",
      "voordrag",
      "mondel",
    ],
  },
  {
    canonical: "maaltafels",
    stems: ["maaltafel", "maal", "tafel", "vermenigvuld", "keer"],
  },
  {
    canonical: "vraagstukken",
    stems: ["vraagstuk", "reken"],
  },
  {
    canonical: "constructie",
    stems: ["construct", "bouw", "brug", "materiaal", "techniek"],
  },
  {
    canonical: "spelen",
    stems: ["spel", "speel"],
  },
  {
    canonical: "tikkertje",
    stems: ["tikker", "spel", "spelen", "beweg", "motor"],
  },
  {
    canonical: "pionnen",
    stems: ["pion", "mikken", "werp", "spel"],
  },
  {
    canonical: "programmeren",
    stems: ["programm", "code", "coding", "algoritm", "comput", "informatica"],
  },
  {
    canonical: "opstel",
    stems: ["opstel", "essay", "schrijfopdr", "schrijven", "schrijf"],
  },
  {
    canonical: "broeikaseffect",
    stems: ["broeikas", "broeikase", "broeikaseffect", "klimaat", "opwarming"],
  },
  {
    canonical: "klimaatverandering",
    stems: ["klimaat", "klimaatverander", "milieu", "opwarming"],
  },
  {
    canonical: "fossiele",
    stems: ["fossiel", "brandstof", "brandstoffen", "energie", "co2"],
  },
  {
    canonical: "brandstoffen",
    stems: ["fossiel", "brandstof", "brandstoffen", "energie", "co2"],
  },
];

const DISCIPLINE_HINTS: Array<{ pattern: RegExp; discipline: string }> = [
  {
    pattern:
      /(?:snijpunt|x-as|y-as|x as|y as|grafiek|eerstegraadsfunctie|voorschrift|tabel).{0,48}\bfunctie\b|\bfunctie\b.{0,48}(?:snijpunt|x-as|y-as|x as|y as|grafiek|eerstegraadsfunctie|voorschrift|tabel)/i,
    discipline: "Wiskunde",
  },
  {
    pattern:
      /programm|prorgamm|coding|\bcode\b|algoritme|computationeel denken|computational thinking/i,
    discipline: "ICT",
  },
  {
    pattern:
      /vermenigvuld|vermeningvuld|optell|optel|aftrek|deel|breuk|wiskunde|getal|tafel|reken|maaltafel|splitz/i,
    discipline: "Wiskunde",
  },
  {
    pattern: /\bopstel\b|\bessay\b|schrijfopdracht|tekst schrijven/i,
    discipline: "Schriftelijke taalvaardigheid",
  },
  {
    pattern: /sleutelwoord|begrijpend|alinea|woordbetekenis/i,
    discipline: "Schriftelijke taalvaardigheid",
  },
  {
    pattern: /nederlands|lezen|spell|schrijf|taal|tekst/i,
    discipline: "Nederlands",
  },
  { pattern: /\bengels\b/i, discipline: "Engels" },
  { pattern: /frans/i, discipline: "Frans" },
  {
    pattern:
      /geschiedenis|tijdlijn|histor|kasteel|kastelen|burcht|ridder|middeleeuw|vroeger|erfgoed|monument|tijdvak|heerser/i,
    discipline: "Geschiedenis",
  },
  {
    pattern:
      /kasteel|kastelen|burcht|ridder|middeleeuw|vroeger|erfgoed|monument|historisch|tijdlijn|tijdvak|heerser/i,
    discipline: "Oriëntatie op tijd",
  },
  {
    pattern: /zoogdier|zoogdieren|\bdieren\b|planten|bomen|natuur|organismen|biotoop|leefwereld/i,
    discipline: "Oriëntatie op natuur",
  },
  {
    pattern:
      /(?:stevige\s+)?brug|bouwen|constructie|krantenpapier|\btape\b|gewicht van|\bkilo\b|technisch systeem/i,
    discipline: "Wetenschap en techniek",
  },
  {
    pattern: /wetenschap|techniek|vulkaan/i,
    discipline: "Wetenschap en techniek",
  },
  { pattern: /muziek|muzisch|zang/i, discipline: "Muzische vorming" },
  { pattern: /godsdienst/i, discipline: "Godsdienst" },
  {
    pattern:
      /koprol|tuimel|rollen|springen|klimmen|klauteren|zwaaien|turnen|gymnastiek|balvaardigheid|werpen|vangen|lopen|evenwicht|balanceren|motoriek|bewegen|lichamelijk|gym|\bturnen\b|\bturn\b|\blo\b/i,
    discipline: "Lichamelijke opvoeding",
  },
  {
    pattern:
      /powerpoint|presentatie|presntatie|presenteren|spreekbeurt|slides|canva|digitaal|digitale media|computer|tablet|software|\bapp\b|voordragen|mondeling|toelichten|\bict\b|programm|prorgamm|coding|\bcode\b|algoritme|computationeel denken/i,
    discipline: "ICT",
  },
  {
    pattern:
      /broeikas|broeikaseffect|klimaatverandering|klimaat|opwarming|fossiel|brandstof|co2|milieu|duurzaam/i,
    discipline: "Exacte wetenschappen",
  },
];

const FUZZY_MATCH_THRESHOLD = 0.72;

const DUTCH_NUMBER_WORDS: Array<[string, string]> = [
  ["duizend", "1000"],
  ["honderd", "100"],
  ["negentig", "90"],
  ["tachtig", "80"],
  ["zeventig", "70"],
  ["zestig", "60"],
  ["vijftig", "50"],
  ["veertig", "40"],
  ["dertig", "30"],
  ["twintig", "20"],
  ["twintich", "20"],
  ["negentien", "19"],
  ["achttien", "18"],
  ["zeventien", "17"],
  ["zestien", "16"],
  ["vijftien", "15"],
  ["veertien", "14"],
  ["dertien", "13"],
  ["twaalf", "12"],
  ["elf", "11"],
  ["tien", "10"],
  ["negen", "9"],
  ["acht", "8"],
  ["zeven", "7"],
  ["zes", "6"],
  ["vijf", "5"],
  ["vier", "4"],
  ["drie", "3"],
  ["twee", "2"],
  ["een", "1"],
  ["eén", "1"],
  ["één", "1"],
];

export function normalizeDutchNumberWords(text: string): string {
  let result = text;
  for (const [word, digit] of DUTCH_NUMBER_WORDS) {
    result = result.replace(
      new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "giu"),
      digit,
    );
  }
  return result;
}

export function normalizeQueryText(text: string): string {
  return applyPhoneticTypos(
    normalizeDutchNumberWords(
      stripDidacticPhrases(
        text
          .toLocaleLowerCase("nl-BE")
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .replace(/(\d)[.\s](\d{3})(?!\d)/g, "$1$2"),
      ),
    ),
  );
}

function queryWords(value: string): string[] {
  return normalizeQueryText(value)
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

export function extractContentTokens(query: string): Set<string> {
  const normalized = normalizeQueryText(query);
  const tokens = new Set<string>();

  for (const word of queryWords(normalized)) {
    if (!isDidacticStopword(word)) {
      tokens.add(word);
    }
  }

  for (const match of normalized.matchAll(/\b\d{1,7}\b/g)) {
    tokens.add(match[0]);
  }

  return tokens;
}

function isContentToken(token: string, contentTokens: Set<string>): boolean {
  if (contentTokens.has(token)) {
    return true;
  }

  for (const content of contentTokens) {
    if (
      content.length >= 4 &&
      (token.includes(content) || content.includes(token))
    ) {
      return true;
    }
  }

  return false;
}

export function queryMatchesMathTopic(query: string): boolean {
  return /maaltafel|vermenigvuld|vermeningvuld|optell|aftrek|\bdel(?:en|ing)\b|breuk|kommagetal|cijferen|meetlat|vraagstuk|wiskunde|reken|\btafel(?:s)?\b/i.test(
    normalizeQueryText(query),
  );
}

export function queryMatchesTechTopic(query: string): boolean {
  return /(?:stevige\s+)?brug|bouwen|constructie|krantenpapier|\btape\b|gewicht van|\bkilo\b|technisch systeem/i.test(
    normalizeQueryText(query),
  );
}

export function queryMatchesMusicTopic(query: string): boolean {
  return /liedje|zingen|\bzang\b|\bdansen\b|\bdans\b|muziek|muzisch/i.test(
    normalizeQueryText(query),
  );
}

function tokenMatchesHighIdfStem(
  token: string,
  stems: readonly string[],
): boolean {
  return stems.some(
    (stem) =>
      token === stem ||
      (stem.length >= 4 && (token.startsWith(stem) || stem.startsWith(token))),
  );
}

function isHighIdfToken(token: string, query: string): boolean {
  if (/^\d{1,7}$/.test(token) && queryMatchesMathTopic(query)) {
    return true;
  }
  if (queryMatchesMathTopic(query) && tokenMatchesHighIdfStem(token, MATH_HIGH_IDF_STEMS)) {
    if (token === "tafel" || token.startsWith("tafel")) {
      return /maal|reken|wiskunde|cijfer|vraagstuk/.test(normalizeQueryText(query));
    }
    return true;
  }
  if (queryMatchesTechTopic(query) && tokenMatchesHighIdfStem(token, TECH_HIGH_IDF_STEMS)) {
    return true;
  }
  return false;
}

export function tokenWeight(token: string, contentTokens: Set<string>, query = ""): number {
  if (isDidacticStopword(token)) {
    return STOPWORD_TOKEN_WEIGHT;
  }
  if (query && isHighIdfToken(token, query)) {
    return HIGH_IDF_TOKEN_WEIGHT;
  }
  if (isContentToken(token, contentTokens)) {
    return CONTENT_TOKEN_WEIGHT;
  }
  return DEFAULT_TOKEN_WEIGHT;
}

function expandFuzzyCanonicalStems(tokens: Set<string>, normalized: string): void {
  for (const word of queryWords(normalized)) {
    for (const { canonical, stems } of CANONICAL_QUERY_TERMS) {
      if (
        canonical === "opstel" &&
        word !== "opstel" &&
        word.startsWith("opstel")
      ) {
        continue;
      }
      if (
        canonical === "optellen" &&
        word.startsWith("opstel") &&
        word !== "optellen"
      ) {
        continue;
      }

      if (
        isFuzzySimilar(word, canonical, FUZZY_MATCH_THRESHOLD) ||
        fuzzySimilarity(word, canonical) >= 0.68
      ) {
        for (const stem of stems) {
          tokens.add(stem);
        }
        tokens.add(canonical.slice(0, Math.min(canonical.length, 12)));
      }
    }
  }
}

export function tokenizeCurriculumQuery(value: string): Set<string> {
  const normalized = normalizeQueryText(value);
  const tokens = tokenize(normalized);

  for (const match of normalized.matchAll(/\b\d{1,7}\b/g)) {
    tokens.add(match[0]);
  }

  for (const { pattern, stems } of QUERY_STEM_HINTS) {
    if (pattern.test(normalized)) {
      for (const stem of stems) {
        tokens.add(stem);
      }
    }
  }

  expandFuzzyCanonicalStems(tokens, normalized);

  for (const stopword of DIDACTIC_STOPWORDS) {
    tokens.delete(stopword);
  }

  return tokens;
}

export function extractIndexTokens(text: string): Set<string> {
  const normalized = normalizeQueryText(text);
  const tokens = new Set<string>();

  for (const word of queryWords(normalized)) {
    if (isDidacticStopword(word)) {
      continue;
    }
    if (word.length >= 3) {
      tokens.add(word);
    }
    if (word.length >= 5) {
      tokens.add(word.slice(0, 5));
    }
    if (word.length >= 4) {
      tokens.add(word.slice(0, 4));
    }
  }

  for (const match of normalized.matchAll(/\b\d{1,7}\b/g)) {
    tokens.add(match[0]);
  }

  return tokens;
}

export function countCurriculumTokenMatches(
  haystack: string,
  tokens: Set<string>,
  query = "",
): number {
  const normalizedHaystack = normalizeQueryText(haystack);
  const contentTokens = query ? extractContentTokens(query) : new Set<string>();
  const haystackWords = haystackWordsFromText(normalizedHaystack);
  let weightedMatches = 0;

  for (const token of tokens) {
    if (isDidacticStopword(token)) {
      continue;
    }
    const matched =
      normalizedHaystack.includes(token) ||
      (token.length >= 5 &&
        fuzzyMatchHaystackWords(haystackWords, token, 0.78));
    if (!matched) {
      continue;
    }

    weightedMatches += query
      ? tokenWeight(token, contentTokens, query)
      : DEFAULT_TOKEN_WEIGHT;
  }

  return weightedMatches;
}

export function scoreCurriculumOverlap(
  haystack: string,
  tokens: Set<string>,
  query = "",
): number {
  if (tokens.size === 0) {
    return 0;
  }

  const normalizedHaystack = normalizeQueryText(haystack);
  const contentTokens = query ? extractContentTokens(query) : new Set<string>();
  const haystackWords = haystackWordsFromText(normalizedHaystack);
  let weightedMatches = 0;
  let totalWeight = 0;

  for (const token of tokens) {
    if (isDidacticStopword(token)) {
      continue;
    }
    const weight = query
      ? tokenWeight(token, contentTokens, query)
      : DEFAULT_TOKEN_WEIGHT;
    if (weight <= 0) {
      continue;
    }
    totalWeight += weight;
    const matched =
      normalizedHaystack.includes(token) ||
      (token.length >= 5 &&
        fuzzyMatchHaystackWords(haystackWords, token, 0.78));
    if (matched) {
      weightedMatches += weight;
    }
  }

  return totalWeight === 0 ? 0 : weightedMatches / totalWeight;
}

export function inferDisciplineFromQuery(query: string): string | null {
  const normalized = normalizeQueryText(query);
  for (const { pattern, discipline } of DISCIPLINE_HINTS) {
    if (pattern.test(normalized)) {
      return discipline;
    }
  }
  return null;
}

export function isZillMathThinkingCode(code: string): boolean {
  return /^WD(?:gk|lw|mm|rv|mk)\d/i.test(code.trim());
}

export function isZillTechCode(code: string): boolean {
  return /^OWte\d/i.test(code.trim());
}

export function isZillNatureCode(code: string): boolean {
  return /^OWna\d/i.test(code.trim());
}

export function isZillTimeCode(code: string): boolean {
  return /^OWti\d/i.test(code.trim());
}

export function isZillDutchWritingCode(code: string): boolean {
  return /^TOsn\d/i.test(code.trim());
}

export function isZillMotorGrossCode(code: string): boolean {
  return /^MZgm\d/i.test(code.trim());
}

export function isZillMotorBodyCode(code: string): boolean {
  return /^MZlb\d/i.test(code.trim());
}

export function isZillMotorCode(code: string): boolean {
  const trimmed = code.trim();
  return /^MZ(?:gm|lb)\d/i.test(trimmed);
}

export function isZillMediaCode(code: string): boolean {
  return /^ME(?:mw|ge|va|cr)\d/i.test(code.trim());
}

export function isZillDutchSpeakingCode(code: string): boolean {
  return /^TOmn\d/i.test(code.trim());
}

function queryMatchesNatureTopic(query: string): boolean {
  return /zoogdier|zoogdieren|\bdieren\b|\bdier\b|planten|plant|\bbomen\b|\bboom\b|natuur|organismen|organisme|biotoop|leefwereld/i.test(
    normalizeQueryText(query),
  );
}

function queryMatchesReadingTopic(query: string): boolean {
  return /sleutelwoord|tekst|alinea|lezen|begrijpend|woordbetekenis|woordkennis/i.test(
    normalizeQueryText(query),
  );
}

function queryMatchesHistoryTopic(query: string): boolean {
  return /kasteel|kastelen|burcht|ridder|ridders|middeleeuw|vroeger|erfgoed|monument|historisch|tijdlijn|tijdvak|heerser|geschiedenis|vulkaan/i.test(
    normalizeQueryText(query),
  );
}

function queryMatchesMotorTopic(query: string): boolean {
  if (queryMatchesTechTopic(query) || queryMatchesMathTopic(query)) {
    return false;
  }
  return /koprol|tuimel|rollen|springen|klimmen|klauteren|zwaaien|turnen|gymnastiek|balvaardigheid|werpen|vangen|lopen|evenwicht|balanceren|motoriek|bewegen|lichamelijk|gym|\bturnen\b|\bturn\b|\blo\b|tikker|mikken|pion/i.test(
    normalizeQueryText(query),
  );
}

function queryMatchesMediaTopic(query: string): boolean {
  return /powerpoint|presentatie|presntatie|presenteren|spreekbeurt|slides|canva|digitaal|digitale media|computer|tablet|software|\bapp\b|voordragen|mondeling|toelichten|\bict\b|media/i.test(
    normalizeQueryText(query),
  );
}

export function queryMatchesEnglishTopic(query: string): boolean {
  return /\bengels\b/i.test(normalizeQueryText(query));
}

function queryMatchesWritingTopic(query: string): boolean {
  return /\bopstel\b|\bessay\b|schrijfopdracht|tekst schrijven/i.test(
    normalizeQueryText(query),
  );
}

export function queryMatchesMathFunctionTopic(query: string): boolean {
  return /(?:snijpunt|x-as|y-as|x as|y as|grafiek|eerstegraadsfunctie|voorschrift|tabel).{0,48}\bfunctie\b|\bfunctie\b.{0,48}(?:snijpunt|x-as|y-as|x as|y as|grafiek|eerstegraadsfunctie|voorschrift|tabel)/i.test(
    normalizeQueryText(query),
  );
}

export function queryMatchesProgrammingTopic(query: string): boolean {
  return /programm|prorgamm|coding|\bcode\b|algoritme|computationeel denken|computational thinking/i.test(
    normalizeQueryText(query),
  );
}

export function queryMatchesClimateTopic(query: string): boolean {
  return /broeikas|broeikaseffect|klimaatverandering|klimaat|opwarming|fossiel|brandstof|co2|milieu|duurzaam/i.test(
    normalizeQueryText(query),
  );
}

export function scoreClimateMinimumGoalBonus(
  query: string,
  discipline: string,
  code: string,
  sleutelcompetentieNr = "",
): number {
  if (!queryMatchesClimateTopic(query)) {
    return 0;
  }

  const combined = `${discipline} ${sleutelcompetentieNr}`.toLocaleLowerCase(
    "nl-BE",
  );
  const codePrefix = code.trim().slice(0, 2);
  let bonus = 0;

  if (
    sleutelcompetentieNr === "6" ||
    codePrefix === "06" ||
    combined.includes("exacte wetenschappen") ||
    combined.includes("wiskunde, exacte")
  ) {
    bonus += 0.35;
  }

  if (
    sleutelcompetentieNr === "9" ||
    codePrefix === "09" ||
    combined.includes("ruimtelijk bewustzijn") ||
    combined.includes("aardrijkskunde")
  ) {
    bonus += 0.35;
  }

  if (sleutelcompetentieNr === "10" || codePrefix === "10") {
    bonus += 0.22;
  }

  const minimumLower = normalizeQueryText(`${discipline} ${code}`);
  if (/broeikas|klimaat|opwarming|fossiel|brandstof|milieu/i.test(minimumLower)) {
    bonus += 0.12;
  }

  return bonus;
}

export function scoreCodePrefixBonus(query: string, code: string): number {
  const trimmedCode = code.trim();
  if (!trimmedCode) {
    return 0;
  }

  if (queryMatchesMathTopic(query)) {
    if (isZillMathThinkingCode(trimmedCode) || /^WD/i.test(trimmedCode)) {
      return 0.45;
    }
    if (/^TO|^MZ|^RK|^ME/i.test(trimmedCode)) {
      return -0.28;
    }
  }

  if (queryMatchesTechTopic(query)) {
    if (isZillTechCode(trimmedCode)) {
      return 0.45;
    }
    if (/^MZ|^RK|^TO|^ME/i.test(trimmedCode)) {
      return -0.28;
    }
  }

  if (queryMatchesNatureTopic(query)) {
    if (isZillNatureCode(trimmedCode)) {
      return 0.28;
    }
    if (/^OW/i.test(trimmedCode)) {
      return 0.08;
    }
  }

  if (queryMatchesReadingTopic(query)) {
    if (isZillDutchWritingCode(trimmedCode)) {
      return 0.28;
    }
    if (/^TOmf/i.test(trimmedCode)) {
      return -0.18;
    }
    if (/^RK/i.test(trimmedCode)) {
      return -0.12;
    }
  }

  if (queryMatchesHistoryTopic(query)) {
    if (isZillTimeCode(trimmedCode)) {
      return 0.3;
    }
    if (/^OWti/i.test(trimmedCode)) {
      return 0.3;
    }
    if (/^OWbc/i.test(trimmedCode)) {
      return 0.1;
    }
    if (/^RK/i.test(trimmedCode)) {
      return -0.1;
    }
  }

  if (queryMatchesMotorTopic(query)) {
    if (isZillMotorGrossCode(trimmedCode)) {
      return 0.3;
    }
    if (isZillMotorBodyCode(trimmedCode)) {
      return 0.3;
    }
    if (/^MZ/i.test(trimmedCode)) {
      return 0.1;
    }
    if (/^RK/i.test(trimmedCode)) {
      return -0.1;
    }
  }

  if (queryMatchesMediaTopic(query)) {
    if (isZillMediaCode(trimmedCode)) {
      return 0.3;
    }
    if (isZillDutchSpeakingCode(trimmedCode)) {
      return 0.28;
    }
    if (/^TOmf/i.test(trimmedCode)) {
      return 0.08;
    }
    if (/^RK/i.test(trimmedCode)) {
      return -0.1;
    }
  }

  return 0;
}

export function scoreDisciplineBonus(
  query: string,
  discipline: string,
  code = "",
  subdomein = "",
): number {
  const hint = inferDisciplineFromQuery(query);
  const combined = `${discipline} ${subdomein}`.toLocaleLowerCase("nl-BE");
  let bonus = scoreCodePrefixBonus(query, code);

  if (queryMatchesEnglishTopic(query)) {
    if (
      combined.includes("engels") ||
      combined.includes("vreemde talen") ||
      combined.includes("english")
    ) {
      bonus += 0.35;
    } else if (discipline.trim() && bonus <= 0) {
      bonus -= 0.08;
    }
  }

  if (queryMatchesWritingTopic(query)) {
    if (
      combined.includes("schriftelijke taalvaardigheid") ||
      combined.includes("schrijf") ||
      combined.includes("taalvaardigheid")
    ) {
      bonus += 0.22;
    }
  }

  if (queryMatchesMusicTopic(query)) {
    if (
      combined.includes("muzisch") ||
      combined.includes("muziek") ||
      combined.includes("zang") ||
      combined.includes("dans")
    ) {
      bonus += 0.28;
    }
  }

  if (queryMatchesMathFunctionTopic(query)) {
    if (
      combined.includes("wiskunde") ||
      combined.includes("wiskundig") ||
      combined.includes("algebra") ||
      combined.includes("grafiek")
    ) {
      bonus += 0.35;
    }
    if (
      combined.includes("engels") ||
      combined.includes("grammatica") ||
      combined.includes("taalkundig") ||
      combined.includes("zinsdeel")
    ) {
      bonus -= 0.35;
    }
  }

  if (queryMatchesProgrammingTopic(query)) {
    if (
      combined.includes("ict") ||
      combined.includes("media") ||
      combined.includes("mediakundig") ||
      combined.includes("digitaal") ||
      combined.includes("informatica")
    ) {
      bonus += 0.35;
    }
    if (combined.includes("wiskunde") || combined.includes("wiskundig")) {
      bonus += 0.22;
    }
    if (
      combined.includes("stem") ||
      combined.includes("techniek") ||
      combined.includes("wetenschap")
    ) {
      bonus += 0.22;
    }
  }

  if (queryMatchesClimateTopic(query)) {
    if (
      combined.includes("exacte wetenschappen") ||
      combined.includes("wiskunde, exacte") ||
      combined.includes("natuurwetenschap") ||
      combined.includes("aardrijkskunde") ||
      combined.includes("ruimtelijk bewustzijn") ||
      combined.includes("duurzaam")
    ) {
      bonus += 0.35;
    } else if (
      combined.includes("wetenschap") ||
      combined.includes("techniek") ||
      combined.includes("milieu")
    ) {
      bonus += 0.22;
    }
  }

  if (!hint) {
    return bonus;
  }

  const normalizedHint = hint.toLocaleLowerCase("nl-BE");

  if (
    combined.includes(normalizedHint) ||
    normalizedHint.includes(combined) ||
    combined.includes("wiskundig denken") ||
    (isZillMathThinkingCode(code) && hint === "Wiskunde") ||
    (hint === "Engels" &&
      (combined.includes("engels") ||
        combined.includes("vreemde talen") ||
        combined.includes("english"))) ||
    (hint === "Oriëntatie op natuur" && combined.includes("natuur")) ||
    (hint === "Oriëntatie op tijd" &&
      (combined.includes("tijd") || combined.includes("wereld"))) ||
    (hint === "Geschiedenis" &&
      (combined.includes("geschiedenis") ||
        combined.includes("tijd") ||
        combined.includes("wereld"))) ||
    (hint === "Schriftelijke taalvaardigheid" &&
      combined.includes("schriftelijke taalvaardigheid")) ||
    (hint === "Nederlands" &&
      (combined.includes("nederlands") || combined.includes("taalontwikkeling"))) ||
    (hint === "Wetenschap en techniek" &&
      (combined.includes("natuur") ||
        combined.includes("techniek") ||
        combined.includes("technische") ||
        isZillTechCode(code))) ||
    (hint === "Lichamelijke opvoeding" &&
      (combined.includes("lichamelijk") ||
        combined.includes("motor") ||
        combined.includes("beweg") ||
        combined.includes("gym") ||
        combined.includes("turn"))) ||
    (hint === "ICT" &&
      (combined.includes("ict") ||
        combined.includes("media") ||
        combined.includes("mediakundig") ||
        combined.includes("digitaal") ||
        combined.includes("computer")))
  ) {
    bonus += 0.22;
  } else if (discipline.trim() && bonus <= 0) {
    bonus -= 0.08;
  }

  return bonus;
}

export function isMathDomain(
  discipline: string,
  code = "",
  subdomein = "",
): boolean {
  const combined = `${discipline} ${subdomein}`.toLocaleLowerCase("nl-BE");
  return (
    isZillMathThinkingCode(code) ||
    /^WD/i.test(code.trim()) ||
    combined.includes("wiskunde") ||
    combined.includes("wiskundig")
  );
}

export function isTechDomain(
  discipline: string,
  code = "",
  subdomein = "",
): boolean {
  const combined = `${discipline} ${subdomein}`.toLocaleLowerCase("nl-BE");
  return (
    isZillTechCode(code) ||
    combined.includes("techniek") ||
    combined.includes("technische") ||
    combined.includes("w&t") ||
    combined.includes("wetenschap en techniek")
  );
}

function applyDomainMultiplier(
  score: number,
  query: string,
  discipline: string,
  code: string,
  subdomein: string,
): number {
  const mathQuery = queryMatchesMathTopic(query);
  const techQuery = queryMatchesTechTopic(query);

  if (mathQuery && !techQuery) {
    return score * (isMathDomain(discipline, code, subdomein)
      ? MATH_DOMAIN_MULTIPLIER
      : WRONG_DOMAIN_MULTIPLIER);
  }

  if (techQuery && !mathQuery) {
    if (isTechDomain(discipline, code, subdomein)) {
      return score * TECH_DOMAIN_MULTIPLIER;
    }
    const combined = `${discipline} ${subdomein}`.toLocaleLowerCase("nl-BE");
    if (
      combined.includes("lichamelijk") ||
      combined.includes("motor") ||
      combined.includes("godsdienst") ||
      combined.includes("muzisch") ||
      combined.includes("religie")
    ) {
      return score * WRONG_DOMAIN_MULTIPLIER;
    }
    return score * 0.45;
  }

  return score;
}

export function scoreCurriculumCandidate({
  query,
  haystack,
  discipline,
  titel,
  code = "",
  subdomein = "",
}: {
  query: string;
  haystack: string;
  discipline: string;
  titel: string;
  code?: string;
  subdomein?: string;
}): { score: number; tokenMatches: number } {
  const tokens = tokenizeCurriculumQuery(query);
  const tokenMatches = countCurriculumTokenMatches(haystack, tokens, query);
  const titelScore = scoreCurriculumOverlap(titel, tokens, query);
  const contextScore = scoreCurriculumOverlap(haystack, tokens, query);

  let score =
    titelScore * 0.55 +
    contextScore * 0.45 +
    scoreDisciplineBonus(query, discipline, code, subdomein);

  const queryLower = normalizeQueryText(query);
  const titelLower = normalizeQueryText(titel);

  if (
    (queryLower.includes("vermenigvuld") ||
      isFuzzySimilar(queryLower, "vermenigvuldigen", 0.68)) &&
    titelLower.includes("vermenigvuld")
  ) {
    score += 0.12;
  }
  if (queryLower.includes("optell") && titelLower.includes("optell")) {
    score += 0.12;
  }
  if (queryLower.includes("aftrek") && titelLower.includes("aftrek")) {
    score += 0.12;
  }

  if (queryMatchesMathFunctionTopic(query)) {
    if (
      titelLower.includes("zinsdel") ||
      titelLower.includes("grammatica") ||
      titelLower.includes("taalkundig")
    ) {
      score -= 0.35;
    }
    if (
      discipline.toLocaleLowerCase("nl-BE").includes("wiskunde") &&
      (titelLower.includes("grafiek") ||
        titelLower.includes("functie") ||
        titelLower.includes("voorschrift"))
    ) {
      score += 0.15;
    }
  }

  if (
    queryMatchesWritingTopic(query) &&
    /\bopstel\b/u.test(queryLower) &&
    /\bopstel\b/u.test(titelLower)
  ) {
    score += 0.12;
  }

  score = applyDomainMultiplier(score, query, discipline, code, subdomein);
  return { score: Math.max(0, Math.min(6, score)), tokenMatches };
}

export function applyMultiIntentDiversity<
  T extends {
    discipline: string;
    subdomein?: string;
    titel: string;
  },
>(query: string, results: T[], limit: number): T[] {
  if (results.length <= 1 || limit <= 1) {
    return results.slice(0, limit);
  }

  const groups: Array<(item: T) => boolean> = [];
  const haystackOf = (item: T) =>
    `${item.discipline} ${item.subdomein ?? ""} ${item.titel}`;

  if (
    /frans/i.test(normalizeQueryText(query)) &&
    queryMatchesMusicTopic(query)
  ) {
    groups.push((item) => /frans/i.test(haystackOf(item)));
    groups.push((item) =>
      /muzisch|muziek|\bzang|\bdans/i.test(haystackOf(item)),
    );
  }

  if (groups.length < 2) {
    return results.slice(0, limit);
  }

  const remaining = [...results];
  const selected: T[] = [];
  for (const matches of groups) {
    const index = remaining.findIndex(matches);
    if (index === -1) {
      continue;
    }
    selected.push(remaining.splice(index, 1)[0]!);
  }

  selected.push(...remaining);
  return selected.slice(0, limit);
}
