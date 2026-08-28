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

  it("laat een goed doel ongewijzigd", () => {
    const original =
      "De leerlingen kunnen minstens drie relevante historische bronnen selecteren en correct verwerken.";
    const result = improveLessonGoal(original);

    expect(result.status).toBe("goed");
    expect(result.improved).toBe(original);
    expect(result.addedTerms).toEqual([]);
    expect(result.removedTerms).toEqual([]);
  });

  it("markeert een wezenlijk aangepast doel als verbeterd", () => {
    const result = improveLessonGoal(
      "De leerlingen kennen de hoofdsteden van Europa",
    );

    expect(result.status).toBe("verbeterd");
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
