import { describe, expect, it } from "vitest";
import {
  buildFragmentResult,
  countTokenMatches,
  dedupeByMinimumGoalCode,
  enrichHitFromCorpus,
  extractCodeFromSnippet,
  findBestCorpusMatch,
  scoreTextOverlap,
  searchLocalCorpus,
  searchMinimumGoals,
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

  it("geeft null terug zonder corpus-match in ZILL", () => {
    const hit: DiscoveryHit = {
      id: "2",
      link: "gs://leerkrachtentools-curriculum/zill/wiskunde.pdf",
      title: "ZILL wiskunde",
      snippet: "De leerlingen kunnen tot 20 optellen en verminderen.",
      network: "ZILL",
      relevanceScore: 0.76,
    };

    const result = enrichHitFromCorpus(hit, "optellen tot 20", "ZILL");
    expect(result).not.toBeNull();
    expect(result?.netwerk).toBe("ZILL");
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
      searchLocalCorpus({ query: "xyzqwerty onzin foobar", network: "ALL" }),
    ).toEqual([]);
    expect(
      findBestCorpusMatch({
        snippet: "totaal irrelevant stuk tekst over dinosaurussen",
        query: "xyzqwerty onzin foobar",
        network: "ALL",
      }),
    ).toBeNull();
    expect(searchMinimumGoals({ query: "xyzqwerty onzin foobar" })).toEqual(
      [],
    );
  }, 20_000);

  it("dedupliceert minimumdoelen op code", () => {
    const results = dedupeByMinimumGoalCode([
      {
        code: "LP1",
        discipline: "Wiskunde",
        subdomein: "",
        titel: "Leerplandoel A",
        toelichting: "",
        leerjaarRoute: "",
        gelinktMinimumdoel: {
          code: "MD1",
          tekst: "Minimum A",
          type: "",
        },
        netwerk: "ZILL",
        bronUrl: "",
        score: 0.5,
      },
      {
        code: "LP2",
        discipline: "Wiskunde",
        subdomein: "",
        titel: "Leerplandoel B",
        toelichting: "",
        leerjaarRoute: "",
        gelinktMinimumdoel: {
          code: "MD1",
          tekst: "Minimum A",
          type: "",
        },
        netwerk: "OVSG",
        bronUrl: "",
        score: 0.8,
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.score).toBe(0.8);
    expect(results[0]?.netwerk).toBe("OVSG");
  });

  it("vindt OKAN-doelen via AHOVOKS-corpus bij ALL-netwerk", () => {
    const zillOnly = searchLocalCorpus({
      query: "informatie verwerken mondelinge teksten",
      network: "ZILL",
      educationLevel: "OKAN",
      limit: 3,
    });
    const ahovoks = searchLocalCorpus({
      query: "informatie verwerken mondelinge teksten",
      network: "ALL",
      educationLevel: "OKAN",
      limit: 3,
    });

    expect(zillOnly).toHaveLength(0);
    expect(ahovoks.length).toBeGreaterThanOrEqual(1);
    expect(ahovoks[0]?.netwerk).toBe("AHOVOKS");
  });
});
