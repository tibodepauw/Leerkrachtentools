import { describe, expect, it } from "vitest";
import {
  filterToPreference,
  isAhovoksDomainLevel,
  preferenceToFilter,
  resolveCurriculumNetwork,
} from "@/lib/lesson/educationLevelPreference";
import { matchesDomainDetailFilter } from "@/lib/lesson/domainFilters";
import { recordMatchesEducationLevel } from "@/lib/rag/educationLevel";

describe("educationLevelPreference", () => {
  it("mapt store-waarden naar API-filters", () => {
    expect(preferenceToFilter("basisonderwijs")).toBe("BASISONDERWIJS");
    expect(preferenceToFilter("secundair_onderwijs")).toBe("SECUNDAIR");
    expect(preferenceToFilter("bubao")).toBe("BUBAO");
    expect(preferenceToFilter("alle_niveaus")).toBe("ALL");
  });

  it("mapt API-filters terug naar store-waarden", () => {
    expect(filterToPreference("BASISONDERWIJS")).toBe("basisonderwijs");
    expect(filterToPreference("BUBAO")).toBe("bubao");
    expect(filterToPreference("ALL")).toBe("alle_niveaus");
  });

  it("forceert ALL-netwerk voor AHOVOKS-domeinen", () => {
    expect(isAhovoksDomainLevel("OKAN")).toBe(true);
    expect(isAhovoksDomainLevel("BASISONDERWIJS")).toBe(false);
    expect(resolveCurriculumNetwork("ZILL", "OKAN")).toBe("ALL");
    expect(resolveCurriculumNetwork("ZILL", "BASISONDERWIJS")).toBe("ZILL");
  });
});

describe("domainFilters", () => {
  it("herkent BuBaO-type filters", () => {
    expect(
      matchesDomainDetailFilter("ontwikkelingsdoel type 2 lager", "type_2"),
    ).toBe(true);
    expect(
      matchesDomainDetailFilter("buitengewoon basisonderwijs type 2", "type_2"),
    ).toBe(true);
  });
});

describe("educationLevel domains", () => {
  it("herkent BuBaO-records op onderwijsniveau", () => {
    expect(
      recordMatchesEducationLevel(
        { onderwijsniveau: "BUBAO", graad: "Type 2" },
        "BUBAO",
      ),
    ).toBe(true);
    expect(
      recordMatchesEducationLevel(
        { onderwijsniveau: "BUBAO", graad: "Type 2" },
        "SECUNDAIR",
      ),
    ).toBe(false);
  });
});
