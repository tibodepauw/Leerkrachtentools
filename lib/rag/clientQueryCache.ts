"use client";
import { limitGoalMatches } from "@/lib/rag/outputLimit";
import { getActiveUserId } from "@/lib/storage/userStorageScope";
import { isSharedDevice, temporaryStorage } from "@/lib/storage/sharedDevice";

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
  searchMode?: "snel" | "pro" | string;
};

const STORAGE_KEY = "leerkrachtentools-rag-query-cache";
const CACHE_VERSION = 5;

function accountStorageKey() {
  const userId = getActiveUserId();
  return userId ? `${STORAGE_KEY}:${userId}` : null;
}

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
    scope.searchMode === "pro" ? "pro" : "snel",
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
  const key = accountStorageKey();
  if (typeof window === "undefined" || !key) {
    return { version: CACHE_VERSION, entries: {} };
  }

  try {
    // Never adopt the old, unscoped cache as the newly signed-in user's data.
    window.sessionStorage.removeItem(STORAGE_KEY);
    if (isSharedDevice()) window.sessionStorage.removeItem(key);
    const raw = isSharedDevice() ? temporaryStorage.get(key) : window.sessionStorage.getItem(key);
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
  const key = accountStorageKey();
  if (typeof window === "undefined" || !key) {
    return;
  }

  try {
    if (isSharedDevice()) {
      window.sessionStorage.removeItem(key);
      temporaryStorage.set(key, JSON.stringify(store));
    } else window.sessionStorage.setItem(key, JSON.stringify(store));
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

  return limitGoalMatches(entry) as CachedRagQueryResult<T>;
}

export function isEmptyRagQueryPayload(data: unknown): boolean {
  if (!data || typeof data !== "object") {
    return true;
  }
  const goal = (data as { goal?: unknown }).goal;
  return goal == null || goal === "niet gevonden";
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
  if (isEmptyRagQueryPayload(payload.data)) {
    return;
  }

  const store = readStore();
  store.entries[
    buildRagQueryStorageKey(endpoint, educationLevel, network, normalized, scope)
  ] = limitGoalMatches(payload);
  writeStore(store);
}

export function clearRagQueryCache(): void {
  if (typeof window === "undefined") {
    return;
  }

  const key = accountStorageKey();
  if (key) temporaryStorage.delete(key);
  try {
    if (key) window.sessionStorage.removeItem(key);
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
