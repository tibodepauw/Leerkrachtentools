import { describe, expect, it } from "vitest";
import { goalImprovementSchema, goalTaxonomySchema } from "@/lib/goals/goalSchemas";
import {
  containsForbiddenVerb,
  hasDoubleGoalWording,
  isContentGoal,
  isLearningProcessGoal,
  isTeacherActivityGoal,
} from "@/lib/goals/ko1Rules";
import { classifyGoalTaxonomy } from "@/lib/goals/classifyTaxonomy";
import { improveLessonGoal } from "@/lib/goals/improveGoal";

describe("KO1 regels", () => {
  it("herkent verboden werkwoorden", () => {
    expect(containsForbiddenVerb("De leerlingen kennen steden")).toBe(true);
    expect(containsForbiddenVerb("De leerlingen kunnen steden benoemen")).toBe(
      false,
    );
  });

  it("herkent leerkracht-, leerstof- en werkvormdoelen", () => {
    expect(isTeacherActivityGoal("De leerkracht laat leerlingen meten")).toBe(
      true,
    );
    expect(isContentGoal("Het begrip democratie")).toBe(true);
    expect(
      isLearningProcessGoal("De leerlingen kijken naar een film over Rome"),
    ).toBe(true);
  });

  it("signaleert dubbele doelen", () => {
    expect(
      hasDoubleGoalWording("De leerlingen kunnen dieren aanduiden en benoemen"),
    ).toBe(true);
  });
});

describe("doelverbeteraar", () => {
  it("behoudt het onderwerp bij zoogdieren", () => {
    const result = improveLessonGoal("Leerling kan zoogdieren herkennen");
    expect(result.improved.toLocaleLowerCase("nl-BE")).toContain("zoogdier");
    expect(result.improved).toMatch(/^De leerlingen kunnen/u);
    expect(result.goalDomain).toBe("MC");
  });

  it("vervangt kennen door één observeerbaar werkwoord", () => {
    const result = improveLessonGoal("De leerlingen kennen de hoofdsteden van Europa");
    expect(result.improved.toLocaleLowerCase("nl-BE")).toContain("hoofdsteden");
    expect(result.improved.toLocaleLowerCase("nl-BE")).toContain("benoemen");
    expect(result.improved.toLocaleLowerCase("nl-BE")).not.toContain("kennen");
    expect(result.removedTerms).toContain("kennen");
  });

  it("laat een goed MC-doel ongewijzigd", () => {
    const original =
      "De leerlingen kunnen minstens drie relevante historische bronnen selecteren en correct verwerken.";
    const result = improveLessonGoal(original);

    expect(result.status).toBe("goed");
    expect(result.improved).toBe(original);
    expect(result.goalDomain).toBe("MC");
  });

  it("herschrijft leerkrachtdoelen naar leerlinggedrag", () => {
    const result = improveLessonGoal("De leerkracht laat de leerlingen meten");
    expect(result.status).toBe("verbeterd");
    expect(result.improved.toLocaleLowerCase("nl-BE")).not.toContain("leerkracht");
    expect(result.rationale.toLocaleLowerCase("nl-BE")).toContain("leerkracht");
  });

  it("valideert via Zod zonder verboden werkwoorden in improved", () => {
    const result = improveLessonGoal("De leerlingen weten wat een hoofdstad is");
    expect(() => goalImprovementSchema.parse(result)).not.toThrow();
    expect(result.improved.toLocaleLowerCase("nl-BE")).not.toMatch(/\bweten\b/u);
  });
});

describe("MC-DAS-SPM herkenner", () => {
  it("classificeert herkennen als MC met gedragsniveau", () => {
    const result = classifyGoalTaxonomy("Leerling kan zoogdieren herkennen");
    expect(result.taxonomy).toBe("MC");
    expect(result.behaviorLevel.length).toBeGreaterThan(0);
    expect(result.subcategory.length).toBeGreaterThan(0);
    expect(() => goalTaxonomySchema.parse(result)).not.toThrow();
  });

  it("classificeert motorische acties als SPM", () => {
    const result = classifyGoalTaxonomy(
      "De leerlingen kunnen een collage knippen en plakken",
    );
    expect(result.taxonomy).toBe("SPM");
    expect(result.rationale.toLocaleLowerCase("nl-BE")).toContain("gedragsniveau");
  });

  it("classificeert affectief gedrag als DAS", () => {
    const result = classifyGoalTaxonomy(
      "De leerlingen durven hun mening te geven in de kring",
    );
    expect(result.taxonomy).toBe("DAS");
    expect(result.subcategory.toLocaleLowerCase("nl-BE")).toContain("wils");
  });
});

describe("goalImprovementSchema", () => {
  it("weigert verboden werkwoorden in improved", () => {
    expect(() =>
      goalImprovementSchema.parse({
        status: "verbeterd",
        original: "De leerlingen kennen steden",
        improved: "De leerlingen kunnen steden kennen",
        rationale: "test",
        goalDomain: "MC",
        removedTerms: [],
        addedTerms: [],
        criteria: [],
      }),
    ).toThrow();
  });

  it("weigert kunnen in DAS-doelen", () => {
    expect(() =>
      goalImprovementSchema.parse({
        status: "verbeterd",
        original: "De leerlingen tonen respect",
        improved: "De leerlingen kunnen respect tonen",
        rationale: "test",
        goalDomain: "DAS",
        removedTerms: [],
        addedTerms: [],
        criteria: [],
      }),
    ).toThrow();
  });
});
