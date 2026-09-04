import { SearchServiceClient } from "@google-cloud/discoveryengine/build/src/v1/search_service_client";
import type { CurriculumNetworkFilter } from "@/types";

export interface DiscoverySearchOptions {
  query: string;
  network?: CurriculumNetworkFilter;
  pageSize?: number;
}

export interface DiscoveryHit {
  id: string;
  link: string;
  title: string;
  snippet: string;
  network: CurriculumNetworkFilter | null;
  relevanceScore: number;
}

export interface DiscoverySearchResponse {
  hits: DiscoveryHit[];
  summaryText: string;
  citations: Array<{ title?: string; uri?: string; startIndex?: number }>;
  totalSize: number;
  timedOut?: boolean;
  failed?: boolean;
}

export const DISCOVERY_SEARCH_TIMEOUT_MS = 3_500;

export class DiscoveryEngineTimeoutError extends Error {
  constructor(timeoutMs = DISCOVERY_SEARCH_TIMEOUT_MS) {
    super(`Discovery Engine time-out na ${timeoutMs} ms.`);
    this.name = "DiscoveryEngineTimeoutError";
  }
}

export function isDiscoveryTransportError(error: unknown): boolean {
  if (error instanceof DiscoveryEngineTimeoutError) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return /discovery|timeout|timed?\s*out|fetch failed|failed to fetch|econn|aborted|etimedout|network/i.test(
    error.message,
  );
}

export function emptyDiscoveryResponse(
  reason: "timeout" | "error" | "empty" = "empty",
): DiscoverySearchResponse {
  return {
    hits: [],
    summaryText: "",
    citations: [],
    totalSize: 0,
    timedOut: reason === "timeout",
    failed: reason === "error",
  };
}

export async function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settled = promise.then(
    (value) => ({ status: "fulfilled" as const, value }),
    (error: unknown) => ({ status: "rejected" as const, error }),
  );

  try {
    const winner = await Promise.race([
      settled,
      new Promise<{ status: "timeout" }>((resolve) => {
        timer = setTimeout(() => {
          resolve({ status: "timeout" });
        }, timeoutMs);
      }),
    ]);

    if (winner.status === "timeout") {
      throw new DiscoveryEngineTimeoutError(timeoutMs);
    }
    if (winner.status === "rejected") {
      throw winner.error;
    }
    return winner.value;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

const NETWORK_PATH: Record<Exclude<CurriculumNetworkFilter, "ALL">, string> = {
  OPSTAP: "/opstap/",
  OVSG: "/ovsg/",
  GO_NIEUW: "/go_nieuw/",
  GO_OUD: "/go/",
  ZILL: "/zill/",
  GO: "/secundair/",
  KOV: "/secundair/",
  POV: "/secundair/",
};

function readEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Ontbrekende omgevingsvariabele: ${name}`);
  }
  return value;
}

function privateKey(): string {
  return readEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
}

function servingConfigPath(client: SearchServiceClient): string {
  const projectId = readEnv("GOOGLE_PROJECT_ID");
  const location = process.env.GOOGLE_LOCATION?.trim() || "global";
  const dataStoreId = readEnv("GOOGLE_DATA_STORE_ID");
  return client.projectLocationCollectionDataStoreServingConfigPath(
    projectId,
    location,
    "default_collection",
    dataStoreId,
    "default_search",
  );
}

export function networkFromUri(uri: string): CurriculumNetworkFilter | null {
  const normalized = uri.toLowerCase();
  if (normalized.includes("/go_nieuw/")) return "GO_NIEUW";
  if (
    normalized.includes("/secundair/go/") ||
    normalized.includes("/secundair/leerplannen_secundair_go")
  ) {
    return "GO";
  }
  if (normalized.includes("/go/")) return "GO_OUD";
  if (normalized.includes("/opstap/")) return "OPSTAP";
  if (normalized.includes("/ovsg/")) return "OVSG";
  if (normalized.includes("/zill/")) return "ZILL";
  if (normalized.includes("/secundair/pov/")) return "POV";
  if (normalized.includes("/secundair/")) return "KOV";
  return null;
}

function decodeSnippet(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

type DocumentLike = {
  derivedStructData?: {
    fields?: Record<
      string,
      {
        stringValue?: string;
        listValue?: {
          values?: Array<{
            structValue?: {
              fields?: Record<string, { stringValue?: string }>;
            };
          }>;
        };
      }
    > | null;
  } | null;
};

type SearchResultLike = {
  rankSignals?: {
    relevanceScore?: number | null;
    semanticSimilarityScore?: number | null;
    keywordSimilarityScore?: number | null;
  } | null;
};

function extractSnippet(document: DocumentLike): string {
  const snippets =
    document.derivedStructData?.fields?.snippets?.listValue?.values ?? [];
  for (const entry of snippets) {
    const raw = entry.structValue?.fields?.snippet?.stringValue;
    if (raw) {
      return decodeSnippet(raw);
    }
  }
  return "";
}

function extractLink(document: DocumentLike): string {
  return document.derivedStructData?.fields?.link?.stringValue ?? "";
}

function extractTitle(document: DocumentLike, link: string): string {
  const fromDocument =
    document.derivedStructData?.fields?.title?.stringValue ??
    document.derivedStructData?.fields?.htmlTitle?.stringValue ??
    document.derivedStructData?.fields?.displayLink?.stringValue;
  if (fromDocument?.trim()) {
    return decodeSnippet(fromDocument);
  }
  return titleFromLink(link);
}

export function titleFromLink(link: string): string {
  const file = decodeURIComponent(link.split("/").pop() ?? "")
    .replace(/\+/g, " ")
    .trim();
  if (!file) {
    return "";
  }
  return file
    .replace(/\.(pdf|jsonl|xlsx|docx?|txt)$/iu, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

export function extractRelevanceScore(
  result: SearchResultLike,
  rank: number,
): number {
  const signals = result.rankSignals;
  const candidates = [
    signals?.relevanceScore,
    signals?.semanticSimilarityScore,
    signals?.keywordSimilarityScore,
  ].filter((value): value is number => typeof value === "number");

  if (candidates.length > 0) {
    return clampScore(Math.max(...candidates));
  }

  return clampScore(Math.max(0.35, 0.92 - rank * 0.07));
}

function clampScore(value: number): number {
  if (Number.isNaN(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value));
}

function buildQuery(query: string, network?: CurriculumNetworkFilter): string {
  if (!network || network === "ALL") {
    return query;
  }
  const pathHint = NETWORK_PATH[network];
  return pathHint ? `${query} ${pathHint}` : `${network} ${query}`;
}

function matchesNetwork(
  hitNetwork: CurriculumNetworkFilter | null,
  filter?: CurriculumNetworkFilter,
): boolean {
  if (!filter || filter === "ALL") {
    return true;
  }
  return hitNetwork === filter;
}

let client: SearchServiceClient | null = null;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 500;
const searchCache = new Map<
  string,
  { expiresAt: number; value: DiscoverySearchResponse }
>();
const searchesInFlight = new Map<string, Promise<DiscoverySearchResponse>>();

function getClient(): SearchServiceClient {
  if (!client) {
    client = new SearchServiceClient({
      credentials: {
        client_email: readEnv("GOOGLE_CLIENT_EMAIL"),
        private_key: privateKey(),
      },
    });
  }
  return client;
}

async function performDiscoverySearch(
  options: DiscoverySearchOptions,
): Promise<DiscoverySearchResponse> {
  const searchClient = getClient();
  const pageSize = options.pageSize ?? 12;
  const [results, , rawResponse] = await searchClient.search(
    {
      servingConfig: servingConfigPath(searchClient),
      query: buildQuery(options.query, options.network),
      pageSize,
      relevanceScoreSpec: {
        returnRelevanceScore: true,
      },
      contentSearchSpec: {
        snippetSpec: {
          returnSnippet: true,
        },
        summarySpec: {
          summaryResultCount: Math.min(pageSize, 5),
          includeCitations: true,
          ignoreAdversarialQuery: true,
          ignoreNonSummarySeekingQuery: true,
        },
      },
    },
    { autoPaginate: false },
  );

  const hits: DiscoveryHit[] = [];
  for (const [index, result] of (results ?? []).entries()) {
    const document = result.document;
    if (!document?.id) {
      continue;
    }
    const doc = document as DocumentLike;
    const link = extractLink(doc);
    const network = networkFromUri(link);
    if (!matchesNetwork(network, options.network)) {
      continue;
    }
    const snippet = extractSnippet(doc);
    if (!snippet && !extractTitle(doc, link)) {
      continue;
    }
    hits.push({
      id: document.id,
      link,
      title: extractTitle(doc, link),
      snippet,
      network,
      relevanceScore: extractRelevanceScore(result as SearchResultLike, index),
    });
  }

  const citations =
    rawResponse?.summary?.summaryWithMetadata?.references?.map((reference) => ({
      title: reference.title ?? undefined,
      uri: reference.uri ?? undefined,
    })) ?? [];

  return {
    hits,
    summaryText: rawResponse?.summary?.summaryText ?? "",
    citations,
    totalSize: Number(rawResponse?.totalSize ?? hits.length),
  };
}

function isDiscoveryConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_PROJECT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_EMAIL?.trim() &&
      process.env.GOOGLE_PRIVATE_KEY?.trim() &&
      process.env.GOOGLE_DATA_STORE_ID?.trim(),
  );
}

export async function searchDiscoveryEngine(
  options: DiscoverySearchOptions,
): Promise<DiscoverySearchResponse> {
  if (!isDiscoveryConfigured()) {
    return emptyDiscoveryResponse("empty");
  }
  const key = JSON.stringify([
    options.query.trim().toLocaleLowerCase("nl-BE"),
    options.network ?? "ALL",
    options.pageSize ?? 12,
  ]);
  const now = Date.now();
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;
  if (cached) searchCache.delete(key);

  const existing = searchesInFlight.get(key);
  if (existing) return existing;

  const pending = raceWithTimeout(
    performDiscoverySearch(options),
    DISCOVERY_SEARCH_TIMEOUT_MS,
  )
    .then((value) => {
      if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
        const oldest = searchCache.keys().next().value as string | undefined;
        if (oldest) searchCache.delete(oldest);
      }
      searchCache.set(key, {
        expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
        value,
      });
      return value;
    })
    .catch((error: unknown) => {
      if (error instanceof DiscoveryEngineTimeoutError) {
        return emptyDiscoveryResponse("timeout");
      }
      return emptyDiscoveryResponse("error");
    })
    .finally(() => searchesInFlight.delete(key));

  searchesInFlight.set(key, pending);
  return pending;
}

export function localPathFromGcsUri(uri: string): string | null {
  const marker = "leerkrachtentools-curriculum/";
  const index = uri.indexOf(marker);
  if (index === -1) {
    return null;
  }
  return `data/${uri.slice(index + marker.length)}`;
}

export { NETWORK_PATH };
