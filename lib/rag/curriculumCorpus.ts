import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type {
  CurriculumNetworkFilter,
  CurriculumSearchResult,
  LinkedMinimumGoal,
} from "@/types";
import { NETWORK_PATH } from "@/lib/rag/discoveryEngine";

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

function recordsForNetwork(
  network: CurriculumNetworkFilter | null,
): RawRecord[] {
  if (!network || network === "ALL") {
    return (
      Object.keys(CORPUS_FILES) as Array<Exclude<CurriculumNetworkFilter, "ALL">>
    ).flatMap((key) =>
      CORPUS_FILES[key].flatMap((file) => loadJsonl(file)),
    );
  }
  return CORPUS_FILES[network].flatMap((file) => loadJsonl(file));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
  };
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase("nl-BE")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
}

function scoreRecord(raw: RawRecord, queryTokens: Set<string>): number {
  const haystack = [
    raw.code,
    raw.titel,
    raw.text,
    raw.discipline,
    raw.leergebied,
    raw.subdomein,
    raw.toelichting,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("nl-BE");

  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      score += 1;
    }
  }
  return score;
}

export function findCorpusRecordByCode(
  code: string,
  network?: CurriculumNetworkFilter,
): CurriculumSearchResult | null {
  const needle = code.trim();
  if (!needle) {
    return null;
  }
  for (const raw of recordsForNetwork(network ?? "ALL")) {
    if (asString(raw.code) === needle) {
      return normalizeRecord(raw, networkFromRaw(raw));
    }
  }
  return null;
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

export function searchLocalCorpus({
  query,
  network,
  limit = 6,
}: {
  query: string;
  network?: CurriculumNetworkFilter;
  limit?: number;
}): Array<CurriculumSearchResult & { score: number }> {
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) {
    return [];
  }

  return recordsForNetwork(network ?? "ALL")
    .map((raw) => ({
      record: normalizeRecord(raw, networkFromRaw(raw)),
      score: scoreRecord(raw, queryTokens),
    }))
    .filter(
      (entry): entry is { record: CurriculumSearchResult; score: number } =>
        entry.record !== null && entry.score > 0,
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => ({ ...entry.record, score: entry.score / queryTokens.size }));
}

const CODE_PATTERNS = [
  /\b\d\.\d+\.[A-Z]{2}\d+(?:\.\d+)?\b/u,
  /\b[A-Z]{3}[a-z]{3}\d+[BOV]\.\d+\b/u,
  /\b[A-Z]{2,3}\.\d{3}\b/u,
  /\b[A-Z]{2,4}[a-z]{2}\d+\b/u,
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

export function enrichHitFromCorpus(
  hit: { snippet: string; link: string; network: CurriculumNetworkFilter | null },
  query: string,
): (CurriculumSearchResult & { score: number }) | null {
  const code = extractCodeFromSnippet(hit.snippet);
  if (code) {
    const byCode = findCorpusRecordByCode(code, hit.network ?? "ALL");
    if (byCode) {
      return { ...byCode, score: 0.95, snippet: hit.snippet, sourceUri: hit.link };
    }
  }

  const localPath = hit.link.includes("leerkrachtentools-curriculum/")
    ? hit.link.split("leerkrachtentools-curriculum/")[1]
    : null;
  if (localPath?.endsWith(".jsonl")) {
    const localMatches = searchLocalCorpus({
      query,
      network: hit.network ?? "ALL",
      limit: 1,
    });
    if (localMatches[0]) {
      return {
        ...localMatches[0],
        snippet: hit.snippet || localMatches[0].snippet,
        sourceUri: hit.link,
      };
    }
  }

  const titelMatch = hit.snippet.match(
    /(?:De leerlingen kunnen|De kleuters kunnen|De leerling)[^.]{8,220}\./u,
  );
  if (!titelMatch && !code) {
    return null;
  }

  return {
    code: code ?? "",
    discipline: inferDisciplineFromLink(hit.link),
    subdomein: "",
    titel: titelMatch?.[0] ?? hit.snippet.slice(0, 220),
    toelichting: "",
    leerjaarRoute: "",
    gelinktMinimumdoel: null,
    netwerk: hit.network ?? "ALL",
    bronUrl: inferBronUrl(hit.network),
    snippet: hit.snippet,
    sourceUri: hit.link,
    score: 0.55,
  };
}

function inferDisciplineFromLink(link: string): string {
  const file = link.split("/").pop()?.toLowerCase() ?? "";
  if (file.includes("nederlands")) return "Nederlands";
  if (file.includes("wiskunde")) return "Wiskunde";
  if (file.includes("geschiedenis")) return "Geschiedenis";
  if (file.includes("frans")) return "Frans";
  if (file.includes("opstap")) return "Op.stap";
  if (file.includes("ovsg")) return "OVSG LeerLokaal";
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

export function corpusFilesForNetwork(network: CurriculumNetworkFilter): string[] {
  if (network === "ALL") {
    return Object.values(CORPUS_FILES).flat();
  }
  return CORPUS_FILES[network];
}
