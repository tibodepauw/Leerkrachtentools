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
  /** Lescontext die alleen de Pro-analyse beïnvloedt: topic, learningArea en phases. */
  lessonContext?: unknown;
};

const STORAGE_KEY = "leerkrachtentools-rag-query-cache";
const CACHE_VERSION = 8;

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

function contextText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Deterministische vingerafdruk van de lescontext voor de Pro-cachesleutel.
 * Dezelfde inhoud geeft dezelfde waarde, los van objectvolgorde of extra
 * velden. De lestekst zelf komt zo niet in de opslagsleutel terecht.
 */
export function fingerprintLessonContext(context: unknown): string {
  const source =
    context && typeof context === "object" && !Array.isArray(context)
      ? (context as { topic?: unknown; learningArea?: unknown; phases?: unknown })
      : {};
  const phases = Array.isArray(source.phases)
    ? source.phases.map((phase) => {
        const record =
          phase && typeof phase === "object"
            ? (phase as { name?: unknown; text?: unknown })
            : {};
        return [contextText(record.name), contextText(record.text)];
      })
    : [];
  const canonical = JSON.stringify([
    contextText(source.topic),
    contextText(source.learningArea),
    phases,
  ]);

  // cyrb53: twee verweven 32-bit hashes, ruim voldoende voor een cachesleutel.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < canonical.length; index += 1) {
    const char = canonical.charCodeAt(index);
    h1 = Math.imul(h1 ^ char, 2654435761);
    h2 = Math.imul(h2 ^ char, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `${canonical.length.toString(36)}-${hash.toString(36)}`;
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
    // Alleen Pro hangt af van de lescontext; de snelle modus deelt zijn cache.
    scope.searchMode === "pro"
      ? `pro:${fingerprintLessonContext(scope.lessonContext)}`
      : "snel",
  ].join("|");
  return `${educationLevel}:${network}:${normalizeCachedQuery(query)}:${scopeKey}`;
}

/**
 * Leidt uit een zoekaanvraag alle velden af die het antwoord beïnvloeden, zodat
 * hook en cache dezelfde sleutel gebruiken.
 */
export function ragCacheScopeFromBody(
  body: Record<string, unknown>,
): RagQueryCacheScope {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    grade: text(body.grade),
    ageRange: text(body.ageRange),
    secondaryGrade: text(body.secondaryGrade),
    secondaryFinality: text(body.secondaryFinality),
    domainDetail: text(body.domainDetail),
    domainFinality: text(body.domainFinality),
    enableLlmQueryRewriting: body.enableLlmQueryRewriting === true,
    searchMode: body.searchMode === "pro" ? "pro" : "snel",
    lessonContext: {
      topic: body.topic,
      learningArea: body.learningArea,
      phases: body.phases,
    },
  };
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
