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
        usedLlm: false,
        dispatched: false,
      }),
    ).toBe("eerstegraadsfunctie grafiek snijpunt Wiskunde");
  });

  it("valt terug op originele query zonder provider", async () => {
    const keys = [
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "GROQ_API_KEY",
      "CEREBRAS_API_KEY",
      "SAMBANOVA_API_KEY",
      "CLOUDFLARE_API_TOKEN",
    ] as const;
    const previous = Object.fromEntries(
      keys.map((key) => [key, process.env[key]]),
    );
    for (const key of keys) delete process.env[key];

    const result = await resolveRagSearchQuery("vage zoekterm", true);
    expect(result.searchQuery).toBe("vage zoekterm");
    expect(result.rewrite?.expandedQuery).toBe("vage zoekterm");
    expect(result.rewrite?.usedLlm).toBe(false);
    expect(result.rewrite?.dispatched).toBe(false);

    for (const key of keys) {
      if (previous[key]) process.env[key] = previous[key];
    }
  });
});
