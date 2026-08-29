import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  __testables,
  exportLessonDocument,
  patchLessonDocx,
} from "@/lib/documents/exportLessonDocument";

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

async function createMinimalLessonDocx(
  paragraphs: Array<string | { label: string; value: string }>,
) {
  const body = paragraphs
    .map((paragraph) => {
      if (typeof paragraph === "string") {
        return `<w:p><w:r><w:t xml:space="preserve">${paragraph}</w:t></w:r></w:p>`;
      }

      return `<w:p><w:r><w:t xml:space="preserve">${paragraph.label}</w:t></w:r><w:r><w:t xml:space="preserve">${paragraph.value}</w:t></w:r></w:p>`;
    })
    .join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}<w:sectPr/></w:body>
</w:document>`;
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder("_rels")!.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.folder("word")!.file("document.xml", documentXml);
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

describe("exportLessonDocument", () => {
  it("updates LESDOEL-teksten in een geüpload formulier", async () => {
    const sampleDocx = await createMinimalLessonDocx([
      "Leergebied: Oud",
      "Onderdeel: oud",
      "Lesonderwerp: oud",
      "D1: oud doel 1",
      "D2: oud doel 2",
      "D3: oud doel 3",
      "LESDOEL 1 (MC): oud doel Gekoppeld aan minimumdoel: 1.2.12",
    ]);
    const exported = await patchLessonDocx(sampleDocx, sampleLesson);
    const xml = exported.toString("utf8");

    expect(xml).toContain("De leerlingen kunnen een nieuw doel uit de app schrijven.");
    expect(xml).toContain("De leerlingen gebruiken beeldende bijvoeglijke naamwoorden.");
    expect(xml).toContain("De leerlingen schrijven vanuit het perspectief van een dier.");
    expect(xml).toContain("Leergebied: Nederlands");
  });

  it("weigert export zonder geüpload bronbestand", async () => {
    await expect(exportLessonDocument(sampleLesson)).rejects.toThrow(
      /Upload eerst je lesvoorbereidingsformulier/i,
    );
  });

  it("weigert export voor niet-docx bronbestanden", async () => {
    await expect(
      exportLessonDocument(sampleLesson, Buffer.from("pdf"), "les.pdf"),
    ).rejects.toThrow(/Alleen een geüpload .docx-formulier/i);
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
