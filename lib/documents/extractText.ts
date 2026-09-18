import "server-only";
import { parseInWorker } from "@/lib/documents/parserWorker";
// Archive helpers are used by unit tests; request handlers never unpack here.
export { assertSafeZipPath, assertSafeZipArchive, sanitizeZipArchive, readZipEntryBounded, MAX_ARCHIVE_ENTRIES, MAX_ARCHIVE_ENTRY_BYTES, MAX_ARCHIVE_TOTAL_BYTES, MAX_UNZIP_MS, MAX_ZIP_INFLATION_RATIO } from "./extractionCore";
export async function extractDocumentText(bytes: Buffer, fileName: string, signal?: AbortSignal) {
  return parseInWorker(bytes, fileName, signal);
}
