import { describe, expect, it } from "vitest";
import { heavyRouteLimits } from "@/lib/http/heavyRouteLimits";

describe("limieten voor zware routes", () => {
  it("begrenst avataruploads apart zonder weergave of documenten te belasten", () => {
    expect(heavyRouteLimits("/api/account/avatar", "POST")).toEqual([
      { scope: "avatar", limit: 10 },
    ]);
    expect(heavyRouteLimits("/api/account/avatar", "GET")).toEqual([]);
    expect(heavyRouteLimits("/api/account/avatar", "DELETE")).toEqual([]);
  });

  it("behoudt de bestaande document-, AI- en zoeklimieten", () => {
    expect(heavyRouteLimits("/api/export-lesson-document", "POST")).toEqual([
      { scope: "document", limit: 20 },
    ]);
    expect(heavyRouteLimits("/api/extract-manual", "POST")).toEqual([
      { scope: "document", limit: 20 },
      { scope: "ai", limit: 60 },
    ]);
    expect(heavyRouteLimits("/api/rag-curriculum", "POST")).toEqual([
      { scope: "rag", limit: 60 },
    ]);
    expect(heavyRouteLimits("/api/account/profile", "POST")).toEqual([]);
  });
});
