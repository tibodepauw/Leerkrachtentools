import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { performance } from "node:perf_hooks";
import {
  __testables,
  exportLessonDocument,
  generateGenericLessonDocx,
  MAX_DOCUMENT_XML_BYTES,
  patchLessonDocx,
} from "./exportLessonDocument";
import { DocumentUserError } from "./documentErrors";
import { extractDocumentText } from "./extractionCore";
import { decodeXmlText } from "./xmlText";
import {
  isGeminiDirectManualFile,
  MANUAL_SCANNER_MAX_TEXT_CHARS,
  MANUAL_SCANNER_MEDIA_TYPES,
  manualScannerMediaType,
} from "./supportedFormats";
import {
  manualExtractionRequestSchema,
  MAX_AI_TEXT_CHARS,
} from "@/lib/ai/inputValidation";
import type { LessonExportPayload } from "@/types";

const lesson: LessonExportPayload = {
  topic: "klokkijken",
  learningArea: "Wiskunde",
  component: "meten",
  targetGroup: "L2",
  materials: [],
  goals: [
    { id: "D1", text: "kost $1 en $& of $` en $$", taxonomy: "DAS" },
    { id: "D2", text: "tweede doel", taxonomy: "MC" },
  ],
  totalMinutes: 50,
  educationNetwork: "ZILL",
  lessonPreparation: "",
};

const run = (text: string, props = "") =>
  `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${text}</w:t></w:r>`;
const visible = (xml: string) => decodeXmlText(xml.replace(/<[^<>]+>/g, ""));
const patch = (xml: string, payload = lesson) => __testables.patchDocumentXml(xml, payload);

// Standaard 1 MB. Elke vijandige invoer moet lineair verwerkt worden.
const HOSTILE_BYTES = Number(process.env.HOSTILE_BYTES ?? 1_000_000);
const repeatTo = (unit: string) => unit.repeat(Math.ceil(HOSTILE_BYTES / unit.length));

describe("begrensde verwerking van vijandige Word-XML", () => {
  it("behoudt zelfsluitende paragrafen met attributen voor en na een veld", async () => {
    const empty = '<w:p w:rsidR="00A1" w:rsidRDefault="00A1"/>';
    const xml = `<w:document xmlns:w="x"><w:body>${empty}<w:p>${run("Leergebied: oud")}</w:p><w:tbl/>${empty}<w:sectPr/></w:body></w:document>`;
    const result = __testables.patchDocumentXmlDetailed(xml, lesson);
    expect(result.fields).toBe(1);
    expect(result.xml).toContain("Wiskunde");
    expect(result.xml.split(empty)).toHaveLength(3);
    expect(__testables.patchDocumentXmlDetailed(empty, lesson)).toEqual({ xml: empty, fields: 0 });
    const zip = new JSZip(); zip.file("word/document.xml", xml);
    const output = await patchLessonDocx(await zip.generateAsync({ type: "nodebuffer" }), lesson);
    const patched = await (await JSZip.loadAsync(output)).file("word/document.xml")!.async("string");
    expect(patched).toContain(empty);
    expect(patched).toContain("Wiskunde");
  });
  const generatedHeader = `<w:p>${run("Lescontext")}</w:p><w:p>${run("Lesvoorbereidingsformulier")}</w:p>`;
  const cases: Array<[string, () => string]> = [
    ["ongesloten paragraafopeningen", () => repeatTo("<w:p")],
    ["paragraafopeningen voor één sluiting", () => `${repeatTo("<w:p>")}</w:p>`],
    ["ongesloten tekstnodes", () => repeatTo("<w:t>")],
    ["herhaalde labels zonder vervolgveld", () => `<w:p>${run(repeatTo("Leergebied: x "))}</w:p>`],
    ["herhaalde lesdoelkoppen zonder einde", () => `<w:p>${run(repeatTo("LESDOEL 1 (MC): x "))}</w:p>`],
    ["herhaalde lesdoelkoppen met haakjes", () => `<w:p>${run(repeatTo("LESDOEL 1 ("))}</w:p>`],
    ["herhaalde body-openingen", () => `${generatedHeader}${repeatTo("<w:body>")}`],
    ["herhaalde sectie-openingen", () => `<w:body>${generatedHeader}</w:sectPr${repeatTo("<w:sectPr")}`],
    ["veel korte tekstnodes in één paragraaf", () => `<w:p>${run("Leergebied:")}${repeatTo(run("a"))}</w:p>`],
  ];
  for (const [name, build] of cases) {
    it(`${name} blokkeren de worker niet`, () => {
      const xml = build();
      const started = performance.now();
      try { patch(xml); } catch (error) {
        expect(error).toBeInstanceOf(DocumentUserError);
      }
      expect(performance.now() - started).toBeLessThan(1_500);
    });
  }

  it("weigert te grote Word-XML met een specifieke melding", () => {
    const xml = "a".repeat(MAX_DOCUMENT_XML_BYTES + 1);
    expect(() => patch(xml)).toThrow(DocumentUserError);
    expect(() => patch(xml)).toThrow("te groot om te exporteren");
    // Multibytetekens tellen als bytes, niet als tekens.
    expect(() => patch("é".repeat(MAX_DOCUMENT_XML_BYTES / 2 + 1))).toThrow("te groot");
  });

  it("verwerkt paragrafen in een tekstvak zonder de buitenste paragraaf te breken", () => {
    const inner = `<w:p>${run("Leergebied: oud")}</w:p>`;
    const xml = `<w:p><w:r><w:txbxContent>${inner}</w:txbxContent></w:r></w:p><w:p>${run("Onderdeel: oud")}</w:p>`;
    const patched = patch(xml);
    expect(visible(patched)).toBe("Leergebied: WiskundeOnderdeel: meten");
    expect(patched.match(/<w:p>/g)).toHaveLength(3);
    expect(patched.match(/<\/w:p>/g)).toHaveLength(3);
  });
});

describe("Word-velden over meerdere runs", () => {
  it("vult een LESDOEL-kop in wanneer de gekoppelde velden in volgende paragrafen staan", () => {
    const label = `<w:p>${run("LESDOEL ", "<w:b/>")}${run("1 (MC-DAS-SPM): oud doel")}</w:p>`;
    const metadata = `<w:p>${run("Gekoppeld aan minimumdoel: broncode")}</w:p><w:p>${run("Gekoppeld aan leerplandoel: brontekst")}</w:p>`;
    const result = __testables.patchDocumentXmlDetailed(label + metadata, lesson);
    expect(result.fields).toBe(1);
    expect(visible(result.xml)).toBe(`LESDOEL 1 (DAS): ${lesson.goals[0].text}` + visible(metadata));
    expect(result.xml).toContain(metadata);
    expect(result.xml).toContain("<w:b/>");
    expect(result.xml).not.toContain("oud doel");
    expect(visible(patch(result.xml))).toBe(visible(result.xml));
  });

  it("vult de waarde eenmaal in en behoudt de opmaak van label en waarde", () => {
    const xml = `<w:p><w:pPr><w:jc w:val="left"/></w:pPr>${run("Leer", "<w:b/>")}${run("gebied:", "<w:b/>")}${run(" ")}${run("Ne", "<w:i/>")}${run("der")}${run("lands")}<w:bookmarkEnd w:id="1"/></w:p>`;
    const patched = patch(xml);
    expect(visible(patched)).toBe("Leergebied: Wiskunde");
    expect(patched.match(/Wiskunde/g)).toHaveLength(1);
    // De labelruns zijn letterlijk ongewijzigd en de waarde staat in de cursieve run.
    expect(patched).toContain(run("Leer", "<w:b/>") + run("gebied:", "<w:b/>") + run(" "));
    expect(patched).toContain(run("Wiskunde", "<w:i/>"));
    expect(patched).toContain('<w:pPr><w:jc w:val="left"/></w:pPr>');
    expect(patched).toContain('<w:bookmarkEnd w:id="1"/>');
    expect(patched.match(/<w:r>/g)).toHaveLength(6);
  });

  it("voegt een spatie toe wanneer het formulier er geen heeft", () => {
    expect(visible(patch(`<w:p>${run("Doelgroep:")}${run("oud")}</w:p>`))).toBe("Doelgroep: L2");
    expect(visible(patch(`<w:p>${run("Doelgroep:")}</w:p>`))).toBe("Doelgroep: L2");
    expect(visible(patch(`<w:p>${run("Doelgroep: oud")}</w:p>`))).toBe("Doelgroep: L2");
  });

  it("vervangt een doel over meerdere runs eenmaal en letterlijk", () => {
    const patched = patch(`<w:p>${run("D1", "<w:b/>")}${run(": oud ")}${run("doel")}${run(" (MC)")}</w:p>`);
    expect(visible(patched)).toBe("D1: kost $1 en $& of $` en $$ (DAS)");
    expect(patched).toContain(run("D1", "<w:b/>"));
  });

  it("laat de rest van een regel met meerdere velden staan, ook bij gelijke waarden", () => {
    const line = (area: string) => `<w:p>${run(`Leergebied: ${area} `, "<w:b/>")}${run("Onderdeel: oud Lesonderwerp: oud Datum: 12/11")}</w:p>`;
    for (const area of ["Oud", "Wiskunde"]) {
      const patched = patch(line(area));
      expect(visible(patched)).toBe("Leergebied: Wiskunde Onderdeel: meten Lesonderwerp: klokkijken Datum: 12/11");
      expect(patched.match(/<w:rPr><w:b\/><\/w:rPr>/g)).toHaveLength(1);
    }
    const unchanged = { ...lesson, component: "oud", topic: "oud" };
    expect(visible(patch(line("Wiskunde"), unchanged))).toContain("Datum: 12/11");
  });

  it("codeert entiteiten in een formulierblok precies eenmaal en neemt dollartekens letterlijk over", () => {
    const blob = "▪ LESDOEL 1 (MC-DAS-SPM): oud &amp; &lt;b&gt; &amp;amp; Gekoppeld aan minimumdoel: 1 &amp; 2 LESDOEL 2 (MC): oud Gekoppeld aan minimumdoel: 3";
    const patched = patch(`<w:p>${run(blob)}</w:p>`);
    expect(visible(patched)).toBe(
      "▪ LESDOEL 1 (DAS): kost $1 en $& of $` en $$ Gekoppeld aan minimumdoel: 1 & 2 LESDOEL 2 (MC): tweede doel Gekoppeld aan minimumdoel: 3",
    );
    expect(patched).toContain("minimumdoel: 1 &amp; 2");
    expect(patched).not.toContain("&amp;amp;");

    const untouched = `<w:p>${run("Vrije tekst &amp;amp; &lt;b&gt;")}</w:p>`;
    expect(patch(untouched)).toBe(untouched);
    expect(__testables.patchFormBlobText("Leergebied: a Onderdeel: b Lesonderwerp: c Datum:", { ...lesson, topic: "$& $1" }))
      .toBe("Leergebied: Wiskunde Onderdeel: meten Lesonderwerp: $& $1 Datum:");
  });

  it("verwijdert alleen losse gegenereerde kopparagrafen en nooit tabellen", () => {
    const form = `<w:p>${run("Lesvoorbereidingsformulier")}</w:p><w:tbl><w:tr><w:tc><w:p>${run("Cel")}</w:p></w:tc></w:tr></w:tbl><w:sectPr><w:pgSz w:w="1"/></w:sectPr>`;
    const stripped = __testables.stripGeneratedExportHeader(`<w:body><w:p>${run("Lescontext")}</w:p><w:p>${run("Leergebied: x")}</w:p>${form}</w:body>`);
    expect(stripped).toBe(`<w:body>${form}</w:body>`);

    const tableFirst = `<w:body><w:tbl><w:tr><w:tc><w:p>${run("Lescontext")}</w:p></w:tc></w:tr></w:tbl>${form}</w:body>`;
    expect(__testables.stripGeneratedExportHeader(tableFirst)).toBe(tableFirst);
  });

  it("telt herkende velden zodat een ongewijzigd formulier geen valse fout geeft", async () => {
    const same = `<w:p>${run("Leergebied: Wiskunde")}</w:p>`;
    expect(__testables.patchDocumentXmlDetailed(same, lesson)).toEqual({ xml: same, fields: 1 });
    // 'D1:' midden in een zin is geen formulierveld.
    expect(__testables.patchDocumentXmlDetailed(`<w:p>${run("Zie D1: hierboven")}</w:p>`, lesson).fields).toBe(0);

    const zip = new JSZip();
    zip.file("word/document.xml", `<w:p>${run("Zie D1: hierboven")}</w:p>`);
    const source = await zip.generateAsync({ type: "nodebuffer" });
    await expect(patchLessonDocx(source, lesson)).rejects.toBeInstanceOf(DocumentUserError);
    await expect(exportLessonDocument(lesson, source, "bron.docx")).rejects.toThrow("herkenbare exportvelden");
  });
});

describe("gegenereerde export", () => {
  it("zet regels, lege regels en tabs om naar Word-structuur en blijft geldige XML", async () => {
    const buffer = await generateGenericLessonDocx({
      ...lesson,
      topic: "regel A\r\nregel B",
      lessonPreparation: "Instap\n\n\tStap 1\tklaar\u0000\u000B\uD800 ￾ einde",
    });
    const xml = await (await JSZip.loadAsync(buffer)).file("word/document.xml")!.async("string");
    expect(xml).toContain(`${run("Lesonderwerp: regel A").replace("<w:r>", "<w:p><w:r>")}</w:p><w:p>${run("regel B")}</w:p>`);
    expect(xml).toContain(`<w:p>${run("Instap")}</w:p><w:p/><w:p><w:r><w:tab/><w:t xml:space="preserve">Stap 1</w:t><w:tab/><w:t xml:space="preserve">klaar�  einde</w:t></w:r></w:p>`);
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/);
    expect(xml.isWellFormed()).toBe(true);
  });

  it("houdt de grootste toegestane les ruim binnen de transportgrens van de worker", async () => {
    const started = performance.now();
    const buffer = await generateGenericLessonDocx({ ...lesson, lessonPreparation: "x\n".repeat(250_000) });
    expect(buffer.byteLength).toBeLessThan(1_000_000);
    expect(performance.now() - started).toBeLessThan(4_000);
    const xml = await (await JSZip.loadAsync(buffer)).file("word/document.xml")!.async("string");
    expect(xml.match(/<w:p>/g)!.length).toBeGreaterThan(250_000);
  });
});

describe("RTF- en ODT-import", () => {
  const rtf = (body: string) => extractDocumentText(Buffer.from(body, "latin1"), "les.rtf");

  it("decodeert cp1252-hex, negatieve unicodewaarden en surrogaatparen", async () => {
    expect(await rtf(String.raw`{\rtf1\ansi prijs \'80 5 \'e9\'e9n}`)).toBe("prijs € 5 één");
    // Gewone strings: sjabloontekst met \\u wordt door de bundelaar niet letterlijk gelaten.
    expect(await rtf("{\\rtf1\\ansi \\u-10179?\\u-8704? en \\u8364\\'80 en \\uc0\\u233 klaar}")).toBe("😀 en € en éklaar");
    expect(await rtf("{\\rtf1\\ansi \\uc2\\u233\\'e9\\'e9x {\\uc1\\u235?y}}")).toBe("éx ëy");
  });

  it("slaat tabellen met lettertypes en kopteksten over en behoudt leestekens", async () => {
    const source = String.raw`{\rtf1\ansi{\fonttbl{\f0 Arial;}}{\header Kop}{\*\generator Tool;}Les\emdash deel\par \ldblquote ja\rdblquote\tab x\~y}`;
    expect(await rtf(source)).toBe("Les—deel\n“ja”\tx y".replace(" ", " "));
  });

  it("leest ruwe cp1252-bytes en ruwe UTF-8", async () => {
    expect(await extractDocumentText(Buffer.from([...Buffer.from("{\\rtf1 caf"), 0xe9, 0x7d]), "les.rtf")).toBe("café");
    expect(await extractDocumentText(Buffer.from("{\\rtf1 café}", "utf8"), "les.rtf")).toBe("café");
  });

  it("decodeert ODT-entiteiten één laag en herkent koppen en tabs", async () => {
    const zip = new JSZip();
    zip.file("content.xml", "<text:h>Titel</text:h><text:p>a&amp;lt;b &#233; &#xE9; &amp;amp; &quot;x&apos;<text:tab/>y<text:page-number>1</text:page-number></text:p>");
    const text = await extractDocumentText(await zip.generateAsync({ type: "nodebuffer" }), "les.odt");
    expect(text).toBe("Titel\na&lt;b é é &amp; \"x'\ty1");
  });

  it("meldt te veel tekst met de werkelijke grens", async () => {
    await expect(extractDocumentText(Buffer.from("a".repeat(500_001)), "les.txt")).rejects.toThrow(
      "te veel tekst (maximaal 500000 tekens)",
    );
    await expect(extractDocumentText(Buffer.from("a".repeat(500_001)), "les.txt")).rejects.toBeInstanceOf(DocumentUserError);
  });
});

describe("scanneruploads", () => {
  it("stuurt alleen echte tekst-, PDF- en afbeeldingsextensies rechtstreeks door", () => {
    expect(isGeminiDirectManualFile({ name: "les.rtf", type: "text/rtf" })).toBe(false);
    expect(isGeminiDirectManualFile({ name: "les.docx", type: "text/plain" })).toBe(false);
    expect(isGeminiDirectManualFile({ name: "LES.MD", type: "" })).toBe(true);
    expect(manualScannerMediaType({ name: "scan.JPG", type: "" })).toBe("image/jpeg");
    expect(manualScannerMediaType({ name: "constructor", type: "" })).toBeUndefined();
  });

  it("deelt de MIME-lijst en tekstgrens met de servervalidatie", () => {
    expect(MANUAL_SCANNER_MAX_TEXT_CHARS).toBe(MAX_AI_TEXT_CHARS);
    for (const mediaType of MANUAL_SCANNER_MEDIA_TYPES) {
      expect(manualExtractionRequestSchema.safeParse({ fileData: "aGFsbG8=", mediaType }).success).toBe(true);
    }
    for (const mediaType of ["image/bmp", "image/heic", "text/markdown", "application/octet-stream"]) {
      expect(manualExtractionRequestSchema.safeParse({ fileData: "aGFsbG8=", mediaType }).success).toBe(false);
    }
  });
});
