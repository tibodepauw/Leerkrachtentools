import { mkdirSync, mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return { ...fs, readFileSync: vi.fn(fs.readFileSync) };
});

type CorpusModules = {
  cache: typeof import("@/lib/rag/corpusLevelCache");
  corpus: typeof import("@/lib/rag/curriculumCorpus");
  minimumGoals: typeof import("@/lib/rag/minimumGoalCandidates");
  reads: () => string[];
  resetReads: () => void;
};

const FILES = {
  opstap: "data/opstap/opstap_volledig.jsonl",
  zill: "data/zill/zill_volledig.jsonl",
  secundair: "data/secundair/leerplannen_secundair.jsonl",
  okan: "data/okan/onderwijsdoelen_okan.jsonl",
  hoger: "data/hoger/onderwijsdoelen_hoger.jsonl",
} as const;

function jsonl(records: unknown[]): string {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

let root = "";

function write(relativePath: string, content: string): void {
  const absolutePath = path.join(root, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

/** Enkele regels per niveau: genoeg voor de cachelogica, verwaarloosbaar op schijf. */
function writeSmallCorpus(): void {
  write(
    FILES.opstap,
    jsonl([
      {
        code: "WI.1",
        titel: "De leerlingen tellen appels tot twintig",
        discipline: "Wiskunde",
        leeftijd: "6-7 jaar",
        gelinkt_minimumdoel: { code: "4-2.2.16", tekst: "Tellen tot twintig" },
      },
      { code: "NL.1", titel: "De leerlingen lezen een verhaal voor", discipline: "Nederlands" },
    ]),
  );
  write(
    FILES.zill,
    jsonl([{ code: "WI.1", titel: "Appels tellen en vergelijken in de kring", discipline: "Wiskunde" }]),
  );
  write(
    FILES.secundair,
    jsonl([
      { code: "SEC.1", titel: "Appels wegen in het labo", netwerk: "GO", onderwijsniveau: "Secundair", graad: "1ste graad" },
      { code: "SEC.2", titel: "Appels verkopen op de markt", netwerk: "KOV", onderwijsniveau: "Secundair", graad: "2de graad" },
      { code: "SEC.3", titel: "Appels tekenen zonder netwerk", onderwijsniveau: "Secundair", leerlijn: [] },
    ]),
  );
  write(
    FILES.okan,
    jsonl([
      { code: "OK.1", titel: "Appels benoemen in het Nederlands", onderwijsniveau: "OKAN" },
      { code: "OK.2", titel: "Appels kopen in de winkel", netwerk: "GO", onderwijsniveau: "OKAN" },
    ]),
  );
  write(FILES.hoger, jsonl([{ code: "HO.1", titel: "Appels onderzoeken in de opleiding", onderwijsniveau: "Hoger" }]));
}

async function loadModules(): Promise<CorpusModules> {
  vi.resetModules();
  const fs = await import("node:fs");
  const readSpy = vi.mocked(fs.readFileSync);
  readSpy.mockClear();
  const cache = await import("@/lib/rag/corpusLevelCache");
  const corpus = await import("@/lib/rag/curriculumCorpus");
  const minimumGoals = await import("@/lib/rag/minimumGoalCandidates");
  return {
    cache,
    corpus,
    minimumGoals,
    reads: () =>
      readSpy.mock.calls
        .map(([file]) => String(file))
        .filter((file) => file.startsWith(root))
        .map((file) => path.relative(root, file)),
    resetReads: () => readSpy.mockClear(),
  };
}

describe("corpuscache met kleine fixtures op schijf", () => {
  let modules: CorpusModules;

  it("bouwt een nieuwe index uit actuele data wanneer een warm niveau tussentijds wijzigt", () => {
    vi.useFakeTimers();
    const { corpus, cache } = modules;
    expect(cache.getCorpusForLevel("OKAN")).toHaveLength(2);
    appendFileSync(path.join(root, FILES.okan), jsonl([{ code: "OK.3", titel: "Peren plukken in de boomgaard", onderwijsniveau: "OKAN" }]));
    vi.advanceTimersByTime(5_000);
    const search = () => corpus.searchLocalCorpus({ query: "peren plukken boomgaard", network: "ALL", educationLevel: "OKAN" });
    expect(search().some((record) => record.code === "OK.3")).toBe(true);
    for (let minute = 0; minute < 3; minute++) {
      vi.advanceTimersByTime(60_000);
      expect(search().some((record) => record.code === "OK.3")).toBe(true);
    }
  });

  beforeEach(async () => {
    root = mkdtempSync(path.join(tmpdir(), "leerkrachtentools-corpus-"));
    vi.spyOn(process, "cwd").mockReturnValue(root);
    writeSmallCorpus();
    modules = await loadModules();
  });

  afterEach(() => {
    modules.cache.resetCorpusLevelCache();
    vi.useRealTimers();
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it("leest elk bestand één keer voor een zoekopdracht over alle niveaus en daarna niet meer", () => {
    const { corpus, cache, reads, resetReads } = modules;

    const first = corpus.searchLocalCorpus({ query: "appels tellen", network: "ALL", educationLevel: "ALL" });
    expect(first.length).toBeGreaterThan(0);
    expect(reads().sort()).toEqual(Object.values(FILES).sort());
    expect(cache.getActiveCorpusLevels().length).toBeLessThanOrEqual(2);

    resetReads();
    expect(corpus.searchLocalCorpus({ query: "appels tellen", network: "ALL", educationLevel: "ALL" })).toEqual(first);
    expect(corpus.searchLocalCorpus({ query: "verhaal lezen", network: "ALL", educationLevel: "ALL" })[0]?.code).toBe("NL.1");
    expect(reads()).toEqual([]);
  });

  it("herleest niets bij codeopzoekingen en matches per netwerk over alle niveaus", () => {
    const { corpus, reads, resetReads } = modules;
    corpus.warmCorpusTokenIndex("ALL", "ALL");
    resetReads();

    expect(corpus.findCorpusRecordByCode("WI.1", "ZILL", "ALL")?.netwerk).toBe("ZILL");
    expect(corpus.findCorpusRecordByCode("WI.1", "OPSTAP", "ALL")?.netwerk).toBe("OPSTAP");
    expect(corpus.findCorpusRecordByCode("WI.1", "ALL", "ALL")?.netwerk).toBe("OPSTAP");
    expect(corpus.findCorpusRecordByCode("SEC.2", "KOV", "ALL")?.titel).toContain("markt");
    expect(corpus.findCorpusRecordByCode("SEC.2", "GO", "ALL")).toBeNull();
    expect(corpus.findCorpusRecordByCode("BESTAAT.NIET", "ALL", "ALL")).toBeNull();
    for (const network of ["OPSTAP", "OVSG", "GO_NIEUW", "GO_OUD", "ZILL", "GO", "KOV", "POV"] as const) {
      corpus.findBestCorpusMatch({ snippet: "appels", query: "appels wegen", network, educationLevel: "ALL" });
    }
    expect(
      corpus.findBestCorpusMatch({ snippet: "", query: "appels wegen labo", network: "GO", educationLevel: "ALL" })?.code,
    ).toBe("SEC.1");
    expect(reads()).toEqual([]);
  });

  it("bouwt een netwerkindex over alle niveaus als exacte deelverzameling", () => {
    const { corpus } = modules;
    for (const network of ["ALL", "OPSTAP", "OVSG", "GO_NIEUW", "GO_OUD", "ZILL", "GO", "KOV", "POV"] as const) {
      expect(corpus.corpusIndexRawRecords(network, "ALL")).toEqual(corpus.recordsForNetwork(network, "ALL"));
    }
    const allCodes = corpus.corpusIndexRawRecords("ALL", "ALL").map((raw) => raw.code);
    const goCodes = corpus.corpusIndexRawRecords("GO", "ALL").map((raw) => raw.code);
    expect(allCodes).toContain("SEC.3");
    expect(goCodes).toEqual(["SEC.1", "OK.2"]);
  });

  it("verdringt een al geladen niveau niet tijdens een zoekopdracht over alle niveaus", () => {
    const { corpus, cache, reads, resetReads } = modules;
    corpus.searchLocalCorpus({ query: "appels tellen", network: "ALL", educationLevel: "LAGER" });
    expect(cache.getActiveCorpusLevels()).toEqual(["BASISONDERWIJS"]);

    corpus.searchLocalCorpus({ query: "appels tellen", network: "ALL", educationLevel: "ALL" });
    expect(cache.getActiveCorpusLevels()).toContain("BASISONDERWIJS");
    expect(cache.getActiveCorpusLevels().length).toBeLessThanOrEqual(2);

    resetReads();
    expect(cache.getCorpusForLevel("BASISONDERWIJS").length).toBe(3);
    corpus.searchLocalCorpus({ query: "appels tellen", network: "ALL", educationLevel: "LAGER" });
    expect(reads()).toEqual([]);
  });

  it("houdt hoogstens twee ruwe niveaus vast en herlaadt een verdrongen niveau op aanvraag", () => {
    const { corpus, cache, reads, resetReads } = modules;
    corpus.searchLocalCorpus({ query: "appels benoemen", network: "ALL", educationLevel: "OKAN" });
    cache.getCorpusForLevel("BASISONDERWIJS");
    cache.getCorpusForLevel("SECUNDAIR");
    expect(cache.getActiveCorpusLevels()).toEqual(["BASISONDERWIJS", "SECUNDAIR"]);

    // De OKAN-index is een eigen momentopname en overleeft de verdringing.
    resetReads();
    expect(
      corpus.searchLocalCorpus({ query: "appels benoemen", network: "ALL", educationLevel: "OKAN" })[0]?.code,
    ).toBe("OK.1");
    expect(reads()).toEqual([]);

    expect(cache.getCorpusForLevel("OKAN")).toHaveLength(2);
    expect(reads()).toEqual([FILES.okan]);
    expect(cache.getActiveCorpusLevels()).toHaveLength(2);
    expect(cache.getActiveCorpusLevels()).toContain("OKAN");
  });

  it("houdt hoogstens tien indexen vast", () => {
    const { corpus, cache, reads, resetReads } = modules;
    const levels = ["ALL", "LAGER", "SECUNDAIR", "OKAN", "HOGER"] as const;
    const networks = ["ALL", "OPSTAP", "ZILL", "GO", "KOV"] as const;
    for (const educationLevel of levels) {
      for (const network of networks) {
        corpus.warmCorpusTokenIndex(network, educationLevel);
      }
    }
    expect(cache.getActiveCorpusLevels().length).toBeLessThanOrEqual(2);

    // De laatst gebouwde indexen zijn nog warm, de oudste zijn verdrongen.
    resetReads();
    corpus.warmCorpusTokenIndex("KOV", "HOGER");
    expect(reads()).toEqual([]);
    corpus.warmCorpusTokenIndex("ALL", "ALL");
    expect(reads().length).toBeGreaterThan(0);
  });

  it("slaat een corrupte regel over, behoudt de rest en leest het bestand niet opnieuw", () => {
    const { corpus, cache, reads, resetReads } = modules;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    write(
      FILES.okan,
      [
        JSON.stringify({ code: "OK.1", titel: "Appels benoemen in het Nederlands", onderwijsniveau: "OKAN" }),
        '{"code":"OK.KAPOT","titel":"GEHEIM-leerlinggegeven",',
        "[1,2,3]",
        '"losse tekst"',
        "null",
        JSON.stringify({ code: "OK.2", titel: "Appels kopen in de winkel", onderwijsniveau: "OKAN" }),
      ].join("\r\n"),
    );

    expect(cache.getCorpusForLevel("OKAN").map((raw) => raw.code)).toEqual(["OK.1", "OK.2"]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[1]).toEqual({ file: "onderwijsdoelen_okan.jsonl", skipped: 4, kept: 2 });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("GEHEIM");
    expect(JSON.stringify(warn.mock.calls)).not.toContain(root);

    resetReads();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(
        corpus.searchLocalCorpus({ query: "appels kopen winkel", network: "ALL", educationLevel: "OKAN" })[0]?.code,
      ).toBe("OK.2");
      expect(cache.getCorpusForLevel("OKAN")).toHaveLength(2);
    }
    expect(reads()).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("cachet ook een volledig onleesbaar bestand in plaats van het eindeloos te herladen", () => {
    const { corpus, cache, reads } = modules;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    write(FILES.hoger, "geen json\n{ook niet\n");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(cache.getCorpusForLevel("HOGER")).toEqual([]);
      expect(corpus.searchLocalCorpus({ query: "appels onderzoeken", network: "ALL", educationLevel: "HOGER" })).toEqual([]);
    }
    expect(reads()).toEqual([FILES.hoger]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("ververst niveau en index nadat een bronbestand gewijzigd is", () => {
    vi.useFakeTimers();
    const { corpus, cache, reads, resetReads } = modules;
    const search = () =>
      corpus.searchLocalCorpus({ query: "peren plukken boomgaard", network: "ALL", educationLevel: "OKAN" });
    expect(search()).toEqual([]);
    expect(cache.getCorpusForLevel("OKAN")).toHaveLength(2);

    appendFileSync(
      path.join(root, FILES.okan),
      jsonl([{ code: "OK.3", titel: "Peren plukken in de boomgaard", onderwijsniveau: "OKAN" }]),
    );

    // Binnen het controle-interval blijft de momentopname staan, zonder schijftoegang.
    resetReads();
    vi.advanceTimersByTime(5_000);
    expect(search()).toEqual([]);
    expect(reads()).toEqual([]);

    vi.advanceTimersByTime(30_000);
    expect(search()[0]?.code).toBe("OK.3");
    expect(cache.getCorpusForLevel("OKAN")).toHaveLength(3);
    expect(reads()).toEqual([FILES.okan]);
  });

  it("geeft een ongebruikt niveau na vijf minuten vrij en laat indexhits dat uitstellen", () => {
    vi.useFakeTimers();
    const { corpus, cache, reads, resetReads } = modules;
    const search = () =>
      corpus.searchLocalCorpus({ query: "appels benoemen", network: "ALL", educationLevel: "OKAN" });
    search();
    expect(cache.getActiveCorpusLevels()).toEqual(["OKAN"]);

    vi.advanceTimersByTime(4 * 60_000);
    search();
    vi.advanceTimersByTime(2 * 60_000);
    expect(cache.getActiveCorpusLevels()).toEqual(["OKAN"]);

    resetReads();
    search();
    expect(reads()).toEqual([]);

    vi.advanceTimersByTime(5 * 60_000 + 1_000);
    expect(cache.getActiveCorpusLevels()).toEqual([]);
    expect(search()[0]?.code).toBe("OK.1");
    expect(reads()).toEqual([FILES.okan]);
  });

  it("herleest niets bij een herhaalde minimumdoelzoekopdracht over alle niveaus", () => {
    const { minimumGoals, cache, reads, resetReads } = modules;
    minimumGoals.warmMinimumGoalTokenIndex("ALL");
    expect(cache.getActiveCorpusLevels().length).toBeLessThanOrEqual(2);

    resetReads();
    minimumGoals.warmMinimumGoalTokenIndex("ALL");
    minimumGoals.collectMinimumGoalCandidates({ query: "tellen tot twintig", educationLevel: "ALL", limit: 5 });
    expect(reads()).toEqual([]);
  });

  it("gebruikt snippet en titel als de zoektekst zelf geen kandidaten oplevert", () => {
    const { corpus } = modules;
    const match = corpus.findBestCorpusMatch({
      snippet: "Appels wegen in het labo",
      query: "qqqq",
      title: "Leerplan",
      network: "ALL",
      educationLevel: "SECUNDAIR",
      relaxed: true,
    });
    expect(match?.code).toBe("SEC.1");
    expect(
      corpus.findBestCorpusMatch({ snippet: "Appels wegen in het labo", query: "qqqq", network: "ALL", educationLevel: "SECUNDAIR" }),
    ).toBeNull();
  });
});
