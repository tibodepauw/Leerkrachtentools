import { describe, expect, it } from "vitest";
import {
  extractRelevanceScore,
  networkFromUri,
  titleFromLink,
} from "@/lib/rag/discoveryEngine";

describe("discoveryEngine helpers", () => {
  it("haalt titels uit GCS-paden", () => {
    expect(
      titleFromLink("gs://leerkrachtentools-curriculum/opstap/wiskunde_leerplan.pdf"),
    ).toBe("wiskunde leerplan");
  });

  it("onderscheidt oude GO!-basisplannen van GO! secundair", () => {
    expect(
      networkFromUri(
        "gs://leerkrachtentools-curriculum/go/leerplan_nederlands.pdf",
      ),
    ).toBe("GO_OUD");
    expect(
      networkFromUri(
        "gs://leerkrachtentools-curriculum/secundair/leerplannen_secundair_go.txt",
      ),
    ).toBe("GO");
  });

  it("gebruikt rankSignals voor relevantiescore", () => {
    expect(
      extractRelevanceScore(
        { rankSignals: { relevanceScore: 0.83 } },
        0,
      ),
    ).toBe(0.83);
  });

  it("valt terug op rank-based score zonder signals", () => {
    expect(extractRelevanceScore({}, 2)).toBeCloseTo(0.78, 2);
  });
});
