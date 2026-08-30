import { afterEach, describe, expect, it } from "vitest";
import {
  getActiveCorpusLevels,
  getCorpusForLevel,
  normalizeCorpusLevel,
  resetCorpusLevelCache,
  resolveCorpusLevel,
} from "@/lib/rag/corpusLevelCache";

describe("corpusLevelCache", () => {
  afterEach(() => {
    resetCorpusLevelCache();
  });

  it("mapt kleuter/lager naar basisonderwijs-corpus", () => {
    expect(normalizeCorpusLevel("KLEUTER")).toBe("BASISONDERWIJS");
    expect(normalizeCorpusLevel("LAGER")).toBe("BASISONDERWIJS");
    expect(resolveCorpusLevel("ALL", "ZILL")).toBe("BASISONDERWIJS");
    expect(resolveCorpusLevel("ALL", "GO")).toBe("SECUNDAIR");
  });

  it("laadt alleen het corpus voor het gevraagde niveau", () => {
    const basisonderwijs = getCorpusForLevel("BASISONDERWIJS");
    expect(basisonderwijs.length).toBeGreaterThan(0);
    expect(getActiveCorpusLevels()).toContain("BASISONDERWIJS");

    resetCorpusLevelCache();

    const okan = getCorpusForLevel("OKAN");
    expect(okan.length).toBeGreaterThanOrEqual(0);
    expect(getActiveCorpusLevels()).toEqual(["OKAN"]);
    expect(
      basisonderwijs.some((record) =>
        String(record.onderwijsniveau ?? "").toUpperCase().includes("OKAN"),
      ),
    ).toBe(false);
  });

  it("houdt maximaal twee actieve niveau-caches", () => {
    getCorpusForLevel("BASISONDERWIJS");
    getCorpusForLevel("SECUNDAIR");
    getCorpusForLevel("OKAN");

    expect(getActiveCorpusLevels().length).toBeLessThanOrEqual(2);
    expect(getActiveCorpusLevels()).toContain("OKAN");
  });
});
