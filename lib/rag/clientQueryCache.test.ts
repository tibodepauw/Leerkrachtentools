import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setActiveUserId } from "@/lib/storage/userStorageScope";
import { clearTemporaryStorage } from "@/lib/storage/sharedDevice";
import {
  buildRagQueryCacheKey,
  clearRagQueryCache,
  normalizeCachedQuery,
  readRagQueryCache,
  writeRagQueryCache,
} from "@/lib/rag/clientQueryCache";

function createSessionStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe("clientQueryCache", () => {
  beforeEach(() => {
    setActiveUserId("cache-user-A");
    clearTemporaryStorage();
    vi.stubGlobal("window", {
      sessionStorage: createSessionStorageMock(),
      localStorage: createSessionStorageMock(),
    });
  });

  afterEach(() => {
    clearRagQueryCache();
    setActiveUserId(null);
    clearTemporaryStorage();
    vi.unstubAllGlobals();
  });

  it("never reads another account's cache for the same query", () => {
    writeRagQueryCache("rag-curriculum", "LAGER", "ALL", "same", { data: { goal: "private A" }, provider: "test", fallbackErrors: [] });
    setActiveUserId("cache-user-B");
    expect(readRagQueryCache("rag-curriculum", "LAGER", "ALL", "same")).toBeNull();
  });
  it("keeps shared-device results in memory and removes a prior persisted cache", () => {
    writeRagQueryCache("rag-curriculum", "LAGER", "ALL", "same", { data: { goal: "old A" }, provider: "test", fallbackErrors: [] });
    window.localStorage.setItem("leerkrachtentools-shared-device", "true");
    expect(readRagQueryCache("rag-curriculum", "LAGER", "ALL", "same")).toBeNull();
    writeRagQueryCache("rag-curriculum", "LAGER", "ALL", "same", { data: { goal: "private A" }, provider: "test", fallbackErrors: [] });
    expect(readRagQueryCache("rag-curriculum", "LAGER", "ALL", "same")).not.toBeNull();
    expect(window.sessionStorage.length).toBe(0);
    clearTemporaryStorage();
    expect(readRagQueryCache("rag-curriculum", "LAGER", "ALL", "same")).toBeNull();
  });
  it("does not store or return query results without an active account", () => {
    setActiveUserId(null);
    writeRagQueryCache("rag-curriculum", "LAGER", "ALL", "same", { data: { goal: "private" }, provider: "test", fallbackErrors: [] });
    expect(readRagQueryCache("rag-curriculum", "LAGER", "ALL", "same")).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("normaliseert queries voor exacte cache-sleutels", () => {
    expect(normalizeCachedQuery("  Optellen   Tot  Twintig  ")).toBe(
      "optellen tot twintig",
    );
    expect(buildRagQueryCacheKey("LAGER", "OPSTAP", "Optellen tot 20")).toBe(
      "LAGER:OPSTAP:optellen tot 20:||||||0|snel",
    );
  });

  it("schrijft en leest unieke resultaten per endpoint", () => {
    writeRagQueryCache(
      "rag-curriculum",
      "LAGER",
      "OPSTAP",
      "optellen tot 20",
      {
        data: { goal: "A", alternatives: [] },
        provider: "jsonl-corpus",
        fallbackErrors: [],
      },
    );
    writeRagQueryCache(
      "rag-minimum-goals",
      "LAGER",
      "-",
      "optellen tot 20",
      {
        data: { goal: "B", alternatives: [] },
        provider: "jsonl-corpus",
        fallbackErrors: [],
      },
    );

    expect(
      readRagQueryCache<{ goal: string }>(
        "rag-curriculum",
        "LAGER",
        "OPSTAP",
        "optellen tot 20",
      )?.data.goal,
    ).toBe("A");
    expect(
      readRagQueryCache<{ goal: string }>(
        "rag-minimum-goals",
        "LAGER",
        "-",
        "optellen tot 20",
      )?.data.goal,
    ).toBe("B");
  });

  it("houdt cache-sleutels uit elkaar per graadfilter", () => {
    writeRagQueryCache(
      "rag-curriculum",
      "SECUNDAIR",
      "GO",
      "klimaat",
      {
        data: { goal: "graad1" },
        provider: "jsonl-corpus",
        fallbackErrors: [],
      },
      { secondaryGrade: "1ste_graad" },
    );
    writeRagQueryCache(
      "rag-curriculum",
      "SECUNDAIR",
      "GO",
      "klimaat",
      {
        data: { goal: "graad2" },
        provider: "jsonl-corpus",
        fallbackErrors: [],
      },
      { secondaryGrade: "2de_graad" },
    );

    expect(
      readRagQueryCache<{ goal: string }>(
        "rag-curriculum",
        "SECUNDAIR",
        "GO",
        "klimaat",
        { secondaryGrade: "1ste_graad" },
      )?.data.goal,
    ).toBe("graad1");
    expect(
      readRagQueryCache<{ goal: string }>(
        "rag-curriculum",
        "SECUNDAIR",
        "GO",
        "klimaat",
        { secondaryGrade: "2de_graad" },
      )?.data.goal,
    ).toBe("graad2");
  });

  it("wist cache volledig bij clearRagQueryCache", () => {
    writeRagQueryCache("rag-curriculum", "KLEUTER", "ZILL", "slaan", {
      data: { goal: "X", alternatives: [] },
      provider: "test",
      fallbackErrors: [],
    });

    clearRagQueryCache();

    expect(
      readRagQueryCache("rag-curriculum", "KLEUTER", "ZILL", "slaan"),
    ).toBeNull();
  });

  it("houdt Snel- en Pro-resultaten in aparte cache-sleutels", () => {
    writeRagQueryCache(
      "rag-curriculum",
      "LAGER",
      "ALL",
      "emoties uitbeelden",
      {
        data: { goal: "snel" },
        provider: "jsonl-corpus",
        fallbackErrors: [],
      },
      { searchMode: "snel" },
    );
    writeRagQueryCache(
      "rag-curriculum",
      "LAGER",
      "ALL",
      "emoties uitbeelden",
      {
        data: { goal: "pro" },
        provider: "jsonl-corpus",
        fallbackErrors: [],
      },
      { searchMode: "pro" },
    );

    expect(
      readRagQueryCache<{ goal: string }>(
        "rag-curriculum",
        "LAGER",
        "ALL",
        "emoties uitbeelden",
        { searchMode: "snel" },
      )?.data.goal,
    ).toBe("snel");
    expect(
      readRagQueryCache<{ goal: string }>(
        "rag-curriculum",
        "LAGER",
        "ALL",
        "emoties uitbeelden",
        { searchMode: "pro" },
      )?.data.goal,
    ).toBe("pro");
  });

  it("slaat lege zoekresultaten niet op", () => {
    writeRagQueryCache(
      "rag-minimum-goals",
      "BASISONDERWIJS",
      "-",
      "open en gesloten lettergreep",
      {
        data: { goal: "niet gevonden", alternatives: [] },
        provider: "jsonl-corpus",
        fallbackErrors: [],
      },
    );

    expect(
      readRagQueryCache(
        "rag-minimum-goals",
        "BASISONDERWIJS",
        "-",
        "open en gesloten lettergreep",
      ),
    ).toBeNull();
  });
});
