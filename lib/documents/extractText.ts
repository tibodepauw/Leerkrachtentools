import "server-only";

import JSZip from "jszip";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import WordExtractor from "word-extractor";
import {
  isSupportedLessonDocument,
  lessonDocumentExtension,
} from "@/lib/documents/supportedFormats";

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function stripRtf(content: string) {
  return normalizeText(
    content
      .replace(/\\par[d]?/gi, "\n")
      .replace(/\\'[0-9a-f]{2}/gi, " ")
      .replace(/\\[a-z]+\d*(?:\s)?/gi, " ")
      .replace(/[{}]/g, "")
      .replace(/[ \t]+\n/g, "\n"),
  );
}

async function extractOdtText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const content = await zip.file("content.xml")?.async("string");
  if (!content) {
    throw new Error("ODT-bestand bevat geen leesbare inhoud.");
  }

  return normalizeText(
    content
      .replace(/<text:p[^>]*>/g, "\n")
      .replace(/<text:line-break\/>/g, "\n")
      .replace(/<text:s[^>]*\/>/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">"),
  );
}

export async function extractDocumentText(buffer: Buffer, fileName: string) {
  if (!isSupportedLessonDocument(fileName)) {
    throw new Error(
      "Ondersteunde formaten: PDF, DOC, DOCX, ODT, RTF, TXT en MD.",
    );
  }

  const extension = lessonDocumentExtension(fileName);

  switch (extension) {
    case "txt":
    case "md":
    case "csv":
      return normalizeText(buffer.toString("utf8"));
    case "rtf":
      return stripRtf(buffer.toString("utf8"));
    case "docx":
      return normalizeText(
        (await mammoth.extractRawText({ buffer })).value,
      );
    case "doc": {
      const document = await new WordExtractor().extract(buffer);
      return normalizeText(document.getBody());
    }
    case "pdf": {
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        return normalizeText(parsed.text);
      } finally {
        await parser.destroy();
      }
    }
    case "odt":
      return extractOdtText(buffer);
    default:
      throw new Error(
        "Ondersteunde formaten: PDF, DOC, DOCX, ODT, RTF, TXT en MD.",
      );
  }
}
