import { describe, expect, it } from "vitest";
import {
  disciplineFromMinimumCode,
  formatGoalMetadata,
  gradeLevelFromMinimumCode,
} from "@/lib/rag/curriculumDisplay";
import type { CurriculumGoal } from "@/types";

describe("curriculumDisplay", () => {
  it("mapt oude MM-codes naar Geschiedenis en leerjaar", () => {
    expect(disciplineFromMinimumCode("MM 3.8")).toBe("Geschiedenis");
    expect(gradeLevelFromMinimumCode("MM 3.8")).toBe("3e leerjaar");
  });

  it("toont discipline, leerjaar en schooljaar in metadata", () => {
    const goal: CurriculumGoal = {
      id: "test",
      source: "minimumdoel",
      network: "VLAANDEREN",
      code: "WI 1.4",
      text: "Test",
      discipline: "Wiskunde",
      gradeLevel: "1e leerjaar",
      framework: "LO 1.0 eindterm",
      domain: "Getallen",
      subject: "Breuken",
      schoolYears: ["2025-2026"],
      status: "active",
      sourceUrl: "https://www.onderwijsdoelen.be/",
      retrievedAt: "2026-08-26",
      version: "LO 1.0",
      approvalStatus: "geldend eindtermenkader",
      keywords: [],
    };

    expect(formatGoalMetadata(goal)).toContain("Wiskunde");
    expect(formatGoalMetadata(goal)).toContain("1e leerjaar");
    expect(formatGoalMetadata(goal)).toContain("schooljaar 2025-2026");
  });
});
