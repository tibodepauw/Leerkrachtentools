import "server-only";

import JSZip from "jszip";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DocumentUserError } from "@/lib/documents/documentErrors";
import { decodeXmlText, escapeXmlText } from "@/lib/documents/xmlText";
import type { LessonExportPayload } from "@/types";
import { lessonDocumentExtension } from "@/lib/documents/supportedFormats";

export const LOCAL_TEMPLATE_FILE = "lesvoorbereidingsformulier_2526DEF-1.docx";

export type LessonExportMode = "patched-source" | "local-template" | "generated";

export const MAX_DOCUMENT_XML_BYTES = 5 * 1024 * 1024;
const escapeXml = escapeXmlText;
const TEXT_NODE = /<w:t(?:\s[^<>]*)?>([^<>]*)<\/w:t>/g;
const PARAGRAPH_CLOSE = "</w:p>";

type TextEdit = { start: number; end: number; text: string };

function paragraphText(paragraphXml: string) {
  return [...paragraphXml.matchAll(TEXT_NODE)]
    .map((match) => decodeXmlText(match[1])).join("");
}

/**
 * Geeft de binnenste paragrafen als [start, einde). Beide cursors lopen alleen
 * vooruit, dus het werk is lineair in de XML-lengte. Een paragraaf rond een
 * tekstvak wordt overgeslagen; de paragrafen in het tekstvak worden verwerkt.
 */
function paragraphRanges(xml: string) {
  if (Buffer.byteLength(xml, "utf8") > MAX_DOCUMENT_XML_BYTES) {
    throw new DocumentUserError("De Word-inhoud is te groot om te exporteren (maximaal 5 MB aan documenttekst).");
  }
  // Ook '<w:p<' en een afgebroken einde tellen als opening, zodat kapotte XML
  // als ongeldig wordt geweigerd in plaats van stil te worden overgeslagen.
  const opener = /<w:p(?=[\s><]|$)/g;
  function nextOpening() {
    for (let match = opener.exec(xml); match; match = opener.exec(xml)) {
      let end = opener.lastIndex;
      // Stop at a nested '<' as well: searching to the same distant '>' for
      // every malformed opening would reintroduce quadratic work.
      while (end < xml.length && xml[end] !== ">" && xml[end] !== "<") end += 1;
      if (xml[end] !== ">") throw new DocumentUserError("Het Word-document bevat ongeldige paragrafen.");
      opener.lastIndex = end + 1;
      if (xml[end - 1] !== "/") return match;
    }
    return null;
  }
  const ranges: Array<[number, number]> = [];
  let open = nextOpening();
  let close = xml.indexOf(PARAGRAPH_CLOSE);
  let start = -1;
  while (open || start >= 0) {
    if (close < 0) throw new DocumentUserError("Het Word-document bevat ongeldige paragrafen.");
    if (open && open.index < close) {
      start = open.index;
      open = nextOpening();
      continue;
    }
    if (start >= 0) ranges.push([start, close + PARAGRAPH_CLOSE.length]);
    start = -1;
    close = xml.indexOf(PARAGRAPH_CLOSE, close + PARAGRAPH_CLOSE.length);
  }
  return ranges;
}

/**
 * Past bewerkingen toe op de samengevoegde, gedecodeerde paragraaftekst. Elke
 * nieuwe tekst komt precies eenmaal in de tekstnode waarin de bewerking begint;
 * ongewijzigde nodes en alle opmaak blijven letterlijk staan.
 */
function spliceParagraphText(paragraph: string, edits: TextEdit[]) {
  if (edits.length === 0) return paragraph;
  const nodes = [...paragraph.matchAll(TEXT_NODE)].map((match) => decodeXmlText(match[1]));
  const starts: number[] = [];
  let total = 0;
  for (const node of nodes) { starts.push(total); total += node.length; }
  const owner = edits.map((edit) => {
    let last = -1;
    for (let index = 0; index < nodes.length; index += 1) {
      if (starts[index] > edit.start) break;
      last = index;
      if (edit.start < starts[index] + nodes[index].length) break;
    }
    return last;
  });
  let index = -1;
  return paragraph.replace(TEXT_NODE, (original) => {
    index += 1;
    const nodeStart = starts[index];
    const nodeEnd = nodeStart + nodes[index].length;
    let cursor = nodeStart;
    let next = "";
    let touched = false;
    edits.forEach((edit, editIndex) => {
      const owns = owner[editIndex] === index;
      if (!owns && (edit.end <= nodeStart || edit.start >= nodeEnd)) return;
      touched = true;
      if (edit.start > cursor) next += nodes[index].slice(cursor - nodeStart, edit.start - nodeStart);
      if (owns) next += edit.text;
      cursor = Math.max(cursor, Math.min(edit.end, nodeEnd));
    });
    if (!touched) return original;
    next += nodes[index].slice(cursor - nodeStart);
    return `<w:t xml:space="preserve">${escapeXml(next)}</w:t>`;
  });
}

function singleLine(value: string) {
  return value.replace(/\s*[\r\n]+\s*/g, " ").trim();
}

/** Vervangt alles na het label; het label mag over meerdere runs verdeeld zijn. */
function replaceParagraphValue(paragraph: string, label: string, value: string) {
  const full = paragraphText(paragraph);
  const core = label.trimEnd();
  if (!full.startsWith(core)) return paragraph;
  let boundary = core.length;
  while (boundary < full.length && /\s/.test(full[boundary])) boundary += 1;
  const separator = boundary === core.length ? " " : "";
  return spliceParagraphText(paragraph, [
    { start: boundary, end: full.length, text: `${separator}${singleLine(value)}` },
  ]);
}

function replaceGoalParagraph(paragraph: string, label: string, goal: { text: string; taxonomy?: string }) {
  return replaceParagraphValue(paragraph, label, `${goal.text}${goal.taxonomy ? ` (${goal.taxonomy})` : ""}`);
}

function stripGeneratedExportHeader(documentXml: string) {
  if (!documentXml.includes("Lesvoorbereidingsformulier")) return documentXml;

  const ranges = paragraphRanges(documentXml);
  if (ranges.length <= 1) return documentXml;
  const texts = ranges.map(([start, end]) => paragraphText(documentXml.slice(start, end)));

  const firstFormIndex = texts.findIndex((text) => text.includes("Lesvoorbereidingsformulier"));
  if (firstFormIndex <= 0) return documentXml;

  const headerLooksGenerated = texts.slice(0, firstFormIndex).some((text) =>
    text === "Lescontext" ||
    text === "Lesdoelen" ||
    text.startsWith("D1:") ||
    text.startsWith("Leergebied:"));
  if (!headerLooksGenerated) return documentXml;

  // Alleen losse kopparagrafen verwijderen. Staat er een tabel voor het
  // formulier, dan blijft alles staan: een lege tabelcel is ongeldig Word-XML.
  const formStart = ranges[firstFormIndex][0];
  const table = documentXml.indexOf("<w:tbl");
  if (table >= 0 && table < formStart) return documentXml;

  const chunks: string[] = [];
  let previous = 0;
  for (const [start, end] of ranges.slice(0, firstFormIndex)) {
    chunks.push(documentXml.slice(previous, start));
    previous = end;
  }
  chunks.push(documentXml.slice(previous));
  return chunks.join("");
}

const GOAL_HEADER = /(▪\s{0,8})?LESDOEL\s{1,8}(\d{1,2})\s{0,8}\([^)\n]{1,80}\):/giu;
const GOAL_END = /Gekoppeld aan minimumdoel:/giu;

/**
 * Bewerkingen voor formulieren waarin meerdere velden in één doorlopende tekst
 * staan. Alleen indexOf en begrensde patronen: geen herhaald herscannen.
 */
function formBlobEdits(text: string, lesson: LessonExportPayload) {
  const edits: TextEdit[] = [];
  const fields: Array<[string, string, string]> = [
    ["Leergebied:", "Onderdeel:", lesson.learningArea],
    ["Onderdeel:", "Lesonderwerp:", lesson.component],
    ["Lesonderwerp:", "Datum:", lesson.topic],
  ];
  for (const [label, nextLabel, value] of fields) {
    const first = text.indexOf(label);
    if (first < 0) continue;
    const end = text.indexOf(nextLabel, first + label.length);
    if (end < 0) continue;
    const start = text.lastIndexOf(label, end - label.length);
    edits.push({ start, end, text: `${label} ${singleLine(value) || " "} ` });
  }

  const activeGoals = lesson.goals.filter((goal) => goal.text.trim());
  if (activeGoals.length > 0) {
    const seen = new Set<number>();
    GOAL_HEADER.lastIndex = 0;
    for (let header = GOAL_HEADER.exec(text); header; header = GOAL_HEADER.exec(text)) {
      const goalNumber = Number(header[2]);
      const goal = activeGoals[goalNumber - 1];
      if (!goal || seen.has(goalNumber)) continue;
      seen.add(goalNumber);
      GOAL_END.lastIndex = GOAL_HEADER.lastIndex;
      const end = GOAL_END.exec(text);
      if (!end) break;
      edits.push({
        start: header.index,
        end: end.index,
        text: `${header[1] ?? ""}LESDOEL ${goalNumber} (${goal.taxonomy ?? "MC"}): ${singleLine(goal.text)} `,
      });
      if (seen.size === activeGoals.length) break;
    }
  }

  edits.sort((left, right) => left.start - right.start);
  let covered = 0;
  return edits.filter((edit) => {
    if (edit.start < covered) return false;
    covered = edit.end;
    return true;
  });
}

function patchFormBlobText(text: string, lesson: LessonExportPayload) {
  let cursor = 0;
  let updated = "";
  for (const edit of formBlobEdits(text, lesson)) {
    updated += text.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  return updated + text.slice(cursor);
}

function patchParagraph(paragraph: string, lesson: LessonExportPayload, activeGoals: LessonExportPayload["goals"]) {
  const text = paragraphText(paragraph);
  const blobEdits = formBlobEdits(text, lesson);
  if (blobEdits.length > 0) return spliceParagraphText(paragraph, blobEdits);

  const fields: Array<[string, string]> = [
    ["Leergebied:", lesson.learningArea],
    ["Onderdeel:", lesson.component],
    ["Doelgroep:", lesson.targetGroup],
    ["Lesonderwerp:", lesson.topic],
  ];
  for (const [label, value] of fields) {
    if (text.startsWith(label)) return replaceParagraphValue(paragraph, label, value);
  }

  const exportGoal = activeGoals.find((goal) => text.startsWith(`${goal.id}:`));
  return exportGoal ? replaceGoalParagraph(paragraph, `${exportGoal.id}:`, exportGoal) : undefined;
}

/** `fields` telt de herkende velden, ook wanneer de waarde al gelijk was. */
function patchDocumentXmlDetailed(documentXml: string, lesson: LessonExportPayload) {
  const xml = stripGeneratedExportHeader(documentXml);
  const activeGoals = lesson.goals.filter((goal) => goal.text.trim());
  const chunks: string[] = [];
  let previous = 0;
  let fields = 0;
  for (const [start, end] of paragraphRanges(xml)) {
    const patched = patchParagraph(xml.slice(start, end), lesson, activeGoals);
    if (patched === undefined) continue;
    fields += 1;
    chunks.push(xml.slice(previous, start), patched);
    previous = end;
  }
  chunks.push(xml.slice(previous));
  return { xml: chunks.join(""), fields };
}

function patchDocumentXml(documentXml: string, lesson: LessonExportPayload) {
  return patchDocumentXmlDetailed(documentXml, lesson).xml;
}

function templateDirectory() {
  return path.join(process.cwd(), "data", "templates");
}

export function localTemplatePath(fileName = LOCAL_TEMPLATE_FILE) {
  return path.join(templateDirectory(), fileName);
}

export function tryLoadLocalTemplateBuffer(fileName = LOCAL_TEMPLATE_FILE) {
  const templatePath = localTemplatePath(fileName);
  if (!existsSync(templatePath)) return undefined;

  try {
    return readFileSync(templatePath);
  } catch {
    return undefined;
  }
}

function safeTopicFileName(topic: string) {
  return topic
    .trim()
    .toLocaleLowerCase("nl-BE")
    .normalize("NFKD").replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/gu, "");
}

/** Eén regel tekst als paragraaf; tabs worden echte Word-tabs. */
function paragraphXml(text: string) {
  if (!text) return "<w:p/>";
  const runs = text.split("\t")
    .map((part) => (part ? `<w:t xml:space="preserve">${escapeXml(part)}</w:t>` : ""))
    .join("<w:tab/>");
  return `<w:p><w:r>${runs}</w:r></w:p>`;
}

// Tekst comprimeert sterk. Zonder compressie kan een lange les of een groot
// bronformulier de transportgrens van de documentworker overschrijden.
const DOCX_OUTPUT = { type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 3 } } as const;

export async function generateGenericLessonDocx(lesson: LessonExportPayload) {
  const activeGoals = lesson.goals.filter((goal) => goal.text.trim());
  const paragraphs = [
    "Lesvoorbereiding export",
    "Lescontext",
    `Leergebied: ${lesson.learningArea.trim() || " "}`,
    `Onderdeel: ${lesson.component.trim() || " "}`,
    `Doelgroep: ${lesson.targetGroup.trim() || " "}`,
    `Lesonderwerp: ${lesson.topic.trim() || " "}`,
    `Onderwijsnet: ${lesson.educationNetwork}`,
    `Totale lestijd: ${lesson.totalMinutes} min`,
    "Lesdoelen",
    ...activeGoals.map(
      (goal) =>
        `${goal.id}: ${goal.text.trim()}${goal.taxonomy ? ` (${goal.taxonomy})` : ""}`,
    ),
    "Materialen",
    lesson.materials.length > 0 ? lesson.materials.join(", ") : " ",
    "Lesvoorbereiding",
    lesson.lessonPreparation.trim() || " ",
  ];

  const body = paragraphs.flatMap((text) => text.split(/\r\n?|\n/)).map(paragraphXml).join("");
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
  return Buffer.from(await zip.generateAsync(DOCX_OUTPUT));
}

/** Geeft ook terug hoeveel formuliervelden werkelijk herkend zijn. */
async function patchLessonDocxDetailed(
  sourceBuffer: Buffer,
  lesson: LessonExportPayload,
) {
  const zip = await JSZip.loadAsync(sourceBuffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) {
    throw new DocumentUserError("Het document bevat geen leesbare Word-inhoud.");
  }

  const patched = patchDocumentXmlDetailed(documentXml, lesson);
  zip.file("word/document.xml", patched.xml);
  return {
    buffer: Buffer.from(await zip.generateAsync(DOCX_OUTPUT)),
    fields: patched.fields,
  };
}

export async function patchLessonDocx(
  sourceBuffer: Buffer,
  lesson: LessonExportPayload,
) {
  const patched = await patchLessonDocxDetailed(sourceBuffer, lesson);
  if (patched.fields === 0) {
    throw new DocumentUserError(
      "Het bronformulier bevat geen herkenbare exportvelden. Exporteer zonder bronformulier.",
    );
  }
  return patched.buffer;
}

function defaultExportFileName(topic: string) {
  const safeTopic = safeTopicFileName(topic);
  return `lesvoorbereiding-${safeTopic || "export"}.docx`;
}

export function sanitizeDownloadFileName(name: string) {
  const base = name.replace(/^.*[/\\]/, "").replace(/[\r\n"]/g, "");
  const cleaned = base
    .normalize("NFKD").replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9_.() -]+/g, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 120);
  if (!cleaned) {
    return "lesvoorbereiding.docx";
  }
  return cleaned.toLowerCase().endsWith(".docx")
    ? cleaned
    : `${cleaned}.docx`;
}

export async function exportLessonDocument(
  lesson: LessonExportPayload,
  sourceBuffer?: Buffer,
  sourceFileName?: string,
) {
  if (sourceBuffer && sourceFileName) {
    const extension = lessonDocumentExtension(sourceFileName);
    if (extension === "doc") {
      throw new DocumentUserError(
        "Oude .doc-bestanden worden niet ondersteund voor export. Upload het formulier als .docx.",
      );
    }
    if (extension === "docx") {
      return {
        buffer: await patchLessonDocx(sourceBuffer, lesson),
        fileName: sanitizeDownloadFileName(sourceFileName),
        exportMode: "patched-source" as const,
      };
    }
  }

  // Een lokaal sjabloon zonder herkenbare velden mag de export niet blokkeren
  // en mag ook niet als ingevuld sjabloon worden gemeld.
  const localTemplate = tryLoadLocalTemplateBuffer();
  const template = localTemplate
    ? await patchLessonDocxDetailed(localTemplate, lesson).catch(() => undefined)
    : undefined;
  if (template && template.fields > 0) {
    return {
      buffer: template.buffer,
      fileName: defaultExportFileName(lesson.topic),
      exportMode: "local-template" as const,
    };
  }

  return {
    buffer: await generateGenericLessonDocx(lesson),
    fileName: defaultExportFileName(lesson.topic),
    exportMode: "generated" as const,
  };
}

export const __testables = {
  escapeXml,
  patchDocumentXml,
  patchDocumentXmlDetailed,
  patchFormBlobText,
  stripGeneratedExportHeader,
};
