import { describe, expect, it } from "vitest";
import {
  mapEducationNetworkToCurriculumFilter,
  remapCurriculumNetworkForLevel,
} from "@/lib/lesson/curriculumNetwork";

describe("curriculumNetwork", () => {
  it("mapt GO! naar het nieuwe basisleerplan, en naar GO op secundair", () => {
    expect(mapEducationNetworkToCurriculumFilter("GO", "basisonderwijs")).toBe(
      "GO_NIEUW",
    );
    expect(
      mapEducationNetworkToCurriculumFilter("GO", "secundair_onderwijs"),
    ).toBe("GO");
    expect(mapEducationNetworkToCurriculumFilter("ZILL", "basisonderwijs")).toBe(
      "ZILL",
    );
  });

  it("behoudt GO! secundair bij een niveauwissel van basis naar secundair", () => {
    expect(
      remapCurriculumNetworkForLevel("GO_NIEUW", "secundair_onderwijs"),
    ).toBe("GO");
    expect(remapCurriculumNetworkForLevel("GO", "basisonderwijs")).toBe(
      "GO_NIEUW",
    );
    expect(remapCurriculumNetworkForLevel("GO", "alle_niveaus")).toBe("GO");
  });
});
