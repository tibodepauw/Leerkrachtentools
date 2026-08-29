import { describe, expect, it } from "vitest";
import {
  buildFragmentResult,
  countTokenMatches,
  enrichHitFromCorpus,
  extractCodeFromSnippet,
  findBestCorpusMatch,
  scoreTextOverlap,
  searchLocalCorpus,
  tokenize,
} from "@/lib/rag/curriculumCorpus";
import type { DiscoveryHit } from "@/lib/rag/discoveryEngine";

describe("curriculumCorpus matching", () => {
  it("telt token-overlap voor relevantie", () => {
    const tokens = tokenize("optellen tot twintig");
    expect(countTokenMatches("De leerlingen kunnen tot twintig optellen", tokens)).toBeGreaterThanOrEqual(2);
    expect(scoreTextOverlap("De leerlingen kunnen tot twintig optellen", tokens)).toBeGreaterThan(0.2);
  });

  it("haalt doelcodes uit snippets", () => {
    expect(extractCodeFromSnippet("Leerplandoel MUva1 over muziek")).toBe("MUva1");
    expect(extractCodeFromSnippet("Leerplandoel OWti3 over tijdlijnen")).toBe("OWti3");
  });

  it("bouwt een fragmentresultaat zonder corpus-match", () => {
    const hit: DiscoveryHit = {
      id: "1",
      link: "gs://leerkrachtentools-curriculum/opstap/wiskunde.pdf",
      title: "Wiskunde leerplan",
      snippet:
        "De leerlingen kunnen tot 20 optellen met concrete materialen en visuele ondersteuning.",
      network: "OPSTAP",
      relevanceScore: 0.81,
    };

    const result = buildFragmentResult(hit);
    expect(result.verrijking).toBe("fragment");
    expect(result.titel).toContain("optellen");
    expect(result.bronTitel).toBe("Wiskunde leerplan");
    expect(result.score).toBe(0.81);
    expect(result.netwerk).toBe("OPSTAP");
  });

  it("geeft null terug zonder corpus-match", () => {
    const hit: DiscoveryHit = {
      id: "2",
      link: "gs://leerkrachtentools-curriculum/zill/wiskunde.pdf",
      title: "ZILL wiskunde",
      snippet: "De leerlingen kunnen tot 20 optellen en verminderen.",
      network: "ZILL",
      relevanceScore: 0.76,
    };

    expect(enrichHitFromCorpus(hit, "optellen tot 20", "ZILL")).toBeNull();
  });

  it("weigert verkeerd netwerk bij strikt filter", () => {
    const hit: DiscoveryHit = {
      id: "3",
      link: "gs://leerkrachtentools-curriculum/ovsg/wiskunde.pdf",
      title: "OVSG wiskunde",
      snippet: "De leerlingen kunnen tot 20 optellen.",
      network: "OVSG",
      relevanceScore: 0.7,
    };

    expect(enrichHitFromCorpus(hit, "optellen tot 20", "OPSTAP")).toBeNull();
  });

  it("geeft lege lokale fallback bij te weinig overlap", () => {
    expect(
      searchLocalCorpus({ query: "meteoriet inslag dinosaurussen", network: "ALL" }),
    ).toEqual([]);
    expect(
      findBestCorpusMatch({
        snippet: "totaal irrelevant stuk tekst over dinosaurussen",
        query: "meteoriet inslag dinosaurussen",
        network: "ALL",
      }),
    ).toBeNull();
  });
});
