"use client";

import type {
  CurriculumNetworkFilter,
  EducationLevelFilter,
} from "@/types";

export type RagQueryEndpoint = "rag-curriculum" | "rag-minimum-goals";

export type CachedRagQueryResult<T> = {
  data: T;
  provider: string;
  fallbackErrors: string[];
};

export type RagQueryCacheScope = {
  grade?: string;
  ageRange?: string;
  secondaryGrade?: string;
  secondaryFinality?: string;
  domainDetail?: string;
  domainFinality?: string;
  enableLlmQueryRewriting?: boolean;
};

const STORAGE_KEY = "leerkrachtentools-rag-query-cache";
const CACHE_VERSION = 2;

type StoredRagQueryCache = {
  version: number;
  entries: Record<string, CachedRagQueryResult<unknown>>;
};

export function normalizeCachedQuery(query: string): string {
  return query
    .trim()
    .toLocaleLowerCase("nl-BE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

export function buildRagQueryCacheKey(
  educationLevel: EducationLevelFilter,
  network: CurriculumNetworkFilter | "-",
  query: string,
  scope: RagQueryCacheScope = {},
): string {
  const scopeKey = [
    scope.grade ?? "",
    scope.ageRange ?? "",
    scope.secondaryGrade ?? "",
    scope.secondaryFinality ?? "",
    scope.domainDetail ?? "",
    scope.domainFinality ?? "",
    scope.enableLlmQueryRewriting ? "1" : "0",
  ].join("|");
  return `${educationLevel}:${network}:${normalizeCachedQuery(query)}:${scopeKey}`;
}

function endpointPrefix(endpoint: RagQueryEndpoint): string {
  return endpoint;
}

export function buildRagQueryStorageKey(
  endpoint: RagQueryEndpoint,
  educationLevel: EducationLevelFilter,
  network: CurriculumNetworkFilter | "-",
  query: string,
  scope: RagQueryCacheScope = {},
): string {
  return `${endpointPrefix(endpoint)}:${buildRagQueryCacheKey(educationLevel, network, query, scope)}`;
}

function readStore(): StoredRagQueryCache {
  if (typeof window === "undefined") {
    return { version: CACHE_VERSION, entries: {} };
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { version: CACHE_VERSION, entries: {} };
    }
    const parsed = JSON.parse(raw) as StoredRagQueryCache;
    if (parsed.version !== CACHE_VERSION || !parsed.entries) {
      return { version: CACHE_VERSION, entries: {} };
    }
    return parsed;
  } catch {
    return { version: CACHE_VERSION, entries: {} };
  }
}

function writeStore(store: StoredRagQueryCache): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // sessionStorage full or unavailable; ignore
  }
}

export function readRagQueryCache<T>(
  endpoint: RagQueryEndpoint,
  educationLevel: EducationLevelFilter,
  network: CurriculumNetworkFilter | "-",
  query: string,
  scope: RagQueryCacheScope = {},
): CachedRagQueryResult<T> | null {
  const normalized = normalizeCachedQuery(query);
  if (!normalized) {
    return null;
  }

  const key = buildRagQueryStorageKey(
    endpoint,
    educationLevel,
    network,
    normalized,
    scope,
  );
  const entry = readStore().entries[key];
  if (!entry) {
    return null;
  }

  return entry as CachedRagQueryResult<T>;
}

export function writeRagQueryCache<T>(
  endpoint: RagQueryEndpoint,
  educationLevel: EducationLevelFilter,
  network: CurriculumNetworkFilter | "-",
  query: string,
  payload: CachedRagQueryResult<T>,
  scope: RagQueryCacheScope = {},
): void {
  const normalized = normalizeCachedQuery(query);
  if (!normalized) {
    return;
  }

  const store = readStore();
  store.entries[
    buildRagQueryStorageKey(endpoint, educationLevel, network, normalized, scope)
  ] = payload;
  writeStore(store);
}

export function clearRagQueryCache(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
