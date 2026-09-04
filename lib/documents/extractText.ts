import "server-only";

import JSZip from "jszip";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import WordExtractor from "word-extractor";
import {
  isSupportedLessonDocument,
  lessonDocumentExtension,
} from "@/lib/documents/supportedFormats";

const MAX_ARCHIVE_ENTRIES = 2_000;
const MAX_ARCHIVE_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_ARCHIVE_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARS = 500_000;

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

export async function assertSafeZipArchive(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files);
  if (entries.length > MAX_ARCHIVE_ENTRIES) {
    throw new Error("Het document bevat te veel onderdelen.");
  }

  let total = 0;
  for (const entry of entries) {
    if (entry.dir) continue;
    const size = (
      entry as typeof entry & {
        _data?: { uncompressedSize?: number };
      }
    )._data?.uncompressedSize;
    if (!Number.isSafeInteger(size) || size! < 0) {
      throw new Error("De uitgepakte documentgrootte kon niet worden bepaald.");
    }
    if (size! > MAX_ARCHIVE_ENTRY_BYTES) {
      throw new Error("Een onderdeel van het document is te groot.");
    }
    total += size!;
    if (total > MAX_ARCHIVE_TOTAL_BYTES) {
      throw new Error("Het uitgepakte document is te groot.");
    }
  }
}

export async function extractDocumentText(buffer: Buffer, fileName: string) {
  if (!isSupportedLessonDocument(fileName)) {
    throw new Error(
      "Ondersteunde formaten: PDF, DOC, DOCX, ODT, RTF, TXT en MD.",
    );
  }

  const extension = lessonDocumentExtension(fileName);
  if (extension === "docx" || extension === "odt") {
    await assertSafeZipArchive(buffer);
  }

  let extracted: string;
  switch (extension) {
    case "txt":
    case "md":
    case "csv":
      extracted = normalizeText(buffer.toString("utf8"));
      break;
    case "rtf":
      extracted = stripRtf(buffer.toString("utf8"));
      break;
    case "docx":
      extracted = normalizeText(
        (await mammoth.extractRawText({ buffer })).value,
      );
      break;
    case "doc": {
      const document = await new WordExtractor().extract(buffer);
      extracted = normalizeText(document.getBody());
      break;
    }
    case "pdf": {
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        extracted = normalizeText(parsed.text);
      } finally {
        await parser.destroy();
      }
      break;
    }
    case "odt":
      extracted = await extractOdtText(buffer);
      break;
    default:
      throw new Error(
        "Ondersteunde formaten: PDF, DOC, DOCX, ODT, RTF, TXT en MD.",
      );
  }

  if (extracted.length > MAX_EXTRACTED_TEXT_CHARS) {
    throw new Error("Het document bevat te veel tekst.");
  }
  return extracted;
}
