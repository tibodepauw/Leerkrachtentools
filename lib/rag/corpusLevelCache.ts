import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import type { CurriculumNetworkFilter, EducationLevelFilter } from "@/types";

type RawRecord = Record<string, unknown>;

export type CorpusLevel =
  | "BASISONDERWIJS"
  | "SECUNDAIR"
  | "BUBAO"
  | "BUSO"
  | "OKAN"
  | "DKO"
  | "VOLWASSENEN"
  | "HOGER";

const MAX_ACTIVE_LEVEL_CACHES = 2;
const CACHE_TTL_MS = 5 * 60 * 1000;
// Hoe vaak een warme cache de bronbestanden (mtime + grootte) opnieuw vergelijkt.
const REVALIDATE_INTERVAL_MS = 30 * 1000;

const OPSTAP_CORPUS_PROD = path.join(
  process.cwd(),
  "data",
  "opstap",
  "opstap_volledig.jsonl",
);
const OPSTAP_CORPUS_FIXTURE = path.join(
  process.cwd(),
  "test",
  "fixtures",
  "curriculum-opstap.jsonl",
);
const OVSG_CORPUS_PROD = path.join(
  process.cwd(),
  "data",
  "ovsg",
  "ovsg_volledig.jsonl",
);
const OVSG_CORPUS_FIXTURE = path.join(
  process.cwd(),
  "test",
  "fixtures",
  "curriculum-ovsg.jsonl",
);
const OVSG_NEW_CORPUS_PROD = path.join(
  process.cwd(), "data", "ovsg", "ovsg_2027_2028_volledig.jsonl",
);
const GO_NIEUW_CORPUS_PROD = path.join(
  process.cwd(),
  "data",
  "go_nieuw",
  "go_nieuw_volledig.jsonl",
);
const GO_NIEUW_CORPUS_FIXTURE = path.join(
  process.cwd(),
  "test",
  "fixtures",
  "curriculum-go-nieuw.jsonl",
);
const GO_OUD_CORPUS_PROD = path.join(
  process.cwd(),
  "data",
  "go",
  "go_volledig.jsonl",
);
const GO_OUD_CORPUS_FIXTURE = path.join(
  process.cwd(),
  "test",
  "fixtures",
  "curriculum-go-oud.jsonl",
);
const ZILL_CORPUS_PROD = path.join(
  process.cwd(),
  "data",
  "zill",
  "zill_volledig.jsonl",
);
const ZILL_CORPUS_FIXTURE = path.join(
  process.cwd(),
  "test",
  "fixtures",
  "curriculum-zill.jsonl",
);
const SECONDARY_CURRICULUM_PROD = path.join(
  process.cwd(),
  "data",
  "secundair",
  "leerplannen_secundair.jsonl",
);
const SECONDARY_OVSG_CORPUS_PROD = path.join(process.cwd(), "data", "secundair", "leerplannen_ovsg_2025.jsonl");
const SECONDARY_MINIMUM_GOALS_PROD = path.join(
  process.cwd(),
  "data",
  "secundair",
  "minimumdoelen_secundair.jsonl",
);
const SECONDARY_POV_CURRICULUM_PROD = path.join(
  process.cwd(),
  "data",
  "secundair",
  "leerplannen_pov_secundair.jsonl",
);
const PRIMARY_MINIMUM_GOALS_PROD = path.join(
  process.cwd(), "data", "basisonderwijs", "minimumdoelen_basisonderwijs.jsonl",
);

const DOMAIN_CORPUS_PATHS: Record<
  Exclude<CorpusLevel, "BASISONDERWIJS" | "SECUNDAIR">,
  { prod: string; fixture?: string }
> = {
  OKAN: {
    prod: path.join(process.cwd(), "data", "okan", "onderwijsdoelen_okan.jsonl"),
    fixture: path.join(process.cwd(), "test", "fixtures", "onderwijsdoelen-okan.jsonl"),
  },
  BUBAO: {
    prod: path.join(process.cwd(), "data", "bubao", "onderwijsdoelen_bubao.jsonl"),
  },
  BUSO: {
    prod: path.join(process.cwd(), "data", "buso", "onderwijsdoelen_buso.jsonl"),
  },
  DKO: {
    prod: path.join(process.cwd(), "data", "dko", "onderwijsdoelen_dko.jsonl"),
  },
  VOLWASSENEN: {
    prod: path.join(
      process.cwd(),
      "data",
      "volwassenen",
      "onderwijsdoelen_volwassenen.jsonl",
    ),
  },
  HOGER: {
    prod: path.join(process.cwd(), "data", "hoger", "onderwijsdoelen_hoger.jsonl"),
  },
};

const SECUNDAIR_PATHS = [
  SECONDARY_CURRICULUM_PROD,
  SECONDARY_OVSG_CORPUS_PROD,
  SECONDARY_POV_CURRICULUM_PROD,
  SECONDARY_MINIMUM_GOALS_PROD,
];

export type CorpusLevelUnloadReason = "evicted" | "expired" | "stale" | "reset";

type IdleTimer = ReturnType<typeof setTimeout> | null;

type LevelCacheEntry = {
  records: RawRecord[];
  paths: Set<string>;
  signature: string;
  checkedAt: number;
  lastAccessAt: number;
  unloadTimer: IdleTimer;
};

const jsonlCache = new Map<string, RawRecord[]>();
const levelCache = new Map<CorpusLevel, LevelCacheEntry>();
const levelUnloadListeners = new Set<
  (level: CorpusLevel, reason: CorpusLevelUnloadReason) => void
>();
const derivedCaches = new Set<{
  invalidateLevel: (level: CorpusLevel) => void;
  clear: () => void;
}>();

let levelScopeDepth = 0;
const levelsLoadedInScope: CorpusLevel[] = [];

/**
 * Luistert naar het vrijgeven van ruwe niveaudata. Alleen `stale` en `reset`
 * betekenen dat de inhoud veranderd kan zijn; `evicted` en `expired` geven
 * enkel geheugen vrij.
 */
export function registerCorpusLevelUnloadListener(
  listener: (level: CorpusLevel, reason: CorpusLevelUnloadReason) => void,
): () => void {
  levelUnloadListeners.add(listener);
  return () => levelUnloadListeners.delete(listener);
}

function notifyLevelUnload(
  level: CorpusLevel,
  reason: CorpusLevelUnloadReason,
): void {
  if (reason === "stale" || reason === "reset") {
    for (const cache of derivedCaches) {
      cache.invalidateLevel(level);
    }
  }
  for (const listener of levelUnloadListeners) {
    listener(level, reason);
  }
}

export function normalizeCorpusLevel(
  level: EducationLevelFilter,
): CorpusLevel {
  switch (level) {
    case "KLEUTER":
    case "LAGER":
    case "BASISONDERWIJS":
    case "ALL":
      return "BASISONDERWIJS";
    case "SECUNDAIR":
      return "SECUNDAIR";
    case "BUBAO":
    case "BUSO":
    case "OKAN":
    case "DKO":
    case "VOLWASSENEN":
    case "HOGER":
      return level;
    default:
      return "BASISONDERWIJS";
  }
}

export function resolveCorpusLevel(
  educationLevel: EducationLevelFilter,
  network?: CurriculumNetworkFilter,
): CorpusLevel {
  if (educationLevel !== "ALL") {
    return normalizeCorpusLevel(educationLevel);
  }

  switch (network) {
    case "GO":
    case "KOV":
    case "POV":
      return "SECUNDAIR";
    case "OPSTAP":
    case "OVSG":
    case "GO_NIEUW":
    case "GO_OUD":
    case "ZILL":
      return "BASISONDERWIJS";
    default:
      return "BASISONDERWIJS";
  }
}

function parseJsonl(absolutePath: string, text: string): RawRecord[] {
  const records: RawRecord[] = [];
  let skipped = 0;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        records.push(parsed as RawRecord);
      } else {
        skipped += 1;
      }
    } catch {
      skipped += 1;
    }
  }
  if (skipped > 0) {
    // Alleen bestandsnaam en aantallen: nooit regelinhoud of parserfouten loggen.
    console.warn("[corpus:jsonl] ongeldige regels overgeslagen", {
      file: path.basename(absolutePath),
      skipped,
      kept: records.length,
    });
  }
  return records;
}

function loadJsonlAt(absolutePath: string): RawRecord[] {
  const cached = jsonlCache.get(absolutePath);
  if (cached) {
    return cached;
  }
  if (!existsSync(absolutePath)) {
    jsonlCache.set(absolutePath, []);
    return [];
  }
  let records: RawRecord[];
  try {
    records = parseJsonl(absolutePath, readFileSync(absolutePath, "utf8"));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    console.warn("[corpus:jsonl] bestand niet leesbaar", {
      file: path.basename(absolutePath),
      code: typeof code === "string" && /^E[A-Z]+$/.test(code) ? code : "UNKNOWN",
    });
    records = [];
  }
  // Ook een leeg of deels ongeldig resultaat wordt gecachet, zodat een kapot
  // bestand niet bij elke zoekopdracht opnieuw gelezen wordt. Een gewijzigd
  // bestand valt op via de signatuurcontrole.
  jsonlCache.set(absolutePath, records);
  return records;
}

function loadCorpusWithFallback(prodPath: string, fixturePath: string): RawRecord[] {
  const prodRecords = loadJsonlAt(prodPath);
  if (prodRecords.length > 0) {
    return prodRecords;
  }
  return loadJsonlAt(fixturePath);
}

function tagNetwork(records: RawRecord[], network: string): RawRecord[] {
  return records.map((raw) => ({
    ...raw,
    netwerk: typeof raw.netwerk === "string" && raw.netwerk.trim()
      ? raw.netwerk
      : network,
  }));
}

function ingestBasisonderwijsRecords(): RawRecord[] {
  const newOvsg = loadJsonlAt(OVSG_NEW_CORPUS_PROD);
  return [
    ...loadJsonlAt(PRIMARY_MINIMUM_GOALS_PROD),
    ...tagNetwork(
      loadCorpusWithFallback(OPSTAP_CORPUS_PROD, OPSTAP_CORPUS_FIXTURE),
      "OPSTAP",
    ),
    ...tagNetwork(
      newOvsg.length ? newOvsg : loadCorpusWithFallback(OVSG_CORPUS_PROD, OVSG_CORPUS_FIXTURE),
      "OVSG",
    ),
    ...tagNetwork(
      loadCorpusWithFallback(GO_NIEUW_CORPUS_PROD, GO_NIEUW_CORPUS_FIXTURE),
      "GO_NIEUW",
    ),
    ...tagNetwork(
      loadCorpusWithFallback(GO_OUD_CORPUS_PROD, GO_OUD_CORPUS_FIXTURE),
      "GO_OUD",
    ),
    ...tagNetwork(
      loadCorpusWithFallback(ZILL_CORPUS_PROD, ZILL_CORPUS_FIXTURE),
      "ZILL",
    ),
  ];
}

function ingestSecundairRecords(): RawRecord[] {
  const ovsg = loadJsonlAt(SECONDARY_OVSG_CORPUS_PROD);
  return [
    ...loadJsonlAt(SECONDARY_CURRICULUM_PROD).filter(raw => !ovsg.length || String(raw.netwerk ?? raw.network).toUpperCase() !== "OVSG"),
    ...ovsg,
    ...loadJsonlAt(SECONDARY_POV_CURRICULUM_PROD),
    ...loadJsonlAt(SECONDARY_MINIMUM_GOALS_PROD),
  ];
}

function ingestDomainRecords(level: Exclude<CorpusLevel, "BASISONDERWIJS" | "SECUNDAIR">): RawRecord[] {
  const { prod, fixture } = DOMAIN_CORPUS_PATHS[level];
  if (fixture) {
    return loadCorpusWithFallback(prod, fixture);
  }
  return loadJsonlAt(prod);
}

function ingestRecordsForLevel(level: CorpusLevel): RawRecord[] {
  switch (level) {
    case "BASISONDERWIJS":
      return ingestBasisonderwijsRecords();
    case "SECUNDAIR":
      return ingestSecundairRecords();
    default:
      return ingestDomainRecords(level);
  }
}

function armIdleTimer(
  entry: { lastAccessAt: number; unloadTimer: IdleTimer },
  ttlMs: number,
  onIdle: () => void,
  delay = ttlMs,
): void {
  // Eén timer per entry: hits passen alleen `lastAccessAt` aan en de timer
  // verlengt zichzelf, zodat een hit geen timers hoeft te vervangen.
  const timer = setTimeout(() => {
    entry.unloadTimer = null;
    const idle = Date.now() - entry.lastAccessAt;
    if (idle >= ttlMs) {
      onIdle();
    } else {
      armIdleTimer(entry, ttlMs, onIdle, ttlMs - idle);
    }
  }, delay);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
  entry.unloadTimer = timer;
}

function clearUnloadTimer(entry: { unloadTimer: IdleTimer }): void {
  if (entry.unloadTimer) {
    clearTimeout(entry.unloadTimer);
    entry.unloadTimer = null;
  }
}

function unloadLevel(level: CorpusLevel, reason: CorpusLevelUnloadReason): void {
  const entry = levelCache.get(level);
  if (!entry) {
    return;
  }

  clearUnloadTimer(entry);
  for (const absolutePath of entry.paths) {
    jsonlCache.delete(absolutePath);
  }
  levelCache.delete(level);
  notifyLevelUnload(level, reason);
}

/** Geeft een niveau expliciet vrij en maakt afgeleide indexen ervan ongeldig. */
export function unloadCorpusLevel(level: CorpusLevel): void {
  if (!levelCache.has(level)) {
    notifyLevelUnload(level, "reset");
    return;
  }
  unloadLevel(level, "reset");
}

function evictLeastRecentlyUsed(activeLevel: CorpusLevel): void {
  while (levelCache.size >= MAX_ACTIVE_LEVEL_CACHES) {
    let oldestLevel: CorpusLevel | null = null;
    let oldestAccess = Number.POSITIVE_INFINITY;

    for (const [level, entry] of levelCache) {
      if (level === activeLevel) {
        continue;
      }
      if (entry.lastAccessAt < oldestAccess) {
        oldestAccess = entry.lastAccessAt;
        oldestLevel = level;
      }
    }

    if (!oldestLevel) {
      return;
    }
    unloadLevel(oldestLevel, "evicted");
  }
}

function trackLoadedPaths(level: CorpusLevel): Set<string> {
  switch (level) {
    case "BASISONDERWIJS":
      return new Set([
        OPSTAP_CORPUS_PROD,
        OPSTAP_CORPUS_FIXTURE,
        OVSG_CORPUS_PROD,
        OVSG_CORPUS_FIXTURE,
        OVSG_NEW_CORPUS_PROD,
        GO_NIEUW_CORPUS_PROD,
        GO_NIEUW_CORPUS_FIXTURE,
        GO_OUD_CORPUS_PROD,
        GO_OUD_CORPUS_FIXTURE,
        ZILL_CORPUS_PROD,
        ZILL_CORPUS_FIXTURE,
        PRIMARY_MINIMUM_GOALS_PROD,
      ]);
    case "SECUNDAIR":
      return new Set(SECUNDAIR_PATHS);
    default: {
      const { prod, fixture } = DOMAIN_CORPUS_PATHS[level];
      return new Set(fixture ? [prod, fixture] : [prod]);
    }
  }
}

/** Goedkope vingerafdruk (mtime + grootte) van de bronbestanden van een niveau. */
function levelSignature(level: CorpusLevel): string {
  const parts: string[] = [];
  for (const absolutePath of trackLoadedPaths(level)) {
    try {
      const stats = statSync(absolutePath);
      parts.push(`${stats.mtimeMs}:${stats.size}`);
    } catch {
      parts.push("-");
    }
  }
  return parts.join("|");
}

function touchLoadedLevel(level: CorpusLevel, now: number): void {
  const entry = levelCache.get(level);
  if (entry) {
    entry.lastAccessAt = now;
  }
}

/**
 * Voert een synchrone leesactie uit die meerdere niveaus nodig heeft (bv. een
 * zoekopdracht over alle niveaus). Binnen de scope wordt niets verdrongen,
 * zodat elk niveau hoogstens één keer van schijf komt en reeds geladen niveaus
 * blijven staan. Na afloop worden de extra geladen niveaus weer vrijgegeven
 * tot de LRU-grens.
 */
export function withCorpusLevelScope<T>(task: () => T): T {
  levelScopeDepth += 1;
  try {
    return task();
  } finally {
    levelScopeDepth -= 1;
    if (levelScopeDepth === 0) {
      for (const level of levelsLoadedInScope.splice(0)) {
        if (levelCache.size <= MAX_ACTIVE_LEVEL_CACHES) {
          break;
        }
        unloadLevel(level, "evicted");
      }
    }
  }
}

export function getCorpusForLevel(level: CorpusLevel): RawRecord[] {
  const now = Date.now();
  const existing = levelCache.get(level);
  if (existing) {
    if (now - existing.checkedAt >= REVALIDATE_INTERVAL_MS) {
      if (levelSignature(level) !== existing.signature) {
        unloadLevel(level, "stale");
      } else {
        existing.checkedAt = now;
      }
    }
    if (levelCache.has(level)) {
      existing.lastAccessAt = now;
      return existing.records;
    }
  }

  if (levelScopeDepth > 0) {
    levelsLoadedInScope.push(level);
  } else {
    evictLeastRecentlyUsed(level);
  }

  // Signatuur vóór het lezen: een wijziging tijdens het lezen wordt dan bij de
  // volgende controle alsnog opgemerkt.
  const signature = levelSignature(level);
  const records = ingestRecordsForLevel(level);
  const paths = trackLoadedPaths(level);

  const entry: LevelCacheEntry = {
    records,
    paths,
    signature,
    checkedAt: now,
    lastAccessAt: now,
    unloadTimer: null,
  };
  levelCache.set(level, entry);
  armIdleTimer(entry, CACHE_TTL_MS, () => unloadLevel(level, "expired"));
  return records;
}

export type CorpusDerivedCache<T> = {
  /**
   * Geeft de afgeleide waarde voor `key`, of bouwt ze met `build`. `levels`
   * zijn de niveaus waarvan de waarde afhangt: verandert een bronbestand
   * daarvan, dan wordt opnieuw gebouwd.
   */
  get: (key: string, levels: readonly CorpusLevel[], build: () => T) => T;
  delete: (key: string) => void;
  clear: () => void;
  keys: () => string[];
};

type DerivedEntry<T> = {
  value: T;
  levels: readonly CorpusLevel[];
  signatures: string[];
  checkedAt: number;
  lastAccessAt: number;
  unloadTimer: IdleTimer;
};

/**
 * Begrensde cache voor indexen die uit corpusniveaus zijn afgeleid. Een entry
 * is een zelfstandige momentopname: het verdringen of verlopen van ruwe
 * niveaudata maakt haar niet ongeldig. Ze verdwijnt bij LRU-overschrijding,
 * na `ttlMs` zonder gebruik (hits verlengen dit) of zodra een bronbestand
 * gewijzigd is.
 */
export function createCorpusDerivedCache<T>({
  maxEntries,
  ttlMs = CACHE_TTL_MS,
}: {
  maxEntries: number;
  ttlMs?: number;
}): CorpusDerivedCache<T> {
  const entries = new Map<string, DerivedEntry<T>>();

  function drop(key: string): void {
    const entry = entries.get(key);
    if (!entry) {
      return;
    }
    clearUnloadTimer(entry);
    entries.delete(key);
  }

  function clear(): void {
    for (const key of [...entries.keys()]) {
      drop(key);
    }
  }

  derivedCaches.add({
    invalidateLevel(level) {
      for (const [key, entry] of [...entries]) {
        if (entry.levels.includes(level)) {
          drop(key);
        }
      }
    },
    clear,
  });

  return {
    get(key, levels, build) {
      const now = Date.now();
      const existing = entries.get(key);
      if (existing) {
        let usable = now - existing.lastAccessAt < ttlMs;
        if (usable && now - existing.checkedAt >= REVALIDATE_INTERVAL_MS) {
          usable = existing.levels.every(
            (level, position) =>
              levelSignature(level) === existing.signatures[position],
          );
          existing.checkedAt = now;
        }
        if (usable) {
          existing.lastAccessAt = now;
          entries.delete(key);
          entries.set(key, existing);
          for (const level of existing.levels) {
            touchLoadedLevel(level, now);
          }
          return existing.value;
        }
        drop(key);
      }

      const signatures = levels.map(levelSignature);
      // A raw level can still be inside its revalidation window. Never pair
      // its old contents with a fresh signature when constructing an index.
      levels.forEach((level, position) => {
        const raw = levelCache.get(level);
        if (raw && raw.signature !== signatures[position]) unloadLevel(level, "stale");
      });
      const value = withCorpusLevelScope(build);
      drop(key);
      while (entries.size >= Math.max(1, maxEntries)) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) {
          break;
        }
        drop(oldest);
      }
      const entry: DerivedEntry<T> = {
        value,
        levels: [...levels],
        signatures,
        checkedAt: now,
        lastAccessAt: now,
        unloadTimer: null,
      };
      entries.set(key, entry);
      armIdleTimer(entry, ttlMs, () => drop(key));
      return value;
    },
    delete: drop,
    clear,
    keys: () => [...entries.keys()],
  };
}

export const CORPUS_LEVELS: readonly CorpusLevel[] = [
  "BASISONDERWIJS",
  "SECUNDAIR",
  "BUBAO",
  "BUSO",
  "OKAN",
  "DKO",
  "VOLWASSENEN",
  "HOGER",
];

export function getCorpusForEducationLevel(
  educationLevel: EducationLevelFilter,
  network?: CurriculumNetworkFilter,
): RawRecord[] {
  return getCorpusForLevel(resolveCorpusLevel(educationLevel, network));
}

export function secondaryMinimumGoalRecords(): RawRecord[] {
  getCorpusForLevel("SECUNDAIR");
  return loadJsonlAt(SECONDARY_MINIMUM_GOALS_PROD);
}

export function isPovCorpusAvailable(): boolean {
  return existsSync(SECONDARY_POV_CURRICULUM_PROD);
}

export function resetCorpusLevelCache(): void {
  for (const level of [...levelCache.keys()]) {
    unloadLevel(level, "reset");
  }
  jsonlCache.clear();
  for (const cache of derivedCaches) {
    cache.clear();
  }
}

export function getActiveCorpusLevels(): CorpusLevel[] {
  return [...levelCache.keys()];
}

export function isJsonlPathLoaded(absolutePath: string): boolean {
  return jsonlCache.has(absolutePath);
}

export {
  OPSTAP_CORPUS_PROD,
  OPSTAP_CORPUS_FIXTURE,
  OVSG_CORPUS_PROD,
  OVSG_NEW_CORPUS_PROD,
  OVSG_CORPUS_FIXTURE,
  GO_NIEUW_CORPUS_PROD,
  GO_NIEUW_CORPUS_FIXTURE,
  GO_OUD_CORPUS_PROD,
  GO_OUD_CORPUS_FIXTURE,
  ZILL_CORPUS_PROD,
  ZILL_CORPUS_FIXTURE,
  SECONDARY_CURRICULUM_PROD,
  SECONDARY_MINIMUM_GOALS_PROD,
  SECONDARY_OVSG_CORPUS_PROD,
  PRIMARY_MINIMUM_GOALS_PROD,
  SECONDARY_POV_CURRICULUM_PROD,
  DOMAIN_CORPUS_PATHS,
};
