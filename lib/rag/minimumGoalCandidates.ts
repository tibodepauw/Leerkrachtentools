import type {
  CurriculumNetworkFilter,
  CurriculumSearchResult,
} from "@/types";
import {
  isAhovoksMinimumGoalCode,
  normalizeAhovoksMinimumGoalResult,
} from "@/lib/rag/ahovoksMinimumGoals";
import {
  dedupeByMinimumGoalCode,
  recordsForNetwork,
  tokenize,
} from "@/lib/rag/curriculumCorpus";
import { decodeHtmlEntities } from "@/lib/rag/curriculumDisplay";

type RawRecord = Record<string, unknown>;

export const MINIMUM_GOAL_CANDIDATE_LIMIT = 50;

const MINIMUM_GOAL_CORPUS_NETWORKS: Array<
  Exclude<CurriculumNetworkFilter, "ALL" | "ZILL" | "GO" | "OVSG" | "GO_NIEUW">
> = ["OPSTAP"];

const MIN_CANDIDATE_TOKEN_MATCHES = 1;
const MIN_CANDIDATE_SCORE = 0.12;

const QUERY_STEM_HINTS: Array<{ pattern: RegExp; stem: string }> = [
  { pattern: /optell/i, stem: "optell" },
  { pattern: /aftrek/i, stem: "aftrek" },
  { pattern: /vermenigvuld/i, stem: "vermenigvuld" },
  { pattern: /deel/i, stem: "deel" },
  { pattern: /tellen/i, stem: "tel" },
  { pattern: /breuk/i, stem: "breuk" },
  { pattern: /komma/i, stem: "komma" },
];

function normalizeNumericText(text: string): string {
  return text
    .toLocaleLowerCase("nl-BE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/(\d)[.\s](\d{3})(?!\d)/g, "$1$2");
}

export function tokenizeMinimumGoalQuery(value: string): Set<string> {
  const tokens = tokenize(value);
  const normalized = normalizeNumericText(value);

  for (const match of normalized.matchAll(/\b\d{1,7}\b/g)) {
    tokens.add(match[0]);
  }

  for (const { pattern, stem } of QUERY_STEM_HINTS) {
    if (pattern.test(normalized)) {
      tokens.add(stem);
    }
  }

  return tokens;
}

function countMinimumGoalTokenMatches(
  haystack: string,
  tokens: Set<string>,
): number {
  const normalizedHaystack = haystack
    .toLocaleLowerCase("nl-BE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  let matches = 0;
  for (const token of tokens) {
    if (normalizedHaystack.includes(token)) {
      matches += 1;
    }
  }
  return matches;
}

function scoreMinimumGoalOverlap(haystack: string, tokens: Set<string>): number {
  if (tokens.size === 0) {
    return 0;
  }
  return countMinimumGoalTokenMatches(haystack, tokens) / tokens.size;
}

function asString(value: unknown): string {
  return typeof value === "string" ? decodeHtmlEntities(value.trim()) : "";
}

function networkFromRaw(raw: RawRecord): CurriculumNetworkFilter | null {
  const netwerk = asString(raw.netwerk ?? raw.network).toUpperCase();
  if (netwerk === "OPSTAP") return "OPSTAP";
  if (netwerk === "OVSG") return "OVSG";
  if (netwerk === "GO_NIEUW") return "GO_NIEUW";
  if (netwerk === "ZILL") return "ZILL";
  if (netwerk === "GO") return "GO";
  return null;
}

function normalizeMinimumGoal(raw: RawRecord) {
  const linked = raw.gelinkt_minimumdoel;
  if (!linked || typeof linked !== "object") {
    return null;
  }

  const record = linked as Record<string, unknown>;
  const code = asString(record.code);
  const tekst = asString(record.tekst);
  if (!code || !tekst || !isAhovoksMinimumGoalCode(code)) {
    return null;
  }

  return {
    code,
    tekst,
    type: asString(record.type),
  };
}

export function normalizeMinimumGoalCandidate(
  raw: RawRecord,
): CurriculumSearchResult | null {
  const minimum = normalizeMinimumGoal(raw);
  if (!minimum?.tekst) {
    return null;
  }

  const network = networkFromRaw(raw);
  if (
    !network ||
    !MINIMUM_GOAL_CORPUS_NETWORKS.includes(
      network as (typeof MINIMUM_GOAL_CORPUS_NETWORKS)[number],
    )
  ) {
    return null;
  }

  const hasLinkedMinimum = Boolean(raw.gelinkt_minimumdoel);
  const discipline = asString(
    raw.discipline ?? raw.leergebied ?? raw.ontwikkelveld,
  );

  const candidate: CurriculumSearchResult = {
    code: "",
    discipline,
    subdomein: asString(raw.subdomein ?? raw.domain ?? raw.component),
    titel: hasLinkedMinimum ? asString(raw.titel ?? raw.text ?? raw.title) : "",
    toelichting: hasLinkedMinimum ? asString(raw.toelichting ?? raw.description) : "",
    leerjaarRoute: "",
    gelinktMinimumdoel: minimum,
    netwerk: network,
    bronUrl: asString(raw.bron_url ?? raw.sourceUrl ?? raw.source_url),
    verrijking: "corpus",
  };

  return normalizeAhovoksMinimumGoalResult(candidate);
}

function candidateHaystack(record: CurriculumSearchResult): string {
  return [
    record.gelinktMinimumdoel?.tekst,
    record.gelinktMinimumdoel?.code,
    record.titel,
    record.discipline,
    record.subdomein,
    record.leerjaarRoute,
    record.toelichting,
  ]
    .filter(Boolean)
    .join(" ");
}

function scoreMinimumGoalCandidate(
  query: string,
  record: CurriculumSearchResult,
): { score: number; tokenMatches: number } {
  const queryTokens = tokenizeMinimumGoalQuery(query);
  const haystack = candidateHaystack(record);
  const minimumText = record.gelinktMinimumdoel?.tekst ?? "";
  const tokenMatches = countMinimumGoalTokenMatches(haystack, queryTokens);

  const minimumScore = scoreMinimumGoalOverlap(minimumText, queryTokens);
  const leerplanScore = scoreMinimumGoalOverlap(record.titel, queryTokens);
  const contextScore = scoreMinimumGoalOverlap(haystack, queryTokens);

  let score = Math.min(
    1,
    minimumScore * 0.5 + leerplanScore * 0.35 + contextScore * 0.15,
  );

  const queryLower = query.toLocaleLowerCase("nl-BE");
  const haystackLower = haystack.toLocaleLowerCase("nl-BE");

  if (queryLower.includes("optell") && haystackLower.includes("optell")) {
    score += 0.12;
  }
  if (queryLower.includes("aftrek") && haystackLower.includes("aftrek")) {
    score += 0.12;
  }
  if (queryLower.includes("vermenigvuld") && haystackLower.includes("vermenigvuld")) {
    score += 0.12;
  }
  if (queryLower.includes("deel") && haystackLower.includes("deel")) {
    score += 0.08;
  }

  return { score: Math.min(1, score), tokenMatches };
}

export function collectMinimumGoalCandidates({
  query,
  limit = MINIMUM_GOAL_CANDIDATE_LIMIT,
}: {
  query: string;
  limit?: number;
}): Array<CurriculumSearchResult & { score: number }> {
  const queryTokens = tokenizeMinimumGoalQuery(query);
  if (queryTokens.size === 0) {
    return [];
  }

  const candidates: Array<{
    record: CurriculumSearchResult;
    score: number;
    tokenMatches: number;
  }> = [];

  for (const raw of recordsForNetwork("ALL")) {
    const network = networkFromRaw(raw);
    if (
      !network ||
      !MINIMUM_GOAL_CORPUS_NETWORKS.includes(
        network as (typeof MINIMUM_GOAL_CORPUS_NETWORKS)[number],
      )
    ) {
      continue;
    }

    const record = normalizeMinimumGoalCandidate(raw);
    if (!record) {
      continue;
    }

    const { score, tokenMatches } = scoreMinimumGoalCandidate(query, record);
    if (
      tokenMatches < MIN_CANDIDATE_TOKEN_MATCHES &&
      score < MIN_CANDIDATE_SCORE
    ) {
      continue;
    }

    candidates.push({ record, score, tokenMatches });
  }

  return candidates
    .sort(
      (left, right) =>
        right.score - left.score || right.tokenMatches - left.tokenMatches,
    )
    .slice(0, limit)
    .map((entry) => ({ ...entry.record, score: entry.score }));
}

export function sanitizeMinimumGoalForResponse<
  T extends CurriculumSearchResult & { score?: number },
>(result: T): T {
  const normalized = normalizeAhovoksMinimumGoalResult(result);
  if (!normalized) {
    return result;
  }

  return {
    ...normalized,
    score: result.score,
    titel: "",
    code: "",
    toelichting: "",
    snippet: undefined,
    sourceUri: undefined,
    bronTitel: undefined,
  } as T;
}

export function mergeMinimumGoalCandidatePools(
  pools: Array<Array<CurriculumSearchResult & { score?: number }>>,
  limit = MINIMUM_GOAL_CANDIDATE_LIMIT,
): Array<CurriculumSearchResult & { score?: number }> {
  const combined = pools.flat();
  return dedupeByMinimumGoalCode(
    combined.sort((left, right) => (right.score ?? 0) - (left.score ?? 0)),
    limit,
  );
}
