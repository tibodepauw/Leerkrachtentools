import { readFileSync, existsSync } from "node:fs";
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
  SECONDARY_POV_CURRICULUM_PROD,
  SECONDARY_MINIMUM_GOALS_PROD,
];

type LevelCacheEntry = {
  records: RawRecord[];
  paths: Set<string>;
  lastAccessAt: number;
  unloadTimer: ReturnType<typeof setTimeout> | null;
};

const jsonlCache = new Map<string, RawRecord[]>();
const levelCache = new Map<CorpusLevel, LevelCacheEntry>();
const levelUnloadListeners = new Set<(level: CorpusLevel) => void>();

export function registerCorpusLevelUnloadListener(
  listener: (level: CorpusLevel) => void,
): () => void {
  levelUnloadListeners.add(listener);
  return () => levelUnloadListeners.delete(listener);
}

function notifyLevelUnload(level: CorpusLevel): void {
  for (const listener of levelUnloadListeners) {
    listener(level);
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
    case "ZILL":
      return "BASISONDERWIJS";
    default:
      return "BASISONDERWIJS";
  }
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
  const records = readFileSync(absolutePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RawRecord);
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

function basisonderwijsLoadPaths(): string[] {
  return [
    OPSTAP_CORPUS_PROD,
    OVSG_CORPUS_PROD,
    GO_NIEUW_CORPUS_PROD,
    ZILL_CORPUS_PROD,
  ];
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
  return [
    ...tagNetwork(
      loadCorpusWithFallback(OPSTAP_CORPUS_PROD, OPSTAP_CORPUS_FIXTURE),
      "OPSTAP",
    ),
    ...tagNetwork(
      loadCorpusWithFallback(OVSG_CORPUS_PROD, OVSG_CORPUS_FIXTURE),
      "OVSG",
    ),
    ...tagNetwork(
      loadCorpusWithFallback(GO_NIEUW_CORPUS_PROD, GO_NIEUW_CORPUS_FIXTURE),
      "GO_NIEUW",
    ),
    ...tagNetwork(
      loadCorpusWithFallback(ZILL_CORPUS_PROD, ZILL_CORPUS_FIXTURE),
      "ZILL",
    ),
  ];
}

function ingestSecundairRecords(): RawRecord[] {
  return [
    ...loadJsonlAt(SECONDARY_CURRICULUM_PROD),
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

function clearUnloadTimer(entry: LevelCacheEntry): void {
  if (entry.unloadTimer) {
    clearTimeout(entry.unloadTimer);
    entry.unloadTimer = null;
  }
}

export function unloadCorpusLevel(level: CorpusLevel): void {
  const entry = levelCache.get(level);
  if (!entry) {
    return;
  }

  clearUnloadTimer(entry);
  for (const absolutePath of entry.paths) {
    jsonlCache.delete(absolutePath);
  }
  levelCache.delete(level);
  notifyLevelUnload(level);
}

function scheduleUnload(level: CorpusLevel, entry: LevelCacheEntry): void {
  clearUnloadTimer(entry);
  entry.unloadTimer = setTimeout(() => {
    unloadCorpusLevel(level);
  }, CACHE_TTL_MS);
  if (typeof entry.unloadTimer.unref === "function") {
    entry.unloadTimer.unref();
  }
}

function evictLeastRecentlyUsed(activeLevel: CorpusLevel): void {
  if (levelCache.size < MAX_ACTIVE_LEVEL_CACHES) {
    return;
  }

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

  if (oldestLevel) {
    unloadCorpusLevel(oldestLevel);
  }
}

function trackLoadedPaths(level: CorpusLevel): Set<string> {
  const paths = new Set<string>();
  switch (level) {
    case "BASISONDERWIJS":
      for (const prodPath of basisonderwijsLoadPaths()) {
        paths.add(prodPath);
        if (prodPath === OPSTAP_CORPUS_PROD) paths.add(OPSTAP_CORPUS_FIXTURE);
        if (prodPath === OVSG_CORPUS_PROD) paths.add(OVSG_CORPUS_FIXTURE);
        if (prodPath === GO_NIEUW_CORPUS_PROD) paths.add(GO_NIEUW_CORPUS_FIXTURE);
        if (prodPath === ZILL_CORPUS_PROD) paths.add(ZILL_CORPUS_FIXTURE);
      }
      break;
    case "SECUNDAIR":
      for (const prodPath of SECUNDAIR_PATHS) {
        paths.add(prodPath);
      }
      break;
    default: {
      const { prod, fixture } = DOMAIN_CORPUS_PATHS[level];
      paths.add(prod);
      if (fixture) {
        paths.add(fixture);
      }
    }
  }
  return paths;
}

export function getCorpusForLevel(level: CorpusLevel): RawRecord[] {
  const existing = levelCache.get(level);
  if (existing) {
    existing.lastAccessAt = Date.now();
    scheduleUnload(level, existing);
    return existing.records;
  }

  evictLeastRecentlyUsed(level);

  const records = ingestRecordsForLevel(level);
  const paths = trackLoadedPaths(level);
  for (const absolutePath of paths) {
    if (!jsonlCache.has(absolutePath) && existsSync(absolutePath)) {
      loadJsonlAt(absolutePath);
    }
  }

  const entry: LevelCacheEntry = {
    records,
    paths,
    lastAccessAt: Date.now(),
    unloadTimer: null,
  };
  levelCache.set(level, entry);
  scheduleUnload(level, entry);
  return records;
}

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
    unloadCorpusLevel(level);
  }
  jsonlCache.clear();
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
  OVSG_CORPUS_FIXTURE,
  GO_NIEUW_CORPUS_PROD,
  GO_NIEUW_CORPUS_FIXTURE,
  ZILL_CORPUS_PROD,
  ZILL_CORPUS_FIXTURE,
  SECONDARY_CURRICULUM_PROD,
  SECONDARY_MINIMUM_GOALS_PROD,
  SECONDARY_POV_CURRICULUM_PROD,
  DOMAIN_CORPUS_PATHS,
};
