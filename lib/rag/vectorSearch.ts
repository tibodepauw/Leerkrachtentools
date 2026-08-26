import { curriculumData } from "@/lib/rag/curriculumData";
import type { CurriculumGoal, EducationNetwork } from "@/types";

const DIMENSIONS = 384;
const stopWords = new Set([
  "de",
  "het",
  "een",
  "en",
  "van",
  "in",
  "op",
  "met",
  "aan",
  "te",
  "kunnen",
  "leerlingen",
  "correct",
]);

function normalize(value: string) {
  return value
    .toLocaleLowerCase("nl-BE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ");
}

function tokens(value: string) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % DIMENSIONS;
}

/**
 * Deterministische lokale feature-hashing-embedding. Hiermee blijft retrieval
 * echte vector/cosine search zonder cloudkey; provider-embeddings kunnen later
 * dezelfde VectorStore-interface voeden.
 */
export function embedLocally(value: string) {
  const vector = new Array<number>(DIMENSIONS).fill(0);
  for (const token of tokens(value)) {
    vector[hashToken(token)] += 1;
    if (token.length > 5) vector[hashToken(token.slice(0, -1))] += 0.35;
  }
  const norm = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0));
  return norm ? vector.map((item) => item / norm) : vector;
}

function cosine(left: number[], right: number[]) {
  return left.reduce((sum, item, index) => sum + item * right[index], 0);
}

function searchableText(goal: CurriculumGoal) {
  return [
    goal.text,
    goal.code,
    goal.domain,
    goal.subject,
    ...goal.keywords,
  ].join(" ");
}

export interface RankedGoal {
  goal: CurriculumGoal;
  score: number;
}

export function searchCurriculum({
  query,
  network,
  schoolYear,
  source,
  limit = 3,
}: {
  query: string;
  network?: EducationNetwork;
  schoolYear: string;
  source: CurriculumGoal["source"];
  limit?: number;
}): RankedGoal[] {
  const queryVector = embedLocally(query);
  const queryTokens = new Set(tokens(query));

  return curriculumData
    .filter(
      (goal) =>
        goal.status === "active" &&
        goal.source === source &&
        goal.schoolYears.includes(schoolYear) &&
        (source === "minimumdoel" || goal.network === network),
    )
    .map((goal) => {
      const vectorScore = cosine(
        queryVector,
        embedLocally(searchableText(goal)),
      );
      const keywordHits = goal.keywords.filter((keyword) =>
        tokens(keyword).some((token) => queryTokens.has(token)),
      ).length;
      const keywordScore = Math.min(keywordHits / 3, 1);
      return {
        goal,
        score: Number((vectorScore * 0.75 + keywordScore * 0.25).toFixed(4)),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function futureCurriculum(network: EducationNetwork) {
  return curriculumData.filter(
    (goal) =>
      goal.status === "future" &&
      (goal.network === network || goal.network === "VLAANDEREN"),
  );
}
