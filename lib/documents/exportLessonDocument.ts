import "server-only";

import JSZip from "jszip";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LessonExportPayload } from "@/types";
import { lessonDocumentExtension } from "@/lib/documents/supportedFormats";

const TEMPLATE_FILE = "lesvoorbereidingsformulier_2526DEF-1.docx";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function paragraphText(paragraphXml: string) {
  return paragraphXml.replace(/<[^>]+>/g, "");
}

function replaceParagraphValue(paragraphXml: string, label: string, value: string) {
  const runs = [...paragraphXml.matchAll(/<w:r[\s\S]*?<\/w:r>/g)];
  if (runs.length < 2) return paragraphXml;

  let labelSeen = false;
  const updatedRuns = runs.map((match) => {
    const run = match[0];
    const text = run.replace(/<[^>]+>/g, "");
    if (!labelSeen && text.includes(label)) {
      labelSeen = true;
      return run;
    }
    if (labelSeen) {
      return run.replace(
        /<w:t[^>]*>[\s\S]*?<\/w:t>/,
        `<w:t xml:space="preserve">${escapeXml(value || " ")}</w:t>`,
      );
    }
    return run;
  });

  if (!labelSeen) return paragraphXml;

  let index = 0;
  return paragraphXml.replace(/<w:r[\s\S]*?<\/w:r>/g, () => updatedRuns[index++] ?? "");
}

function replaceGoalParagraph(paragraphXml: string, goalLabel: string, goal: { text: string; taxonomy?: string }) {
  const text = paragraphText(paragraphXml);
  if (!text.startsWith(goalLabel)) return paragraphXml;

  const taxonomySuffix = goal.taxonomy ? ` (${goal.taxonomy})` : "";
  const nextText = `${goalLabel}${goal.text.trim()}${taxonomySuffix}`;

  return paragraphXml.replace(
    /<w:p([^>]*)>[\s\S]*<\/w:p>/,
    (full, attrs) => {
      const body = full.slice(full.indexOf(">") + 1, full.lastIndexOf("</w:p>"));
      const firstRun = body.match(/<w:r[\s\S]*?<\/w:r>/);
      if (!firstRun) return full;

      const preservedProps = body.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
      const runProps = firstRun[0].match(/<w:rPr[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
      return `<w:p${attrs}>${preservedProps}<w:r>${runProps}<w:t xml:space="preserve">${escapeXml(nextText)}</w:t></w:r></w:p>`;
    },
  );
}

function stripGeneratedExportHeader(documentXml: string) {
  if (!documentXml.includes("Lesvoorbereidingsformulier")) return documentXml;

  const paragraphs = [...documentXml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)].map(
    (match) => match[0],
  );
  if (paragraphs.length <= 1) return documentXml;

  const firstFormIndex = paragraphs.findIndex((paragraph) =>
    paragraphText(paragraph).includes("Lesvoorbereidingsformulier"),
  );
  if (firstFormIndex <= 0) return documentXml;

  const headerLooksGenerated = paragraphs
    .slice(0, firstFormIndex)
    .some((paragraph) => {
      const text = paragraphText(paragraph);
      return (
        text === "Lescontext" ||
        text === "Lesdoelen" ||
        text.startsWith("D1:") ||
        text.startsWith("Leergebied:")
      );
    });

  if (!headerLooksGenerated) return documentXml;

  const kept = paragraphs.slice(firstFormIndex);
  const bodyMatch = documentXml.match(/<w:body>([\s\S]*)<\/w:sectPr/);
  if (!bodyMatch) return documentXml;

  const sectPr = documentXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] ?? "";
  return documentXml.replace(
    bodyMatch[0],
    `<w:body>${kept.join("")}${sectPr}`,
  );
}

function patchFormBlobText(text: string, lesson: LessonExportPayload) {
  let updated = text;

  const situeringReplacements: Array<[RegExp, string]> = [
    [/Leergebied:\s*.+?(?=Onderdeel:)/u, `Leergebied: ${lesson.learningArea.trim() || " "} `],
    [/Onderdeel:\s*.+?(?=Lesonderwerp:)/u, `Onderdeel: ${lesson.component.trim() || " "} `],
    [/Lesonderwerp:\s*.+?(?=Datum:)/u, `Lesonderwerp: ${lesson.topic.trim() || " "} `],
  ];

  for (const [pattern, replacement] of situeringReplacements) {
    updated = updated.replace(pattern, replacement);
  }

  const activeGoals = lesson.goals.filter((goal) => goal.text.trim());
  activeGoals.forEach((goal, index) => {
    const goalNumber = index + 1;
    const taxonomy = goal.taxonomy ?? "MC";
    const pattern = new RegExp(
      `(▪\\s*)?LESDOEL\\s+${goalNumber}\\s*\\([^)]+\\):\\s*([\\s\\S]*?)\\s*(?=Gekoppeld aan minimumdoel:)`,
      "iu",
    );
    updated = updated.replace(
      pattern,
      `$1LESDOEL ${goalNumber} (${taxonomy}): ${goal.text.trim()} `,
    );
  });

  return updated;
}

function patchDocumentXml(documentXml: string, lesson: LessonExportPayload) {
  let xml = stripGeneratedExportHeader(documentXml);
  const activeGoals = lesson.goals.filter((goal) => goal.text.trim());

  xml = xml.replace(/<w:p[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = paragraphText(paragraph);
    if (text.startsWith("Leergebied:")) {
      return replaceParagraphValue(paragraph, "Leergebied: ", lesson.learningArea);
    }
    if (text.startsWith("Onderdeel:")) {
      return replaceParagraphValue(paragraph, "Onderdeel: ", lesson.component);
    }
    if (text.startsWith("Doelgroep:")) {
      return replaceParagraphValue(paragraph, "Doelgroep: ", lesson.targetGroup);
    }
    if (text.startsWith("Lesonderwerp:")) {
      return replaceParagraphValue(paragraph, "Lesonderwerp: ", lesson.topic);
    }

    const exportGoal = activeGoals.find((goal) => text.startsWith(`${goal.id}:`));
    if (exportGoal) {
      return replaceGoalParagraph(paragraph, `${exportGoal.id}: `, exportGoal);
    }

    return paragraph;
  });

  xml = xml.replace(/(<w:t(?:\s+xml:space="preserve")?>)([\s\S]*?)(<\/w:t>)/g, (match, open, content, close) => {
    if (!content.includes("LESDOEL 1") && !content.includes("Lesvoorbereidingsformulier")) {
      return match;
    }
    const patched = patchFormBlobText(content, lesson);
    if (patched === content) return match;
    return `${open}${escapeXml(patched)}${close}`;
  });

  return xml;
}

export function templatePath() {
  return path.join(process.cwd(), "data", "templates", TEMPLATE_FILE);
}

export function loadLessonTemplateBuffer() {
  return readFileSync(templatePath());
}

export async function patchLessonDocx(
  sourceBuffer: Buffer,
  lesson: LessonExportPayload,
) {
  const zip = await JSZip.loadAsync(sourceBuffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) {
    throw new Error("Het document bevat geen leesbare Word-inhoud.");
  }

  const patchedXml = patchDocumentXml(documentXml, lesson);
  zip.file("word/document.xml", patchedXml);
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

export async function exportLessonDocument(
  lesson: LessonExportPayload,
  sourceBuffer?: Buffer,
  sourceFileName?: string,
) {
  const extension = sourceFileName
    ? lessonDocumentExtension(sourceFileName)
    : "docx";

  if (sourceBuffer && (extension === "docx" || extension === "doc")) {
    if (extension === "doc") {
      throw new Error(
        "Oude .doc-bestanden worden niet ondersteund voor export. Upload het formulier als .docx.",
      );
    }
    return {
      buffer: await patchLessonDocx(sourceBuffer, lesson),
      fileName: sourceFileName ?? "lesvoorbereiding.docx",
      usedTemplate: false,
    };
  }

  const templateBuffer = loadLessonTemplateBuffer();
  const buffer = await patchLessonDocx(templateBuffer, lesson);
  const safeTopic = lesson.topic
    .trim()
    .toLocaleLowerCase("nl-BE")
    .replace(/[^a-z0-9à-ÿ]+/giu, "-")
    .replace(/^-|-$/gu, "");

  return {
    buffer,
    fileName: `lesvoorbereiding-${safeTopic || "formulier"}.docx`,
    usedTemplate: true,
  };
}

// Exported for tests
export const __testables = {
  escapeXml,
  patchDocumentXml,
  patchFormBlobText,
  stripGeneratedExportHeader,
};
