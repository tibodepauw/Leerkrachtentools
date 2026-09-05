import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CurriculumRagView leerplanopties", () => {
  it("toont oude en nieuwe GO!-leerplannen bij basisonderwijs", () => {
    const source = readFileSync(
      "components/modules/CurriculumRagView.tsx",
      "utf8",
    );

    expect(source).toContain(
      '{ value: "GO_NIEUW", label: "GO! / Nieuw leerplan" }',
    );
    expect(source).toContain(
      '{ value: "GO_OUD", label: "GO! / Oud leerplan" }',
    );
    expect(source).toMatch(
      /\["ALL", "OPSTAP", "OVSG", "GO_NIEUW", "GO_OUD", "ZILL"\]/u,
    );
  });

  it("biedt een Snel- en Pro-zoekmodus aan voor leerplandoelen", () => {
    const source = readFileSync(
      "components/modules/CurriculumRagView.tsx",
      "utf8",
    );

    expect(source).toContain('<TabsTrigger value="snel">Snel</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="pro">Pro</TabsTrigger>');
    expect(source).toContain("Didactisch analyseren...");
    expect(source).toContain("Toevoegen aan Actieve les");
    expect(source).toContain("searchMode,");
  });
});
