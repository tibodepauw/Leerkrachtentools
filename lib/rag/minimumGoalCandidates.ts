import type {
  CurriculumNetworkFilter,
  CurriculumSearchResult,
  EducationLevelFilter,
} from "@/types";
import {
  isAhovoksMinimumGoalCode,
  normalizeAhovoksMinimumGoalResult,
} from "@/lib/rag/ahovoksMinimumGoals";
import {
  allMinimumGoalRecords,
  dedupeByMinimumGoalCode,
  filterByAbsoluteMinScore,
  resolveCorpusLevel,
} from "@/lib/rag/curriculumCorpus";
import {
  registerCorpusLevelUnloadListener,
  type CorpusLevel,
} from "@/lib/rag/corpusLevelCache";
import { decodeHtmlEntities } from "@/lib/rag/curriculumDisplay";
import {
  extractContentTokens,
  extractIndexTokens,
  normalizeQueryText,
  scoreClimateMinimumGoalBonus,
  tokenizeCurriculumQuery,
} from "@/lib/rag/curriculumQueryTokens";
import { formatSecondaryRouteLabel } from "@/lib/lesson/secondaryFilters";
import { recordMatchesEducationLevel } from "@/lib/rag/educationLevel";

type RawRecord = Record<string, unknown>;

export const MINIMUM_GOAL_CANDIDATE_LIMIT = 50;
export const MINIMUM_GOAL_OR_CANDIDATE_POOL = 30;

const MINIMUM_GOAL_CORPUS_NETWORKS: Array<
  "OPSTAP" | "VLAANDEREN"
> = ["OPSTAP", "VLAANDEREN"];

const MIN_CANDIDATE_TOKEN_MATCHES = 1;
const MIN_CANDIDATE_SCORE = 0.12;

const QUERY_STEM_HINTS: Array<{ pattern: RegExp; stem: string }> = [
  { pattern: /optell|opptell/i, stem: "optell" },
  { pattern: /aftrek/i, stem: "aftrek" },
  { pattern: /vermenigvuld|vermeningvuld/i, stem: "vermenigvuld" },
  { pattern: /deel/i, stem: "deel" },
  { pattern: /tellen/i, stem: "tel" },
  { pattern: /breuk/i, stem: "breuk" },
  { pattern: /komma/i, stem: "komma" },
];

type IndexedMinimumGoalRecord = {
  raw: RawRecord;
  haystack: string;
};

type MinimumGoalTokenIndex = {
  records: IndexedMinimumGoalRecord[];
  tokenToRecordIndices: Map<string, number[]>;
};

type MinimumGoalIndexKey = CorpusLevel | "ALL";

const minimumGoalIndexCache = new Map<MinimumGoalIndexKey, MinimumGoalTokenIndex>();

registerCorpusLevelUnloadListener((level) => {
  minimumGoalIndexCache.delete(level);
  minimumGoalIndexCache.delete("ALL");
});

function isSecondaryMinimumGoalRaw(raw: RawRecord): boolean {
  if (isDomainCorpusRecord(raw)) {
    return true;
  }
  return asString(raw.onderwijsniveau)
    .toLocaleLowerCase("nl-BE")
    .includes("secundair");
}

function expandLookupTokens(tokens: Iterable<string>): Set<string> {
  const expanded = new Set<string>();
  for (const token of tokens) {
    expanded.add(token);
    if (token.length >= 5) {
      expanded.add(token.slice(0, 5));
    }
    if (token.length >= 4) {
      expanded.add(token.slice(0, 4));
    }
  }
  return expanded;
}

function minimumGoalHaystackFromRaw(raw: RawRecord): string {
  const leerlijnSteps: string[] = [];
  if (Array.isArray(raw.leerlijn)) {
    for (const entry of raw.leerlijn) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const steps = (entry as Record<string, unknown>).ontwikkelstappen;
      if (!Array.isArray(steps)) {
        continue;
      }
      for (const step of steps) {
        if (typeof step === "string" && step.trim()) {
          leerlijnSteps.push(step.trim());
        }
      }
    }
  }

  const linked = raw.gelinkt_minimumdoel;
  const linkedFields: string[] = [];
  if (linked && typeof linked === "object") {
    const record = linked as Record<string, unknown>;
    linkedFields.push(
      typeof record.code === "string" ? record.code : "",
      typeof record.tekst === "string" ? record.tekst : "",
      typeof record.text === "string" ? record.text : "",
      typeof record.type === "string" ? record.type : "",
    );
  }

  return [
    raw.code,
    raw.titel,
    raw.text,
    raw.discipline,
    raw.leergebied,
    raw.ontwikkelveld,
    raw.subdomein,
    raw.toelichting,
    raw.sleutelcompetentie,
    raw.sleutelcompetentie_nr,
    raw.leerjaar_route,
    raw.graad,
    raw.finaliteit,
    ...linkedFields,
    ...leerlijnSteps,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildMinimumGoalIndexTokens(haystack: string): Set<string> {
  return expandLookupTokens(extractIndexTokens(haystack));
}

function buildMinimumGoalQueryTokens(query: string): Set<string> {
  const tokens = new Set<string>();
  for (const token of tokenizeMinimumGoalQuery(query)) {
    tokens.add(token);
  }
  for (const token of tokenizeCurriculumQuery(query)) {
    tokens.add(token);
  }
  for (const token of extractIndexTokens(normalizeQueryText(query))) {
    tokens.add(token);
  }
  return expandLookupTokens(tokens);
}

function extractCoreKeywordsForOrRetrieval(query: string): Set<string> {
  const keywords = new Set<string>();
  for (const token of extractContentTokens(query)) {
    if (token.length >= 4 || /\d/u.test(token) || token === "co2") {
      keywords.add(token);
    }
  }
  return keywords;
}

function addCandidateIndicesForTokens(
  tokens: Iterable<string>,
  index: MinimumGoalTokenIndex,
  candidates: Set<number>,
): void {
  for (const token of tokens) {
    const indices = index.tokenToRecordIndices.get(token);
    if (!indices) {
      continue;
    }
    for (const recordIndex of indices) {
      candidates.add(recordIndex);
    }
  }
}

function isIndexedMinimumGoalRaw(raw: RawRecord): boolean {
  const network = networkFromRaw(raw);
  return (
    network !== null &&
    MINIMUM_GOAL_CORPUS_NETWORKS.includes(
      network as (typeof MINIMUM_GOAL_CORPUS_NETWORKS)[number],
    )
  );
}

function minimumGoalIndexKey(
  educationLevel: EducationLevelFilter,
): MinimumGoalIndexKey {
  return educationLevel === "ALL"
    ? "ALL"
    : resolveCorpusLevel(educationLevel);
}

function getMinimumGoalTokenIndex(
  educationLevel: EducationLevelFilter = "ALL",
): MinimumGoalTokenIndex {
  const cacheKey = minimumGoalIndexKey(educationLevel);
  const cached = minimumGoalIndexCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const records: IndexedMinimumGoalRecord[] = [];
  const tokenToRecordIndices = new Map<string, number[]>();

  for (const raw of allMinimumGoalRecords(educationLevel)) {
    if (!isIndexedMinimumGoalRaw(raw)) {
      continue;
    }

    const index = records.length;
    const haystack = minimumGoalHaystackFromRaw(raw);
    records.push({ raw, haystack });

    for (const token of buildMinimumGoalIndexTokens(haystack)) {
      let indices = tokenToRecordIndices.get(token);
      if (!indices) {
        indices = [];
        tokenToRecordIndices.set(token, indices);
      }
      if (indices[indices.length - 1] !== index) {
        indices.push(index);
      }
    }
  }

  const built = { records, tokenToRecordIndices };
  minimumGoalIndexCache.set(cacheKey, built);
  return built;
}

export function warmMinimumGoalTokenIndex(
  educationLevel: EducationLevelFilter = "BASISONDERWIJS",
): void {
  getMinimumGoalTokenIndex(educationLevel);
}

export function rebuildMinimumGoalTokenIndex(
  educationLevel: EducationLevelFilter = "BASISONDERWIJS",
): void {
  minimumGoalIndexCache.delete(minimumGoalIndexKey(educationLevel));
  getMinimumGoalTokenIndex(educationLevel);
}

function candidateIndicesFromMinimumGoalQuery(
  query: string,
  index: MinimumGoalTokenIndex,
): Set<number> {
  const candidates = new Set<number>();
  const lookupTokens = buildMinimumGoalQueryTokens(query);
  addCandidateIndicesForTokens(lookupTokens, index, candidates);

  const coreKeywords = extractCoreKeywordsForOrRetrieval(query);
  if (coreKeywords.size >= 2) {
    for (const keyword of coreKeywords) {
      addCandidateIndicesForTokens(
        expandLookupTokens(new Set([keyword])),
        index,
        candidates,
      );
      addCandidateIndicesForTokens(
        buildMinimumGoalQueryTokens(keyword),
        index,
        candidates,
      );
    }
  }

  return candidates;
}

export function tokenizeMinimumGoalQuery(value: string): Set<string> {
  const normalized = normalizeQueryText(value);
  const tokens = new Set<string>();

  for (const word of normalized
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2)) {
    tokens.add(word);
  }

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
  const normalizedHaystack = normalizeQueryText(haystack);

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

function isDomainCorpusRecord(raw: RawRecord): boolean {
  const level = asString(raw.onderwijsniveau).toUpperCase();
  return (
    level === "SECUNDAIR" ||
    level === "BUBAO" ||
    level === "BUSO" ||
    level === "OKAN" ||
    level === "DKO" ||
    level === "VOLWASSENEN" ||
    level === "HOGER"
  );
}

function networkFromRaw(
  raw: RawRecord,
): CurriculumNetworkFilter | "VLAANDEREN" | null {
  const netwerk = asString(raw.netwerk ?? raw.network).toUpperCase();
  if (netwerk === "OPSTAP") return "OPSTAP";
  if (netwerk === "OVSG") return "OVSG";
  if (netwerk === "GO_NIEUW") return "GO_NIEUW";
  if (netwerk === "GO_OUD") return "GO_OUD";
  if (netwerk === "ZILL") return "ZILL";
  if (netwerk === "GO") return "GO";
  if (netwerk === "KOV") return "KOV";
  if (netwerk === "POV") return "POV";
  if (netwerk === "VLAANDEREN") return "VLAANDEREN";
  if (netwerk === "AHOVOKS") return "VLAANDEREN";
  if (!netwerk && isDomainCorpusRecord(raw) && asString(raw.code)) {
    return "VLAANDEREN";
  }
  return null;
}

function normalizeMinimumGoal(raw: RawRecord) {
  const linked = raw.gelinkt_minimumdoel;
  if (linked && typeof linked === "object") {
    const record = linked as Record<string, unknown>;
    const code = asString(record.code);
    const tekst = asString(record.tekst);
    const isSecondary =
      isSecondaryMinimumGoalRaw(raw) ||
      asString(raw.onderwijsniveau).toLocaleLowerCase("nl-BE") ===
        "secundair onderwijs";
    if (
      !code ||
      !tekst ||
      (!isSecondary && !isAhovoksMinimumGoalCode(code))
    ) {
      return null;
    }

    return {
      code,
      tekst,
      type: asString(record.type),
    };
  }

  if (!isSecondaryMinimumGoalRaw(raw)) {
    return null;
  }

  const code = asString(raw.code);
  const tekst = asString(raw.titel);
  if (!code || !tekst) {
    return null;
  }

  return {
    code,
    tekst,
    type: asString(raw.toelichting),
  };
}

export function normalizeMinimumGoalCandidate(
  raw: RawRecord,
): CurriculumSearchResult | null {
  const isSecondary = isSecondaryMinimumGoalRaw(raw);
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
    titel: hasLinkedMinimum && !isSecondary
      ? asString(raw.titel ?? raw.text ?? raw.title)
      : "",
    toelichting:
      hasLinkedMinimum && !isSecondary
        ? asString(raw.toelichting ?? raw.description)
        : "",
    leerjaarRoute:
      formatSecondaryRouteLabel(
        asString(raw.graad),
        asString(raw.finaliteit),
        asString(raw.leerjaar_route ?? raw.fase),
      ) || asString(raw.leerjaar_route ?? raw.graad),
    gelinktMinimumdoel: minimum,
    netwerk: network,
    bronUrl: asString(raw.bron_url ?? raw.sourceUrl ?? raw.source_url),
    verrijking: "corpus",
  };

  return isSecondary ? candidate : normalizeAhovoksMinimumGoalResult(candidate);
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
  raw?: RawRecord,
): { score: number; tokenMatches: number } {
  const allQueryTokens = tokenizeMinimumGoalQuery(query);
  const contentTokens = extractContentTokens(query);
  const scoringTokens =
    contentTokens.size >= 2 ? contentTokens : allQueryTokens;
  const haystack = candidateHaystack(record);
  const minimumText = record.gelinktMinimumdoel?.tekst ?? "";
  const tokenMatches = countMinimumGoalTokenMatches(haystack, scoringTokens);

  const minimumScore = scoreMinimumGoalOverlap(minimumText, scoringTokens);
  const leerplanScore = scoreMinimumGoalOverlap(record.titel, scoringTokens);
  const contextScore = scoreMinimumGoalOverlap(haystack, scoringTokens);

  let score = Math.min(
    1,
    minimumScore * 0.5 + leerplanScore * 0.35 + contextScore * 0.15,
  );

  score += scoreClimateMinimumGoalBonus(
    query,
    record.discipline,
    record.gelinktMinimumdoel?.code ?? "",
    raw ? asString(raw.sleutelcompetentie_nr) : "",
  );

  const queryLower = normalizeQueryText(query);
  const haystackLower = normalizeQueryText(haystack);

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

function minimumGoalRetrievalQuery(query: string): {
  scoringQuery: string;
  retrievalQuery: string;
} {
  const trimmed = query.trim();
  if (/^\d+\s*\+\s*\d+$/u.test(trimmed)) {
    return {
      scoringQuery: query,
      retrievalQuery: "optellen rekenen wiskunde getal",
    };
  }
  return { scoringQuery: query, retrievalQuery: query };
}

const MAX_MINIMUM_GOAL_INDICES_TO_SCORE = 180;

export function collectMinimumGoalCandidates({
  query,
  educationLevel = "ALL",
  limit = MINIMUM_GOAL_CANDIDATE_LIMIT,
}: {
  query: string;
  educationLevel?: EducationLevelFilter;
  limit?: number;
}): Array<CurriculumSearchResult & { score: number }> {
  const { scoringQuery, retrievalQuery } = minimumGoalRetrievalQuery(query);
  const queryTokens = tokenizeMinimumGoalQuery(scoringQuery);
  if (queryTokens.size === 0) {
    return [];
  }

  const coreKeywords = extractCoreKeywordsForOrRetrieval(retrievalQuery);
  const useOrRetrieval =
    coreKeywords.size >= 2 && !/^\d+\s*\+\s*\d+$/u.test(query.trim());
  const preFilterLimit = useOrRetrieval
    ? Math.max(limit, MINIMUM_GOAL_OR_CANDIDATE_POOL)
    : limit;

  const index = getMinimumGoalTokenIndex(educationLevel);
  const candidateIndices = candidateIndicesFromMinimumGoalQuery(
    retrievalQuery,
    index,
  );
  let indicesToScore: Set<number> = candidateIndices;
  if (indicesToScore.size === 0) {
    indicesToScore = new Set<number>();
    for (let recordIndex = 0; recordIndex < index.records.length; recordIndex += 1) {
      const haystack = index.records[recordIndex]?.haystack;
      if (!haystack) {
        continue;
      }
      for (const token of tokenizeMinimumGoalQuery(retrievalQuery)) {
        if (token.length >= 4 && haystack.includes(token)) {
          indicesToScore.add(recordIndex);
          break;
        }
      }
    }
  }
  if (indicesToScore.size === 0) {
    return [];
  }
  const maxIndicesToScore =
    useOrRetrieval || resolveCorpusLevel(educationLevel) === "SECUNDAIR"
      ? 320
      : MAX_MINIMUM_GOAL_INDICES_TO_SCORE;
  if (indicesToScore.size > maxIndicesToScore) {
    const ranked = [...indicesToScore]
      .map((recordIndex) => {
        const haystack = index.records[recordIndex]?.haystack ?? "";
        return {
          recordIndex,
          tokenMatches: countMinimumGoalTokenMatches(
            haystack,
            tokenizeMinimumGoalQuery(retrievalQuery),
          ),
        };
      })
      .sort(
        (left, right) =>
          right.tokenMatches - left.tokenMatches ||
          left.recordIndex - right.recordIndex,
      )
      .slice(0, maxIndicesToScore)
      .map((entry) => entry.recordIndex);
    indicesToScore = new Set(ranked);
  }

  const candidates: Array<{
    record: CurriculumSearchResult;
    score: number;
    tokenMatches: number;
  }> = [];

  for (const recordIndex of indicesToScore) {
    const indexed = index.records[recordIndex];
    if (!indexed) {
      continue;
    }
    const raw = indexed.raw;
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
    if (!record || !recordMatchesEducationLevel(raw, educationLevel)) {
      continue;
    }

    const { score, tokenMatches } = scoreMinimumGoalCandidate(
      scoringQuery,
      record,
      raw,
    );
    if (
      tokenMatches < MIN_CANDIDATE_TOKEN_MATCHES &&
      score < MIN_CANDIDATE_SCORE
    ) {
      continue;
    }

    candidates.push({ record, score, tokenMatches });
  }

  return filterByAbsoluteMinScore(
    candidates
      .sort(
        (left, right) =>
          right.score - left.score || right.tokenMatches - left.tokenMatches,
      )
      .slice(0, preFilterLimit)
      .slice(0, limit)
      .map((entry) => ({ ...entry.record, score: entry.score })),
  );
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
