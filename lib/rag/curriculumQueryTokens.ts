import { tokenize } from "@/lib/rag/curriculumCorpus";

const QUERY_STEM_HINTS: Array<{ pattern: RegExp; stems: string[] }> = [
  {
    pattern: /vermenigvuld/i,
    stems: ["vermenigvuld", "maal", "maaltafel", "tafel", "product", "keer"],
  },
  {
    pattern: /\bdel(?:en|ing)\b/i,
    stems: ["deel", "deeltafel", "verdel", "quotient"],
  },
  {
    pattern: /optell/i,
    stems: ["optell", "som", "plus", "brug"],
  },
  {
    pattern: /aftrek/i,
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
];

const DISCIPLINE_HINTS: Array<{ pattern: RegExp; discipline: string }> = [
  { pattern: /vermenigvuld|optell|aftrek|deel|breuk|wiskunde|getal|tafel|reken/i, discipline: "Wiskunde" },
  { pattern: /nederlands|lezen|spell|schrijf|taal/i, discipline: "Nederlands" },
  { pattern: /frans/i, discipline: "Frans" },
  { pattern: /geschiedenis|tijdlijn|histor/i, discipline: "Geschiedenis" },
  { pattern: /wetenschap|techniek|natuur/i, discipline: "Wetenschap en techniek" },
  { pattern: /muziek|muzisch|zang/i, discipline: "Muzische vorming" },
  { pattern: /godsdienst/i, discipline: "Godsdienst" },
];

function normalizeQueryText(text: string): string {
  return text
    .toLocaleLowerCase("nl-BE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/(\d)[.\s](\d{3})(?!\d)/g, "$1$2");
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

export function scoreDisciplineBonus(
  query: string,
  discipline: string,
): number {
  const hint = inferDisciplineFromQuery(query);
  if (!hint || !discipline.trim()) {
    return 0;
  }

  const normalizedDiscipline = discipline.toLocaleLowerCase("nl-BE");
  const normalizedHint = hint.toLocaleLowerCase("nl-BE");

  if (
    normalizedDiscipline.includes(normalizedHint) ||
    normalizedHint.includes(normalizedDiscipline)
  ) {
    return 0.22;
  }

  return -0.08;
}

export function scoreCurriculumCandidate({
  query,
  haystack,
  discipline,
  titel,
}: {
  query: string;
  haystack: string;
  discipline: string;
  titel: string;
}): { score: number; tokenMatches: number } {
  const tokens = tokenizeCurriculumQuery(query);
  const tokenMatches = countCurriculumTokenMatches(haystack, tokens);
  const titelScore = scoreCurriculumOverlap(titel, tokens);
  const contextScore = scoreCurriculumOverlap(haystack, tokens);

  let score = Math.min(
    1,
    titelScore * 0.55 + contextScore * 0.45 + scoreDisciplineBonus(query, discipline),
  );

  const queryLower = normalizeQueryText(query);
  const titelLower = normalizeQueryText(titel);

  if (queryLower.includes("vermenigvuld") && titelLower.includes("vermenigvuld")) {
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
