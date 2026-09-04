import type {
  CurriculumNetworkFilter,
  CurriculumSearchResult,
  EducationLevelFilter,
  LinkedMinimumGoal,
} from "@/types";
import type { DiscoveryHit } from "@/lib/rag/discoveryEngine";
import { titleFromLink } from "@/lib/rag/discoveryEngine";
import { sanitizeCurriculumText } from "@/lib/rag/curriculumDisplay";
import {
  countCurriculumTokenMatches,
  extractIndexTokens,
  isZillMathThinkingCode,
  isZillMediaCode,
  isZillMotorCode,
  isZillTechCode,
  normalizeQueryText,
  scoreCurriculumCandidate,
  tokenizeCurriculumQuery,
} from "@/lib/rag/curriculumQueryTokens";
import {
  DOMAIN_CORPUS_PATHS,
  getCorpusForEducationLevel,
  getCorpusForLevel as getCorpusRecordsForLevel,
  registerCorpusLevelUnloadListener,
  resolveCorpusLevel,
  type CorpusLevel,
  SECONDARY_CURRICULUM_PROD,
  SECONDARY_POV_CURRICULUM_PROD,
  OPSTAP_CORPUS_PROD,
  OVSG_CORPUS_PROD,
  GO_NIEUW_CORPUS_PROD,
  GO_OUD_CORPUS_PROD,
  ZILL_CORPUS_PROD,
} from "@/lib/rag/corpusLevelCache";
import { recordMatchesEducationLevel } from "@/lib/rag/educationLevel";
import { DIDACTIC_STOPWORDS } from "@/lib/rag/didacticStopwords";
import { isFuzzySimilar } from "@/lib/rag/fuzzyMatch";
import { formatSecondaryRouteLabel } from "@/lib/lesson/secondaryFilters";

type RawRecord = Record<string, unknown>;

export {
  getCorpusForEducationLevel,
  resolveCorpusLevel,
  secondaryMinimumGoalRecords,
  type CorpusLevel,
} from "@/lib/rag/corpusLevelCache";

export function getCorpusForLevel(
  level: EducationLevelFilter,
): RawRecord[] {
  return getCorpusForEducationLevel(level);
}

const MIN_CORPUS_MATCH_SCORE = 0.32;
const MIN_LOCAL_SEARCH_SCORE = 0.1;
const MIN_RELAXED_SEARCH_SCORE = 0.06;
const MIN_TOKEN_MATCHES = 2;
const MIN_LOCAL_TOKEN_MATCHES = 1;
export const ABSOLUTE_MIN_SCORE = 0.18;
export const CURRICULUM_CANDIDATE_LIMIT = 50;
export const CURRICULUM_TOP_N = 5;
const MAX_CORPUS_INDICES_TO_SCORE = 96;

const GO_LEGEND_META_PATTERNS = [
  /links in de eerste rij van elk leerplandoel staat het go!?-volgnummer/i,
  /het gaat hier over een doel basisvorming/i,
  /bg:\s*basisgeletterdheid/i,
];

type IndexedCorpusRecord = {
  raw: RawRecord;
  haystack: string;
  record: CurriculumSearchResult | null;
};

type CorpusTokenIndex = {
  records: IndexedCorpusRecord[];
  tokenToRecordIndices: Map<string, number[]>;
};

const corpusIndexCache = new Map<string, CorpusTokenIndex>();

function corpusIndexKey(
  network: CurriculumNetworkFilter,
  educationLevel: EducationLevelFilter,
): string {
  if (educationLevel === "ALL") {
    return `ALL:${network}`;
  }
  return `${resolveCorpusLevel(educationLevel, network)}:${network}`;
}

registerCorpusLevelUnloadListener((level) => {
  for (const key of [...corpusIndexCache.keys()]) {
    if (key.startsWith(`${level}:`) || key.startsWith("ALL:")) {
      corpusIndexCache.delete(key);
    }
  }
});

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

function buildRecordIndexTokens(haystack: string): Set<string> {
  return expandLookupTokens(extractIndexTokens(haystack));
}

function buildQueryLookupTokens(query: string): Set<string> {
  const tokens = new Set<string>();
  for (const token of tokenizeCurriculumQuery(query)) {
    tokens.add(token);
  }
  for (const token of extractIndexTokens(normalizeQueryText(query))) {
    tokens.add(token);
  }
  return expandLookupTokens(tokens);
}

function getCorpusTokenIndex(
  network: CurriculumNetworkFilter,
  educationLevel: EducationLevelFilter = "ALL",
): CorpusTokenIndex {
  const cacheKey = corpusIndexKey(network, educationLevel);
  const cached = corpusIndexCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const records: IndexedCorpusRecord[] = [];
  const tokenToRecordIndices = new Map<string, number[]>();

  for (const raw of recordsForNetwork(network, educationLevel)) {
    const index = records.length;
    const haystack = buildRecordHaystack(raw);
    records.push({
      raw,
      haystack,
      record: normalizeRecord(raw, networkFromRaw(raw)),
    });

    for (const token of buildRecordIndexTokens(haystack)) {
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
  corpusIndexCache.set(cacheKey, built);
  return built;
}

function expandFuzzyIndexTokens(
  tokens: Set<string>,
  tokenToRecordIndices: Map<string, number[]>,
): Set<string> {
  const extra = new Set<string>();
  const byPrefix = new Map<string, string[]>();
  for (const key of tokenToRecordIndices.keys()) {
    if (key.length < 4) continue;
    const prefix = key.slice(0, 3);
    const list = byPrefix.get(prefix);
    if (list) {
      list.push(key);
    } else {
      byPrefix.set(prefix, [key]);
    }
  }

  for (const token of tokens) {
    if (token.length < 4 || DIDACTIC_STOPWORDS.has(token)) continue;
    for (const key of byPrefix.get(token.slice(0, 3)) ?? []) {
      if (isFuzzySimilar(token, key, 0.78)) {
        extra.add(key);
      }
    }
  }
  return extra;
}

function candidateIndicesFromQuery(
  query: string,
  index: CorpusTokenIndex,
): Set<number> {
  let lookupTokens = buildQueryLookupTokens(query);
  let candidates = new Set<number>();

  for (const token of lookupTokens) {
    const indices = index.tokenToRecordIndices.get(token);
    if (!indices) {
      continue;
    }
    for (const recordIndex of indices) {
      candidates.add(recordIndex);
    }
  }

  if (candidates.size === 0) {
    lookupTokens = new Set([
      ...lookupTokens,
      ...expandFuzzyIndexTokens(lookupTokens, index.tokenToRecordIndices),
    ]);
    for (const token of lookupTokens) {
      const indices = index.tokenToRecordIndices.get(token);
      if (!indices) continue;
      for (const recordIndex of indices) {
        candidates.add(recordIndex);
      }
    }
  } else {
    const unmatched = new Set<string>();
    for (const token of lookupTokens) {
      if (
        token.length >= 4 &&
        !DIDACTIC_STOPWORDS.has(token) &&
        !index.tokenToRecordIndices.has(token)
      ) {
        unmatched.add(token);
      }
    }
    if (unmatched.size > 0) {
      for (const token of expandFuzzyIndexTokens(
        unmatched,
        index.tokenToRecordIndices,
      )) {
        const indices = index.tokenToRecordIndices.get(token);
        if (!indices) continue;
        for (const recordIndex of indices) {
          candidates.add(recordIndex);
        }
      }
    }
  }

  return candidates;
}

export function warmCorpusTokenIndex(
  network: CurriculumNetworkFilter = "ALL",
  educationLevel: EducationLevelFilter = "ALL",
): void {
  getCorpusTokenIndex(network, educationLevel);
}

export function filterByAbsoluteMinScore<T extends { score: number }>(
  results: T[],
): T[] {
  if (results.length === 0) {
    return [];
  }
  if (results[0]!.score < ABSOLUTE_MIN_SCORE) {
    return [];
  }
  return results;
}

const ALL_SEARCH_LEVELS: EducationLevelFilter[] = [
  "BASISONDERWIJS",
  "SECUNDAIR",
  "BUBAO",
  "BUSO",
  "OKAN",
  "DKO",
  "VOLWASSENEN",
  "HOGER",
];

export function recordsForNetwork(
  network: CurriculumNetworkFilter,
  educationLevel: EducationLevelFilter = "ALL",
): RawRecord[] {
  if (educationLevel === "ALL") {
    return ALL_SEARCH_LEVELS.flatMap((level) =>
      recordsForNetwork(network, level),
    );
  }

  const corpusLevel = resolveCorpusLevel(educationLevel, network);

  if (corpusLevel === "BASISONDERWIJS") {
    if (network === "ALL") {
      return (
        ["OPSTAP", "OVSG", "GO_NIEUW", "GO_OUD", "ZILL"] as Array<
          Exclude<CurriculumNetworkFilter, "ALL">
        >
      ).flatMap((key) => loadBasisonderwijsNetworkRecords(key));
    }
    return loadBasisonderwijsNetworkRecords(network);
  }

  if (corpusLevel === "SECUNDAIR") {
    const secundairRecords = sanitizeCorpusRecords(
      getCorpusRecordsForLevel("SECUNDAIR").filter(
        (raw) => !isStandaloneSecundairMinimumGoal(raw),
      ),
    );
    if (network === "ALL") {
      return secundairRecords.map((raw) => ({
        ...raw,
        netwerk: asString(raw.netwerk ?? raw.network) || "GO",
      }));
    }
    return secundairRecords
      .filter((raw) => recordMatchesNetwork(raw, network))
      .map((raw) => ({
        ...raw,
        netwerk: asString(raw.netwerk ?? raw.network) || network,
      }));
  }

  const domainRecords = getCorpusRecordsForLevel(corpusLevel);
  if (network === "ALL") {
    return domainRecords;
  }
  return domainRecords.filter((raw) => recordMatchesNetwork(raw, network));
}

export function isStandaloneSecundairMinimumGoal(raw: RawRecord): boolean {
  if (raw.gelinkt_minimumdoel || raw.leerlijn || raw.inhouden) {
    return false;
  }
  const niveau = asString(raw.onderwijsniveau).toLocaleLowerCase("nl-BE");
  const isSecundair =
    niveau === "secundair" || niveau.includes("secundair");
  if (!isSecundair) {
    return false;
  }
  return !asString(raw.netwerk ?? raw.network);
}

export function educationDomainRecords(
  level: EducationLevelFilter = "ALL",
): RawRecord[] {
  if (level === "ALL") {
    return (
      Object.keys(DOMAIN_CORPUS_PATHS) as Array<
        Exclude<CorpusLevel, "BASISONDERWIJS" | "SECUNDAIR">
      >
    ).flatMap((domainLevel) => getCorpusRecordsForLevel(domainLevel));
  }

  const corpusLevel = resolveCorpusLevel(level);
  if (corpusLevel === "BASISONDERWIJS" || corpusLevel === "SECUNDAIR") {
    return [];
  }
  return getCorpusRecordsForLevel(corpusLevel);
}

export function allMinimumGoalRecords(
  educationLevel: EducationLevelFilter = "ALL",
): RawRecord[] {
  if (educationLevel === "ALL") {
    return ALL_SEARCH_LEVELS.flatMap((level) =>
      allMinimumGoalRecords(level),
    );
  }
  const corpusLevel = resolveCorpusLevel(educationLevel);
  if (corpusLevel === "BASISONDERWIJS") {
    return recordsForNetwork("OPSTAP", educationLevel);
  }
  if (corpusLevel === "SECUNDAIR") {
    return getCorpusRecordsForLevel("SECUNDAIR");
  }
  return getCorpusRecordsForLevel(corpusLevel);
}

function loadBasisonderwijsNetworkRecords(
  network: Exclude<CurriculumNetworkFilter, "ALL">,
): RawRecord[] {
  getCorpusRecordsForLevel("BASISONDERWIJS");
  const primaryRecords =
    network === "OPSTAP"
      ? recordsFromBasisonderwijsNetwork("OPSTAP")
      : network === "OVSG"
        ? recordsFromBasisonderwijsNetwork("OVSG")
        : network === "GO_NIEUW"
          ? recordsFromBasisonderwijsNetwork("GO_NIEUW")
          : network === "GO_OUD"
            ? recordsFromBasisonderwijsNetwork("GO_OUD")
          : network === "ZILL"
            ? recordsFromBasisonderwijsNetwork("ZILL")
            : [];
  const records = sanitizeCorpusRecords(primaryRecords);

  return records.map((raw) => ({
    ...raw,
    netwerk: asString(raw.netwerk ?? raw.network) || network,
  }));
}

function recordsFromBasisonderwijsNetwork(
  network: "OPSTAP" | "OVSG" | "GO_NIEUW" | "GO_OUD" | "ZILL",
): RawRecord[] {
  return getCorpusRecordsForLevel("BASISONDERWIJS").filter((raw) => {
    const netwerk = asString(raw.netwerk ?? raw.network).toUpperCase();
    if (netwerk) {
      return netwerk === network;
    }
    return networkFromRaw(raw) === network;
  });
}

function asString(value: unknown): string {
  return typeof value === "string" ? sanitizeCurriculumText(value.trim()) : "";
}

export function isStructuredResult(
  result: CurriculumSearchResult,
): boolean {
  return result.verrijking === "corpus";
}

export function sanitizeStructuredResult(
  result: CurriculumSearchResult & { score?: number },
): CurriculumSearchResult & { score?: number } {
  const { snippet, sourceUri, bronTitel, ...rest } = result;
  void snippet;
  void sourceUri;
  void bronTitel;
  return rest;
}

function normalizeMinimumGoal(value: unknown): LinkedMinimumGoal | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const code = asString(record.code);
  const tekst = asString(record.tekst);
  const type = asString(record.type);
  if (!code && !tekst) {
    return null;
  }
  return { code, tekst, type };
}

function networkFromRaw(raw: RawRecord): CurriculumNetworkFilter | null {
  const netwerk = asString(raw.netwerk ?? raw.network).toUpperCase();
  if (netwerk === "OPSTAP") return "OPSTAP";
  if (netwerk === "OVSG") return "OVSG";
  if (netwerk === "GO_NIEUW") return "GO_NIEUW";
  if (netwerk === "GO_OUD") return "GO_OUD";
  if (netwerk === "ZILL") return "ZILL";
  if (netwerk === "GO") return "GO";
  if (netwerk === "KOV") return "KOV";
  if (netwerk === "POV") return "POV";
  return null;
}

function recordMatchesNetwork(
  raw: RawRecord,
  network: CurriculumNetworkFilter,
): boolean {
  if (network === "ALL") {
    return true;
  }
  return networkFromRaw(raw) === network;
}

function collectNestedStrings(value: unknown, parts: string[]): void {
  if (typeof value === "string") {
    parts.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectNestedStrings(item, parts);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectNestedStrings(nested, parts);
    }
  }
}

function extractLeerlijnSteps(leerlijn: unknown): string[] {
  if (!Array.isArray(leerlijn)) {
    return [];
  }

  const steps: string[] = [];
  for (const entry of leerlijn) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const ontwikkelstappen = (entry as Record<string, unknown>).ontwikkelstappen;
    if (!Array.isArray(ontwikkelstappen)) {
      continue;
    }
    for (const step of ontwikkelstappen) {
      if (typeof step === "string" && step.trim()) {
        steps.push(step.trim());
      }
    }
  }
  return steps;
}

function extractInhoudenText(inhouden: unknown): string[] {
  const parts: string[] = [];
  collectNestedStrings(inhouden, parts);
  return parts;
}

export function buildRecordHaystack(raw: RawRecord): string {
  const leerlijnSteps = extractLeerlijnSteps(raw.leerlijn);
  const inhoudenParts = extractInhoudenText(raw.inhouden);

  return [
    raw.code,
    raw.titel,
    raw.text,
    raw.discipline,
    raw.leergebied,
    raw.ontwikkelveld,
    raw.subdomein,
    raw.toelichting,
    ...leerlijnSteps,
    ...inhoudenParts,
  ]
    .filter(Boolean)
    .join(" ");
}

export function isGoLegendOrMetaRecord(raw: RawRecord): boolean {
  const network = asString(raw.netwerk ?? raw.network).toUpperCase();
  if (network !== "GO" && network !== "GO_NIEUW" && network !== "GO_OUD") {
    return false;
  }

  const haystack = buildRecordHaystack(raw);
  return GO_LEGEND_META_PATTERNS.some((pattern) => pattern.test(haystack));
}

function sanitizeCorpusRecords(records: RawRecord[]): RawRecord[] {
  return records.filter((raw) => !isGoLegendOrMetaRecord(raw));
}

function normalizeDiscipline(
  code: string,
  discipline: string,
  subdomein: string,
): string {
  const normalized = discipline.toLocaleLowerCase("nl-BE");
  if (
    isZillMathThinkingCode(code) ||
    normalized.includes("wiskundig denken")
  ) {
    return subdomein ? `Wiskunde · ${subdomein}` : "Wiskunde";
  }
  if (
    isZillTechCode(code) ||
    normalized.includes("technische systemen")
  ) {
    return subdomein
      ? `Wetenschap en techniek · ${subdomein}`
      : "Wetenschap en techniek";
  }
  if (
    isZillMotorCode(code) ||
    normalized.includes("motorische en zintuiglijke")
  ) {
    return subdomein
      ? `Lichamelijke opvoeding · ${subdomein}`
      : "Lichamelijke opvoeding";
  }
  if (isZillMediaCode(code) || normalized.includes("mediakundige")) {
    return subdomein ? `ICT · ${subdomein}` : "ICT";
  }
  return discipline;
}

function normalizeRecord(
  raw: RawRecord,
  network: CurriculumNetworkFilter | null,
): CurriculumSearchResult | null {
  const code = asString(raw.code);
  const titel = asString(raw.titel ?? raw.text ?? raw.title);
  if (!titel) {
    return null;
  }

  const subdomein = asString(raw.subdomein ?? raw.domain ?? raw.subject);
  const discipline = normalizeDiscipline(
    code,
    asString(raw.discipline ?? raw.leergebied ?? raw.ontwikkelveld),
    subdomein,
  );
  const toelichting = asString(raw.toelichting ?? raw.description);
  const leerjaren = raw.leerjaren;
  const leerjaarRoute =
    formatSecondaryRouteLabel(
      asString(raw.graad),
      asString(raw.finaliteit),
      asString(
        raw.leerjaar_route ??
          raw.fase ??
          (Array.isArray(leerjaren)
            ? leerjaren.map((item) => String(item)).join(", ")
            : ""),
      ),
    ) ||
    asString(
      raw.leerjaar_route ??
        raw.fase ??
        raw.graad ??
        (Array.isArray(leerjaren)
          ? leerjaren.map((item) => String(item)).join(", ")
          : ""),
    );
  const netwerk = asString(raw.netwerk ?? raw.network) || network || "ALL";
  const bronUrl = asString(raw.bron_url ?? raw.sourceUrl ?? raw.source_url);

  return {
    code,
    discipline,
    subdomein,
    titel,
    toelichting,
    leerjaarRoute,
    gelinktMinimumdoel: normalizeMinimumGoal(raw.gelinkt_minimumdoel),
    netwerk,
    bronUrl,
    verrijking: "corpus",
  };
}

export function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase("nl-BE")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !DIDACTIC_STOPWORDS.has(token)),
  );
}

export function countTokenMatches(haystack: string, tokens: Set<string>): number {
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

export function scoreTextOverlap(haystack: string, tokens: Set<string>): number {
  if (tokens.size === 0) {
    return 0;
  }
  return countTokenMatches(haystack, tokens) / tokens.size;
}

function blendScore(discoveryScore: number, corpusScore: number): number {
  return Math.max(0, Math.min(1, discoveryScore * 0.55 + corpusScore * 0.45));
}

export function findCorpusRecordByCode(
  code: string,
  network: CurriculumNetworkFilter,
  educationLevel: EducationLevelFilter = "ALL",
): CurriculumSearchResult | null {
  const needle = code.trim();
  if (!needle) {
    return null;
  }
  for (const raw of recordsForNetwork(network, educationLevel)) {
    if (
      !recordMatchesNetwork(raw, network) ||
      !recordMatchesEducationLevel(raw, educationLevel)
    ) {
      continue;
    }
    if (asString(raw.code) === needle) {
      return normalizeRecord(raw, networkFromRaw(raw));
    }
  }
  return null;
}

export function findBestCorpusMatch({
  snippet,
  query,
  title,
  network,
  educationLevel = "ALL",
  relaxed = false,
}: {
  snippet: string;
  query: string;
  title?: string;
  network: CurriculumNetworkFilter;
  educationLevel?: EducationLevelFilter;
  relaxed?: boolean;
}): (CurriculumSearchResult & { score: number }) | null {
  const queryTokens = tokenizeCurriculumQuery(query);
  const tokens = new Set([
    ...queryTokens,
    ...tokenizeCurriculumQuery(snippet),
    ...tokenizeCurriculumQuery(title ?? ""),
  ]);
  if (tokens.size === 0) {
    return null;
  }

  const minScore = relaxed ? MIN_RELAXED_SEARCH_SCORE : MIN_LOCAL_SEARCH_SCORE;

  let best:
    | {
        record: CurriculumSearchResult;
        score: number;
        tokenMatches: number;
      }
    | null = null;

  const index = getCorpusTokenIndex(network, educationLevel);
  const candidateIndices = candidateIndicesFromQuery(query, index);
  const indicesToScore =
    candidateIndices.size > 0
      ? candidateIndices
      : new Set(index.records.map((_, recordIndex) => recordIndex));

  for (const recordIndex of indicesToScore) {
    const indexed = index.records[recordIndex];
    if (!indexed) {
      continue;
    }
    const raw = indexed.raw;
    if (
      network === "ALL" &&
      (!recordMatchesNetwork(raw, network) ||
        !recordMatchesEducationLevel(raw, educationLevel))
    ) {
      continue;
    }
    if (
      network !== "ALL" &&
      !recordMatchesEducationLevel(raw, educationLevel)
    ) {
      continue;
    }
    const record = indexed.record;
    if (!record) {
      continue;
    }

    const haystack = indexed.haystack;
    const tokenMatches = countCurriculumTokenMatches(haystack, tokens, query);
    const queryTokenMatches = countCurriculumTokenMatches(
      haystack,
      queryTokens,
      query,
    );
    if (
      queryTokenMatches < 1 &&
      (!relaxed || tokenMatches < MIN_LOCAL_TOKEN_MATCHES)
    ) {
      continue;
    }

    const scored = scoreCurriculumCandidate({
      query,
      haystack,
      discipline: record.discipline,
      titel: record.titel,
      code: record.code,
      subdomein: record.subdomein,
    });
    let score = Math.max(scored.score, scoreTextOverlap(haystack, tokens));
    const titel = record.titel.toLocaleLowerCase("nl-BE");
    const snippetLower = snippet.toLocaleLowerCase("nl-BE");
    if (
      titel.length > 12 &&
      snippetLower.includes(titel.slice(0, Math.min(48, titel.length)))
    ) {
      score += 0.25;
    }
    if (asString(raw.code) && snippet.includes(asString(raw.code))) {
      score += 0.2;
    }

    score = Math.min(1, score);
    if (
      !best ||
      score > best.score ||
      (score === best.score && tokenMatches > best.tokenMatches)
    ) {
      best = { record, score, tokenMatches };
    }
  }

  if (!best || best.score < minScore) {
    return null;
  }

  if (best.score < ABSOLUTE_MIN_SCORE) {
    return null;
  }

  return { ...best.record, score: best.score };
}

export function searchLocalCorpus({
  query,
  network,
  educationLevel = "ALL",
  limit = CURRICULUM_TOP_N,
  candidateLimit = CURRICULUM_CANDIDATE_LIMIT,
}: {
  query: string;
  network?: CurriculumNetworkFilter;
  educationLevel?: EducationLevelFilter;
  limit?: number;
  candidateLimit?: number;
}): Array<CurriculumSearchResult & { score: number }> {
  const scopedNetwork = network ?? "ALL";
  const queryTokens = tokenizeCurriculumQuery(query);
  if (queryTokens.size === 0) {
    return [];
  }

  const index = getCorpusTokenIndex(scopedNetwork, educationLevel);
  const candidateIndices = candidateIndicesFromQuery(query, index);
  let indicesToScore: Set<number> = candidateIndices;
  if (indicesToScore.size === 0) {
    return [];
  }
  const maxCorpusIndices =
    queryTokens.size >= 4 ? 140 : MAX_CORPUS_INDICES_TO_SCORE;
  if (indicesToScore.size > maxCorpusIndices) {
    const ranked = [...indicesToScore]
      .map((recordIndex) => {
        const haystack = index.records[recordIndex]?.haystack ?? "";
        return {
          recordIndex,
          tokenMatches: countCurriculumTokenMatches(
            haystack,
            queryTokens,
            query,
          ),
        };
      })
      .sort(
        (left, right) =>
          right.tokenMatches - left.tokenMatches ||
          left.recordIndex - right.recordIndex,
      )
      .slice(0, maxCorpusIndices)
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
    if (
      scopedNetwork === "ALL" &&
      (!recordMatchesNetwork(raw, scopedNetwork) ||
        !recordMatchesEducationLevel(raw, educationLevel))
    ) {
      continue;
    }
    if (
      scopedNetwork !== "ALL" &&
      !recordMatchesEducationLevel(raw, educationLevel)
    ) {
      continue;
    }
    const record = indexed.record;
    if (!record) {
      continue;
    }

    const haystack = indexed.haystack;
    const { score, tokenMatches } = scoreCurriculumCandidate({
      query,
      haystack,
      discipline: record.discipline,
      titel: record.titel,
      code: record.code,
      subdomein: record.subdomein,
    });

    if (tokenMatches < MIN_LOCAL_TOKEN_MATCHES && score < MIN_LOCAL_SEARCH_SCORE) {
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
      .slice(0, candidateLimit)
      .filter(
        (entry) =>
          entry.score >= MIN_LOCAL_SEARCH_SCORE || entry.tokenMatches >= 1,
      )
      .slice(0, limit)
      .map((entry) => ({ ...entry.record, score: entry.score })),
  );
}

export function mergeCurriculumResults(
  pools: Array<Array<CurriculumSearchResult & { score?: number }>>,
  limit = CURRICULUM_TOP_N,
): Array<CurriculumSearchResult & { score?: number }> {
  const seen = new Map<string, CurriculumSearchResult & { score?: number }>();

  for (const result of pools.flat().sort((left, right) => (right.score ?? 0) - (left.score ?? 0))) {
    const key = [result.code, result.titel, result.netwerk].join("|");
    const existing = seen.get(key);
    if (!existing || (result.score ?? 0) > (existing.score ?? 0)) {
      seen.set(key, result);
    }
  }

  return [...seen.values()]
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .slice(0, limit);
}

export function searchMinimumGoals({
  query,
  limit = 6,
  educationLevel = "BASISONDERWIJS",
}: {
  query: string;
  limit?: number;
  educationLevel?: EducationLevelFilter;
}): Array<CurriculumSearchResult & { score: number }> {
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) {
    return [];
  }

  return recordsForNetwork("ALL", educationLevel)
    .map((raw) => {
      const record = normalizeRecord(raw, networkFromRaw(raw));
      const minimum = record?.gelinktMinimumdoel;
      if (!record || !minimum?.tekst) {
        return null;
      }

      const minimumText = minimum.tekst;
      const minimumScore = scoreTextOverlap(minimumText, queryTokens);
      const leerplanScore = scoreTextOverlap(record.titel, queryTokens);
      const tokenMatches =
        countTokenMatches(minimumText, queryTokens) +
        countTokenMatches(record.titel, queryTokens);

      if (tokenMatches < MIN_TOKEN_MATCHES) {
        return null;
      }

      const score = Math.min(1, minimumScore * 0.65 + leerplanScore * 0.35);
      if (score < MIN_CORPUS_MATCH_SCORE) {
        return null;
      }

      return { record, score, tokenMatches };
    })
    .filter(
      (
        entry,
      ): entry is {
        record: CurriculumSearchResult;
        score: number;
        tokenMatches: number;
      } => entry !== null,
    )
    .sort(
      (left, right) =>
        right.score - left.score || right.tokenMatches - left.tokenMatches,
    )
    .slice(0, limit * 3)
    .map((entry) => ({ ...entry.record, score: entry.score }));
}

export function dedupeByMinimumGoalCode(
  results: Array<CurriculumSearchResult & { score?: number }>,
  limit = 6,
): Array<CurriculumSearchResult & { score?: number }> {
  const seen = new Map<string, CurriculumSearchResult & { score?: number }>();

  for (const result of results) {
    const code = result.gelinktMinimumdoel?.code?.trim();
    const key = code || result.gelinktMinimumdoel?.tekst || result.titel;
    const existing = seen.get(key);
    if (!existing || (result.score ?? 0) > (existing.score ?? 0)) {
      seen.set(key, result);
    }
  }

  return [...seen.values()]
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .slice(0, limit);
}

const CODE_PATTERNS = [
  /\b\d\.\d+\.[A-Z]{2}\d+(?:\.\d+)?\b/u,
  /\b[A-Z]{3}[a-z]{3}\d+[BOV]\.\d+\b/u,
  /\b[A-Z]{2,3}\.\d{3}\b/u,
  /\b[A-Z][A-Za-z]{2,4}\d+\b/u,
  /\b[A-Z]{2,4}[a-z]{2,3}\d+\b/u,
];

export function extractCodeFromSnippet(snippet: string): string | null {
  for (const pattern of CODE_PATTERNS) {
    const match = snippet.match(pattern);
    if (match?.[0]) {
      return match[0];
    }
  }
  return null;
}

export function extractGoalSentence(snippet: string): string | null {
  const match = snippet.match(
    /(?:De leerlingen kunnen|De kleuters kunnen|De leerling|De leerlinge)[^.!?]{8,260}[.!?]/u,
  );
  return match?.[0]?.trim() ?? null;
}

function inferDisciplineFromLink(link: string, title = ""): string {
  const haystack = `${link} ${title}`.toLowerCase();
  if (haystack.includes("wiskunde") || haystack.includes("math")) return "Wiskunde";
  if (haystack.includes("nederlands")) return "Nederlands";
  if (haystack.includes("geschiedenis")) return "Geschiedenis";
  if (haystack.includes("frans")) return "Frans";
  if (haystack.includes("godsdienst")) return "Godsdienst";
  if (haystack.includes("muzische") || haystack.includes(" muziek")) {
    return "Muzische vorming";
  }
  if (haystack.includes("opstap")) return "Op.stap";
  if (haystack.includes("ovsg")) return "OVSG LeerLokaal";
  return "";
}

function inferBronUrl(network: CurriculumNetworkFilter | null): string {
  switch (network) {
    case "OPSTAP":
      return "https://opstap.katholiekonderwijs.vlaanderen/";
    case "OVSG":
      return "https://leerlokaal.ovsg.be/";
    case "GO_NIEUW":
      return "https://pro.g-o.be/themas/leerplannen/basisonderwijs/nieuw-leerplan-basisonderwijs/";
    case "GO_OUD":
      return "https://pro.g-o.be/themas/leerplannen/basisonderwijs/";
    case "ZILL":
      return "https://zill-selector.katholiekonderwijs.vlaanderen/";
    case "GO":
      return "https://pro.g-o.be/";
    default:
      return "";
  }
}

export function buildFragmentResult(
  hit: Pick<DiscoveryHit, "snippet" | "link" | "title" | "network" | "relevanceScore">,
): CurriculumSearchResult & { score: number } {
  const code = extractCodeFromSnippet(hit.snippet);
  const goalSentence = extractGoalSentence(hit.snippet);
  const bronTitel = hit.title || titleFromLink(hit.link);
  const titel = goalSentence ?? hit.snippet.slice(0, 280).trim();
  const toelichting =
    hit.snippet.trim() && hit.snippet.trim() !== titel ? hit.snippet.trim() : "";

  return {
    code: code ?? "",
    discipline: inferDisciplineFromLink(hit.link, bronTitel),
    subdomein: "",
    titel,
    toelichting,
    leerjaarRoute: "",
    gelinktMinimumdoel: null,
    netwerk: hit.network ?? "ALL",
    bronUrl: inferBronUrl(hit.network),
    snippet: hit.snippet,
    sourceUri: hit.link,
    bronTitel,
    verrijking: "fragment",
    score: hit.relevanceScore,
  };
}

export function enrichHitFromCorpus(
  hit: DiscoveryHit,
  query: string,
  network: CurriculumNetworkFilter,
  educationLevel: EducationLevelFilter = "ALL",
): (CurriculumSearchResult & { score: number }) | null {
  if (network !== "ALL" && hit.network && hit.network !== network) {
    return null;
  }

  const scopedNetwork =
    network !== "ALL" ? network : (hit.network ?? "ALL");
  const snippet = hit.snippet.trim();
  const title = hit.title.trim();

  if (!snippet && !title) {
    return null;
  }

  const code = extractCodeFromSnippet(`${snippet} ${title}`);
  if (code) {
    const byCode = findCorpusRecordByCode(
      code,
      scopedNetwork,
      educationLevel,
    );
    if (byCode) {
      return {
        ...byCode,
        snippet: snippet || hit.snippet,
        sourceUri: hit.link,
        bronTitel: title || undefined,
        score: Math.max(hit.relevanceScore, 0.88),
        verrijking: "corpus",
      };
    }
  }

  const corpusMatch = findBestCorpusMatch({
    snippet,
    query,
    title,
    network: scopedNetwork,
    educationLevel,
  });
  if (corpusMatch) {
    return {
      ...corpusMatch,
      snippet: snippet || corpusMatch.snippet,
      sourceUri: hit.link,
      bronTitel: title || undefined,
      score: blendScore(hit.relevanceScore, corpusMatch.score),
      verrijking: "corpus",
    };
  }

  return null;
}

export function resolveDiscoveryCandidates({
  hits,
  query,
  network,
  educationLevel = "ALL",
  semanticFallback = false,
}: {
  hits: DiscoveryHit[];
  query: string;
  network: CurriculumNetworkFilter;
  educationLevel?: EducationLevelFilter;
  semanticFallback?: boolean;
}): Array<CurriculumSearchResult & { score: number }> {
  const resolved: Array<CurriculumSearchResult & { score: number }> = [];

  for (const hit of hits) {
    const enriched = enrichHitFromCorpus(
      hit,
      query,
      network,
      educationLevel,
    );
    if (enriched) {
      resolved.push(enriched);
      continue;
    }

    if (!semanticFallback) {
      continue;
    }

    const relaxedMatch = findBestCorpusMatch({
      snippet: hit.snippet,
      query,
      title: hit.title,
      network,
      educationLevel,
      relaxed: true,
    });
    if (relaxedMatch) {
      resolved.push({
        ...relaxedMatch,
        snippet: hit.snippet || relaxedMatch.snippet,
        sourceUri: hit.link,
        bronTitel: hit.title || undefined,
        score: blendScore(hit.relevanceScore, relaxedMatch.score),
        verrijking: "corpus",
      });
      continue;
    }

    if (educationLevel === "ALL" || network === "GO_OUD") {
      const fragment = buildFragmentResult(hit);
      resolved.push({
        ...fragment,
        score: Math.max(fragment.score, hit.relevanceScore * 0.82),
      });
    }
  }

  return resolved.sort((left, right) => right.score - left.score);
}

export function corpusFilesForNetwork(network: CurriculumNetworkFilter): string[] {
  switch (network) {
    case "OPSTAP":
      return [OPSTAP_CORPUS_PROD];
    case "OVSG":
      return [OVSG_CORPUS_PROD, SECONDARY_CURRICULUM_PROD];
    case "GO_NIEUW":
      return [GO_NIEUW_CORPUS_PROD];
    case "GO_OUD":
      return [GO_OUD_CORPUS_PROD];
    case "ZILL":
      return [ZILL_CORPUS_PROD];
    case "GO":
      return [SECONDARY_CURRICULUM_PROD];
    case "KOV":
      return [SECONDARY_CURRICULUM_PROD];
    case "POV":
      return [SECONDARY_POV_CURRICULUM_PROD];
    case "ALL":
      return [
        OPSTAP_CORPUS_PROD,
        OVSG_CORPUS_PROD,
        GO_NIEUW_CORPUS_PROD,
        GO_OUD_CORPUS_PROD,
        ZILL_CORPUS_PROD,
        SECONDARY_CURRICULUM_PROD,
        SECONDARY_POV_CURRICULUM_PROD,
      ];
  }
}
