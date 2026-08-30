import { describe, expect, it } from "vitest";
import {
  filterToPreference,
  preferenceToFilter,
} from "@/lib/lesson/educationLevelPreference";

describe("educationLevelPreference", () => {
  it("mapt store-waarden naar API-filters", () => {
    expect(preferenceToFilter("lager_onderwijs")).toBe("LAGER");
    expect(preferenceToFilter("kleuteronderwijs")).toBe("KLEUTER");
    expect(preferenceToFilter("secundair_onderwijs")).toBe("SECUNDAIR");
    expect(preferenceToFilter("alle_niveaus")).toBe("ALL");
  });

  it("mapt API-filters terug naar store-waarden", () => {
    expect(filterToPreference("LAGER")).toBe("lager_onderwijs");
    expect(filterToPreference("ALL")).toBe("alle_niveaus");
  });
});
