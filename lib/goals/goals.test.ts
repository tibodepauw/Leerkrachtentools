import { describe, expect, it } from "vitest";
import { classifyGoalTaxonomy } from "@/lib/goals/classifyTaxonomy";
import { improveLessonGoal } from "@/lib/goals/improveGoal";

describe("doelverbeteraar", () => {
  it("behoudt het onderwerp bij zoogdieren", () => {
    const result = improveLessonGoal("Leerling kan zoogdieren herkennen");
    expect(result.improved.toLocaleLowerCase("nl-BE")).toContain("zoogdier");
    expect(result.improved).toMatch(/^De leerlingen kunnen/u);
    expect(result.improved.toLocaleLowerCase("nl-BE")).toContain("herkennen");
  });

  it("vervangt geen thema door een ander lesdoel", () => {
    const result = improveLessonGoal("De leerlingen kennen de hoofdsteden van Europa");
    expect(result.improved.toLocaleLowerCase("nl-BE")).toContain("hoofdsteden");
    expect(result.improved.toLocaleLowerCase("nl-BE")).not.toContain("romein");
  });
});

describe("MC-DAS-SPM herkenner", () => {
  it("classificeert herkennen als MC", () => {
    const result = classifyGoalTaxonomy("Leerling kan zoogdieren herkennen");
    expect(result.taxonomy).toBe("MC");
  });

  it("classificeert motorische acties als SPM", () => {
    const result = classifyGoalTaxonomy(
      "De leerlingen kunnen een collage knippen en plakken",
    );
    expect(result.taxonomy).toBe("SPM");
  });
});
