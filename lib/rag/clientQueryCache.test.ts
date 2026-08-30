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
      "LAGER:OPSTAP:optellen tot 20",
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
