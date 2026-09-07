import { describe, expect, it } from "vitest";
import {
  CURRICULUM_ATTRIBUTION,
  CURRICULUM_ATTRIBUTION_ITEMS,
} from "./curriculumAttribution";

describe("curriculum attribution copy", () => {
  it("bevat modellicentie, koepelrechten, non-affiliatie en AI Act art. 50", () => {
    expect(CURRICULUM_ATTRIBUTION.ahovoksLicense).toContain(
      "Modellicentie voor Gratis Hergebruik Vlaanderen v1.0",
    );
    expect(CURRICULUM_ATTRIBUTION.ahovoksLicense).toContain("AHOVOKS");
    expect(CURRICULUM_ATTRIBUTION.umbrellaRights).toContain("art. XI.189 WER");
    expect(CURRICULUM_ATTRIBUTION.umbrellaRights).toContain(
      "Katholiek Onderwijs Vlaanderen",
    );
    expect(CURRICULUM_ATTRIBUTION.nonAffiliation).toContain("Generative Labs");
    expect(CURRICULUM_ATTRIBUTION.nonAffiliation).toContain("niet verbonden");
    expect(CURRICULUM_ATTRIBUTION.aiActTransparency).toContain(
      "kunstmatige intelligentie",
    );
    expect(CURRICULUM_ATTRIBUTION.aiActTransparency).toContain(
      "pedagogische eindverantwoordelijkheid",
    );
    expect(CURRICULUM_ATTRIBUTION_ITEMS).toHaveLength(4);
  });
});
