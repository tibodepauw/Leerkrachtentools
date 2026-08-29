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
];

const DISCIPLINE_HINTS: Array<{ pattern: RegExp; discipline: string }> = [
  {
    pattern:
      /vermenigvuld|vermeningvuld|optell|optel|aftrek|deel|breuk|wiskunde|getal|tafel|reken|maaltafel|splitz/i,
    discipline: "Wiskunde",
  },
  { pattern: /nederlands|lezen|spell|schrijf|taal/i, discipline: "Nederlands" },
  { pattern: /frans/i, discipline: "Frans" },
  { pattern: /geschiedenis|tijdlijn|histor/i, discipline: "Geschiedenis" },
  {
    pattern: /wetenschap|techniek|natuur/i,
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

export function scoreDisciplineBonus(
  query: string,
  discipline: string,
  code = "",
): number {
  const hint = inferDisciplineFromQuery(query);
  if (!hint) {
    return 0;
  }

  const normalizedDiscipline = discipline.toLocaleLowerCase("nl-BE");
  const normalizedHint = hint.toLocaleLowerCase("nl-BE");

  if (
    normalizedDiscipline.includes(normalizedHint) ||
    normalizedHint.includes(normalizedDiscipline) ||
    normalizedDiscipline.includes("wiskundig denken") ||
    (isZillMathThinkingCode(code) && hint === "Wiskunde")
  ) {
    return 0.22;
  }

  if (discipline.trim()) {
    return -0.08;
  }

  return 0;
}

export function scoreCurriculumCandidate({
  query,
  haystack,
  discipline,
  titel,
  code = "",
}: {
  query: string;
  haystack: string;
  discipline: string;
  titel: string;
  code?: string;
}): { score: number; tokenMatches: number } {
  const tokens = tokenizeCurriculumQuery(query);
  const tokenMatches = countCurriculumTokenMatches(haystack, tokens);
  const titelScore = scoreCurriculumOverlap(titel, tokens);
  const contextScore = scoreCurriculumOverlap(haystack, tokens);

  let score = Math.min(
    1,
    titelScore * 0.55 +
      contextScore * 0.45 +
      scoreDisciplineBonus(query, discipline, code),
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
