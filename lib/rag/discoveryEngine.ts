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
}

const NETWORK_PATH: Record<Exclude<CurriculumNetworkFilter, "ALL">, string> = {
  OPSTAP: "/opstap/",
  OVSG: "/ovsg/",
  GO_NIEUW: "/go_nieuw/",
  ZILL: "/zill/",
  GO: "/go/",
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
  if (normalized.includes("/opstap/")) return "OPSTAP";
  if (normalized.includes("/ovsg/")) return "OVSG";
  if (normalized.includes("/zill/")) return "ZILL";
  if (normalized.includes("/go/")) return "GO";
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
  return `${network} ${query}`;
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

export async function searchDiscoveryEngine(
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

export function localPathFromGcsUri(uri: string): string | null {
  const marker = "leerkrachtentools-curriculum/";
  const index = uri.indexOf(marker);
  if (index === -1) {
    return null;
  }
  return `data/${uri.slice(index + marker.length)}`;
}

export { NETWORK_PATH };
