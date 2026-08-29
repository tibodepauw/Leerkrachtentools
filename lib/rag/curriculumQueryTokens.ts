import { tokenize } from "@/lib/rag/curriculumCorpus";
import {
  fuzzySimilarity,
  isFuzzySimilar,
} from "@/lib/rag/fuzzyMatch";

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
    pattern: /optell|optel[^a-z]|som|plus/i,
    stems: ["optell", "som", "plus", "brug"],
  },
  {
    pattern: /aftrek|aftreken|verschil|min[^a-z]/i,
    stems: ["aftrek", "verschil", "min", "brug"],
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
];

/** Canonical terms used to recover from typos via fuzzy matching. */
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
    stems: ["optell", "som", "plus", "brug"],
  },
  {
    canonical: "aftrekken",
    stems: ["aftrek", "verschil", "min", "brug"],
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
];

const DISCIPLINE_HINTS: Array<{ pattern: RegExp; discipline: string }> = [
  {
    pattern:
      /vermenigvuld|vermeningvuld|optell|optel|aftrek|deel|breuk|wiskunde|getal|tafel|reken|maaltafel|splitz/i,
    discipline: "Wiskunde",
  },
  {
    pattern: /sleutelwoord|begrijpend|alinea|woordbetekenis/i,
    discipline: "Schriftelijke taalvaardigheid",
  },
  {
    pattern: /nederlands|lezen|spell|schrijf|taal|tekst/i,
    discipline: "Nederlands",
  },
  { pattern: /frans/i, discipline: "Frans" },
  { pattern: /geschiedenis|tijdlijn|histor/i, discipline: "Geschiedenis" },
  {
    pattern: /zoogdier|zoogdieren|\bdieren\b|planten|bomen|natuur|organismen|biotoop|leefwereld/i,
    discipline: "Oriëntatie op natuur",
  },
  {
    pattern: /wetenschap|techniek/i,
    discipline: "Wetenschap en techniek",
  },
  { pattern: /muziek|muzisch|zang/i, discipline: "Muzische vorming" },
  { pattern: /godsdienst/i, discipline: "Godsdienst" },
];

const FUZZY_MATCH_THRESHOLD = 0.72;

function normalizeQueryText(text: string): string {
  return text
    .toLocaleLowerCase("nl-BE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/(\d)[.\s](\d{3})(?!\d)/g, "$1$2");
}

function queryWords(value: string): string[] {
  return normalizeQueryText(value)
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function expandFuzzyCanonicalStems(tokens: Set<string>, normalized: string): void {
  for (const word of queryWords(normalized)) {
    for (const { canonical, stems } of CANONICAL_QUERY_TERMS) {
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
  const tokens = tokenize(value);
  const normalized = normalizeQueryText(value);

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

  return tokens;
}

export function countCurriculumTokenMatches(
  haystack: string,
  tokens: Set<string>,
): number {
  const normalizedHaystack = normalizeQueryText(haystack);
  let matches = 0;

  for (const token of tokens) {
    if (normalizedHaystack.includes(token)) {
      matches += 1;
    }
  }

  return matches;
}

export function scoreCurriculumOverlap(
  haystack: string,
  tokens: Set<string>,
): number {
  if (tokens.size === 0) {
    return 0;
  }
  return countCurriculumTokenMatches(haystack, tokens) / tokens.size;
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

export function isZillNatureCode(code: string): boolean {
  return /^OWna\d/i.test(code.trim());
}

export function isZillDutchWritingCode(code: string): boolean {
  return /^TOsn\d/i.test(code.trim());
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

export function scoreCodePrefixBonus(query: string, code: string): number {
  const trimmedCode = code.trim();
  if (!trimmedCode) {
    return 0;
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

  if (!hint) {
    return bonus;
  }

  const normalizedHint = hint.toLocaleLowerCase("nl-BE");

  if (
    combined.includes(normalizedHint) ||
    normalizedHint.includes(combined) ||
    combined.includes("wiskundig denken") ||
    (isZillMathThinkingCode(code) && hint === "Wiskunde") ||
    (hint === "Oriëntatie op natuur" && combined.includes("natuur")) ||
    (hint === "Schriftelijke taalvaardigheid" &&
      combined.includes("schriftelijke taalvaardigheid")) ||
    (hint === "Nederlands" &&
      (combined.includes("nederlands") || combined.includes("taalontwikkeling"))) ||
    (hint === "Wetenschap en techniek" && combined.includes("natuur"))
  ) {
    bonus += 0.22;
  } else if (discipline.trim() && bonus <= 0) {
    bonus -= 0.08;
  }

  return bonus;
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
  const tokenMatches = countCurriculumTokenMatches(haystack, tokens);
  const titelScore = scoreCurriculumOverlap(titel, tokens);
  const contextScore = scoreCurriculumOverlap(haystack, tokens);

  let score = Math.min(
    1.2,
    titelScore * 0.55 +
      contextScore * 0.45 +
      scoreDisciplineBonus(query, discipline, code, subdomein),
  );

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

  return { score: Math.min(1.2, score), tokenMatches };
}
