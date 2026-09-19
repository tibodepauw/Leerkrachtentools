import { describe, expect, it } from "vitest";
import { GENERATIVE_LABS_LEGAL, LEGAL_NAV_ITEMS } from "./generativeLabs";

describe("Generative Labs legal URLs", () => {
  it("wijst naar actuele appteksten en centrale bedrijfsgegevens", () => {
    expect(GENERATIVE_LABS_LEGAL.terms).toBe(
      "/voorwaarden?versie=2026-09-13",
    );
    expect(GENERATIVE_LABS_LEGAL.privacy).toBe(
      "/privacy?versie=2026-09-19",
    );
    expect(GENERATIVE_LABS_LEGAL.imprint).toBe(
      "https://www.generativelabs.be/juridisch.html",
    );
  });

  it("koppelt footerlabels aan die URLs", () => {
    expect(LEGAL_NAV_ITEMS).toEqual([
      { href: GENERATIVE_LABS_LEGAL.terms, label: "Voorwaarden" },
      { href: GENERATIVE_LABS_LEGAL.privacy, label: "Privacy" },
      {
        href: GENERATIVE_LABS_LEGAL.imprint,
        label: "Juridische informatie",
      },
    ]);
  });
});
