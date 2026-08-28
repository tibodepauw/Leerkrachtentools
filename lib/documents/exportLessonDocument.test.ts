import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  __testables,
  exportLessonDocument,
  patchLessonDocx,
} from "@/lib/documents/exportLessonDocument";

const sampleDocx = readFileSync(
  path.join(
    process.cwd(),
    "test/fixtures/lesvoorbereiding-creatief-schrijven.docx",
  ),
);

const sampleLesson = {
  topic: "creatief schrijven",
  learningArea: "Nederlands",
  component: "schrijven",
  targetGroup: "L6B",
  materials: ["Chromebooks", "kladschrift"],
  goals: [
    {
      id: "D1" as const,
      text: "De leerlingen kunnen een nieuw doel uit de app schrijven.",
      taxonomy: "MC" as const,
    },
    {
      id: "D2" as const,
      text: "De leerlingen gebruiken beeldende bijvoeglijke naamwoorden.",
      taxonomy: "MC" as const,
    },
    {
      id: "D3" as const,
      text: "De leerlingen schrijven vanuit het perspectief van een dier.",
      taxonomy: "MC" as const,
    },
  ],
  totalMinutes: 50,
  educationNetwork: "ZILL" as const,
  lessonPreparation: "Volledige lesvoorbereidingstekst",
};

describe("exportLessonDocument", () => {
  it("updates LESDOEL-teksten in een geüpload formulier", async () => {
    const exported = await patchLessonDocx(sampleDocx, sampleLesson);
    const xml = exported.toString("utf8");

    expect(xml).toContain("De leerlingen kunnen een nieuw doel uit de app schrijven.");
    expect(xml).toContain("De leerlingen gebruiken beeldende bijvoeglijke naamwoorden.");
    expect(xml).toContain("De leerlingen schrijven vanuit het perspectief van een dier.");
    expect(xml).not.toContain("Lescontext");
  });

  it("gebruikt het officiële sjabloon als er geen bronbestand is", async () => {
    const exported = await exportLessonDocument(sampleLesson);
    expect(exported.usedTemplate).toBe(true);
    expect(exported.fileName).toContain("creatief-schrijven");
    expect(exported.buffer.byteLength).toBeGreaterThan(0);
  });
});

describe("patchFormBlobText", () => {
  it("vervangt lesdoelen en situering in formuliertekst", () => {
    const source =
      "LESDOEL 1 (MC-DAS-SPM): oud doel Gekoppeld aan minimumdoel: 1.2.12 Leergebied: Oud Onderdeel: oud Lesonderwerp: oud Datum: morgen";
    const patched = __testables.patchFormBlobText(source, sampleLesson);

    expect(patched).toContain(
      "LESDOEL 1 (MC): De leerlingen kunnen een nieuw doel uit de app schrijven.",
    );
    expect(patched).toContain("Leergebied: Nederlands");
    expect(patched).toContain("Onderdeel: schrijven");
    expect(patched).toContain("Lesonderwerp: creatief schrijven");
  });
});
