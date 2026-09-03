import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    vi.stubGlobal("window", {
      sessionStorage: createSessionStorageMock(),
    });
  });

  afterEach(() => {
    clearRagQueryCache();
    vi.unstubAllGlobals();
  });

  it("normaliseert queries voor exacte cache-sleutels", () => {
    expect(normalizeCachedQuery("  Optellen   Tot  Twintig  ")).toBe(
      "optellen tot twintig",
    );
    expect(buildRagQueryCacheKey("LAGER", "OPSTAP", "Optellen tot 20")).toBe(
      "LAGER:OPSTAP:optellen tot 20:||||||0",
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
});
