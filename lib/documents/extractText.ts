import "server-only";

import { createInflateRaw } from "node:zlib";
import JSZip from "jszip";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import WordExtractor from "word-extractor";
import {
  isSupportedLessonDocument,
  lessonDocumentExtension,
} from "@/lib/documents/supportedFormats";

export const MAX_ARCHIVE_ENTRIES = 2_000;
export const MAX_ARCHIVE_ENTRY_BYTES = 20 * 1024 * 1024;
export const MAX_ARCHIVE_TOTAL_BYTES = 50 * 1024 * 1024;
export const MAX_UNZIP_MS = 8_000;
export const MAX_ZIP_INFLATION_RATIO = 100;
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

export function assertSafeZipPath(name: string) {
  const normalized = name.replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.includes("\0") ||
    normalized.startsWith("/") ||
    normalized.includes("..")
  ) {
    throw new Error("Het document bevat een ongeldig pad.");
  }
}

function concatChunks(chunks: Uint8Array[], total: number) {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function entryCompressedPayload(entry: JSZip.JSZipObject) {
  const data = (
    entry as unknown as {
      _data?: {
        compressedContent?: Uint8Array | Buffer | string;
        compression?: { magic?: string };
      };
    }
  )._data;
  if (!data?.compressedContent) return null;
  const bytes = Buffer.from(
    typeof data.compressedContent === "string"
      ? Buffer.from(data.compressedContent, "binary")
      : data.compressedContent,
  );
  return {
    bytes,
    store: data.compression?.magic === "\x00\x00",
  };
}

function inflateRawBounded(
  compressed: Buffer,
  maxBytes: number,
  startedAt: number,
  maxMs: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const inflater = createInflateRaw();
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      inflater.destroy();
      reject(error);
    };
    inflater.on("data", (chunk: Buffer) => {
      if (Date.now() - startedAt > maxMs) {
        fail(new Error("Het uitpakken duurde te lang."));
        return;
      }
      total += chunk.length;
      if (total > maxBytes) {
        fail(new Error("Een onderdeel van het document is te groot."));
        return;
      }
      chunks.push(chunk);
    });
    inflater.on("error", (error: Error) => {
      fail(
        error instanceof Error
          ? error
          : new Error("ZIP-decompressie mislukt."),
      );
    });
    inflater.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(concatChunks(chunks, total));
    });
    inflater.end(compressed);
  });
}

export function readZipEntryBounded(
  entry: JSZip.JSZipObject,
  maxBytes: number,
  startedAt: number,
  maxMs: number,
): Promise<Uint8Array> {
  const payload = entryCompressedPayload(entry);
  if (payload) {
    if (payload.store) {
      if (payload.bytes.length > maxBytes) {
        return Promise.reject(new Error("Een onderdeel van het document is te groot."));
      }
      return Promise.resolve(new Uint8Array(payload.bytes));
    }
    return inflateRawBounded(payload.bytes, maxBytes, startedAt, maxMs);
  }

  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    let settled = false;
    const stream = entry.internalStream("uint8array");

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      try {
        stream.pause();
      } catch {
        // Stream may already be closed.
      }
      reject(error);
    };

    stream
      .on("data", (chunk: Uint8Array) => {
        if (settled) return;
        if (Date.now() - startedAt > maxMs) {
          fail(new Error("Het uitpakken duurde te lang."));
          return;
        }
        total += chunk.length;
        if (total > maxBytes) {
          fail(new Error("Een onderdeel van het document is te groot."));
          return;
        }
        chunks.push(chunk);
      })
      .on("error", (error: Error) => {
        fail(
          error instanceof Error
            ? error
            : new Error("ZIP-decompressie mislukt."),
        );
      })
      .on("end", () => {
        if (settled) return;
        settled = true;
        resolve(concatChunks(chunks, total));
      })
      .resume();
  });
}

export async function sanitizeZipArchive(buffer: Buffer): Promise<Buffer> {
  const startedAt = Date.now();
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files);
  if (names.length > MAX_ARCHIVE_ENTRIES) {
    throw new Error("Het document bevat te veel onderdelen.");
  }

  const out = new JSZip();
  let total = 0;
  for (const name of names) {
    if (Date.now() - startedAt > MAX_UNZIP_MS) {
      throw new Error("Het uitpakken duurde te lang.");
    }
    assertSafeZipPath(name);
    const entry = zip.files[name];
    if (entry.dir) {
      out.folder(name);
      continue;
    }
    const data = await readZipEntryBounded(
      entry,
      MAX_ARCHIVE_ENTRY_BYTES,
      startedAt,
      MAX_UNZIP_MS,
    );
    total += data.length;
    if (total > MAX_ARCHIVE_TOTAL_BYTES) {
      throw new Error("Het uitgepakte document is te groot.");
    }
    if (
      buffer.length > 0 &&
      total > buffer.length * MAX_ZIP_INFLATION_RATIO &&
      total > 1_000_000
    ) {
      throw new Error("Het document is te sterk gecomprimeerd.");
    }
    out.file(name, data);
  }

  return Buffer.from(
    await out.generateAsync({ type: "uint8array", compression: "STORE" }),
  );
}

export async function assertSafeZipArchive(buffer: Buffer) {
  await sanitizeZipArchive(buffer);
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
  let source = buffer;
  if (extension === "docx" || extension === "odt") {
    source = await sanitizeZipArchive(buffer);
  }

  let extracted: string;
  switch (extension) {
    case "txt":
    case "md":
    case "csv":
      extracted = normalizeText(source.toString("utf8"));
      break;
    case "rtf":
      extracted = stripRtf(source.toString("utf8"));
      break;
    case "docx":
      extracted = normalizeText(
        (await mammoth.extractRawText({ buffer: source })).value,
      );
      break;
    case "doc": {
      const document = await new WordExtractor().extract(source);
      extracted = normalizeText(document.getBody());
      break;
    }
    case "pdf": {
      const parser = new PDFParse({ data: source });
      try {
        const parsed = await parser.getText();
        extracted = normalizeText(parsed.text);
      } finally {
        await parser.destroy();
      }
      break;
    }
    case "odt":
      extracted = await extractOdtText(source);
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
