import { describe, expect, it } from "vitest";
import {
  buildSearchQueryFromRewrite,
  resolveRagSearchQuery,
} from "@/lib/rag/queryRewriter";

describe("queryRewriter", () => {
  it("gebruikt lokale query wanneer LLM rewriting uit staat", async () => {
    const result = await resolveRagSearchQuery("optellen tot 20", false);
    expect(result.searchQuery).toBe("optellen tot 20");
    expect(result.rewrite).toBeNull();
  });

  it("bouwt een verrijkte zoekterm met disciplineHint", () => {
    expect(
      buildSearchQueryFromRewrite("functie grafiek", {
        expandedQuery: "eerstegraadsfunctie grafiek snijpunt",
        disciplineHint: "Wiskunde",
      }),
    ).toBe("eerstegraadsfunctie grafiek snijpunt Wiskunde");
  });

  it("valt terug op originele query zonder API-key", async () => {
    const originalKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    const result = await resolveRagSearchQuery("vage zoekterm", true);
    expect(result.searchQuery).toBe("vage zoekterm");
    expect(result.rewrite?.expandedQuery).toBe("vage zoekterm");

    if (originalKey) {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalKey;
    }
  });
});
