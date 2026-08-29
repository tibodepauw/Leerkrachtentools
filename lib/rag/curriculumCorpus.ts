import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type {
  CurriculumNetworkFilter,
  CurriculumSearchResult,
  LinkedMinimumGoal,
} from "@/types";
import type { DiscoveryHit } from "@/lib/rag/discoveryEngine";
import { titleFromLink } from "@/lib/rag/discoveryEngine";
import { decodeHtmlEntities } from "@/lib/rag/curriculumDisplay";

type RawRecord = Record<string, unknown>;

const CORPUS_FILES: Record<
  Exclude<CurriculumNetworkFilter, "ALL">,
  string[]
> = {
  OPSTAP: ["data/opstap/opstap_volledig.jsonl"],
  OVSG: ["data/ovsg/ovsg_volledig.jsonl"],
  GO_NIEUW: ["data/go_nieuw/go_nieuw_volledig.jsonl"],
  ZILL: ["data/zill/zill_volledig.jsonl"],
  GO: [],
};

const MIN_CORPUS_MATCH_SCORE = 0.32;
const MIN_TOKEN_MATCHES = 2;
const STOPWORDS = new Set([
  "tot",
  "een",
  "de",
  "het",
  "van",
  "met",
  "kan",
  "kunnen",
  "leerling",
  "leerlingen",
  "kleuters",
  "deze",
  "dat",
  "voor",
  "bij",
  "zijn",
  "worden",
  "door",
  "naar",
  "ook",
  "nog",
  "als",
  "dan",
  "der",
  "des",
]);

const loaded = new Map<string, RawRecord[]>();

function workspacePath(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}

function loadJsonl(relativePath: string): RawRecord[] {
  const absolute = workspacePath(relativePath);
  if (loaded.has(absolute)) {
    return loaded.get(absolute)!;
  }
  if (!existsSync(absolute)) {
    loaded.set(absolute, []);
    return [];
  }
  const records = readFileSync(absolute, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RawRecord);
  loaded.set(absolute, records);
  return records;
}

export function recordsForNetwork(network: CurriculumNetworkFilter): RawRecord[] {
  if (network === "ALL") {
    return (
      Object.keys(CORPUS_FILES) as Array<Exclude<CurriculumNetworkFilter, "ALL">>
    ).flatMap((key) =>
      CORPUS_FILES[key].flatMap((file) => loadJsonl(file)),
    );
  }
  return CORPUS_FILES[network].flatMap((file) => loadJsonl(file));
}

function asString(value: unknown): string {
  return typeof value === "string" ? decodeHtmlEntities(value.trim()) : "";
}

export function isStructuredResult(
  result: CurriculumSearchResult,
): boolean {
  return result.verrijking === "corpus";
}

export function sanitizeStructuredResult<
  T extends CurriculumSearchResult & { score?: number },
>(result: T): T {
  const { snippet: _snippet, sourceUri: _sourceUri, bronTitel: _bronTitel, ...rest } =
    result;
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
  if (netwerk === "ZILL") return "ZILL";
  if (netwerk === "GO") return "GO";
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

function normalizeRecord(
  raw: RawRecord,
  network: CurriculumNetworkFilter | null,
): CurriculumSearchResult | null {
  const code = asString(raw.code);
  const titel = asString(raw.titel ?? raw.text ?? raw.title);
  if (!titel) {
    return null;
  }

  const discipline = asString(
    raw.discipline ?? raw.leergebied ?? raw.ontwikkelveld,
  );
  const subdomein = asString(raw.subdomein ?? raw.domain ?? raw.subject);
  const toelichting = asString(raw.toelichting ?? raw.description);
  const leerjaren = raw.leerjaren;
  const leerjaarRoute = asString(
    raw.leerjaar_route ??
      raw.fase ??
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
      .filter((token) => token.length > 2 && !STOPWORDS.has(token)),
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

function recordHaystack(raw: RawRecord): string {
  return [
    raw.code,
    raw.titel,
    raw.text,
    raw.discipline,
    raw.leergebied,
    raw.subdomein,
    raw.toelichting,
  ]
    .filter(Boolean)
    .join(" ");
}

function blendScore(discoveryScore: number, corpusScore: number): number {
  return Math.max(0, Math.min(1, discoveryScore * 0.55 + corpusScore * 0.45));
}

export function findCorpusRecordByCode(
  code: string,
  network: CurriculumNetworkFilter,
): CurriculumSearchResult | null {
  const needle = code.trim();
  if (!needle) {
    return null;
  }
  for (const raw of recordsForNetwork(network)) {
    if (!recordMatchesNetwork(raw, network)) {
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
}: {
  snippet: string;
  query: string;
  title?: string;
  network: CurriculumNetworkFilter;
}): (CurriculumSearchResult & { score: number }) | null {
  const queryTokens = tokenize(query);
  const tokens = new Set([
    ...queryTokens,
    ...tokenize(snippet),
    ...tokenize(title ?? ""),
  ]);
  if (tokens.size === 0) {
    return null;
  }

  let best:
    | {
        record: CurriculumSearchResult;
        score: number;
        tokenMatches: number;
      }
    | null = null;

  for (const raw of recordsForNetwork(network)) {
    if (!recordMatchesNetwork(raw, network)) {
      continue;
    }
    const record = normalizeRecord(raw, networkFromRaw(raw));
    if (!record) {
      continue;
    }

    const haystack = recordHaystack(raw);
    const tokenMatches = countTokenMatches(haystack, tokens);
    const queryTokenMatches = countTokenMatches(haystack, queryTokens);
    if (tokenMatches < MIN_TOKEN_MATCHES || queryTokenMatches < 1) {
      continue;
    }

    let score = scoreTextOverlap(haystack, tokens);
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

  if (!best || best.score < MIN_CORPUS_MATCH_SCORE) {
    return null;
  }

  return { ...best.record, score: best.score };
}

export function searchLocalCorpus({
  query,
  network,
  limit = 6,
}: {
  query: string;
  network?: CurriculumNetworkFilter;
  limit?: number;
}): Array<CurriculumSearchResult & { score: number }> {
  const scopedNetwork = network ?? "ALL";
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) {
    return [];
  }

  return recordsForNetwork(scopedNetwork)
    .map((raw) => {
      if (!recordMatchesNetwork(raw, scopedNetwork)) {
        return null;
      }
      const record = normalizeRecord(raw, networkFromRaw(raw));
      if (!record) {
        return null;
      }
      const tokenMatches = countTokenMatches(recordHaystack(raw), queryTokens);
      const queryTokenMatches = tokenMatches;
      if (queryTokenMatches < MIN_TOKEN_MATCHES) {
        return null;
      }
      return {
        record,
        score: scoreTextOverlap(recordHaystack(raw), queryTokens),
        tokenMatches,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        record: CurriculumSearchResult;
        score: number;
        tokenMatches: number;
      } => entry !== null && entry.score >= MIN_CORPUS_MATCH_SCORE,
    )
    .sort(
      (left, right) =>
        right.score - left.score || right.tokenMatches - left.tokenMatches,
    )
    .slice(0, limit)
    .map((entry) => ({ ...entry.record, score: entry.score }));
}

export function searchMinimumGoals({
  query,
  limit = 6,
}: {
  query: string;
  limit?: number;
}): Array<CurriculumSearchResult & { score: number }> {
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) {
    return [];
  }

  return recordsForNetwork("ALL")
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
    const byCode = findCorpusRecordByCode(code, scopedNetwork);
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

export function corpusFilesForNetwork(network: CurriculumNetworkFilter): string[] {
  if (network === "ALL") {
    return Object.values(CORPUS_FILES).flat();
  }
  return CORPUS_FILES[network];
}
