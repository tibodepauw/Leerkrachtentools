import { extractDocumentText, sanitizeZipArchive } from "@/lib/documents/extractionCore";
import { exportLessonDocument } from "@/lib/documents/exportLessonDocument";
import { canonicalProfileImage } from "@/lib/documents/imageCore";
import { readJob, writeJob } from "./wire";
import type { DocumentJob } from "@/lib/documents/parserWorker";

async function main() {
  const input = await readJob(12_000_000) as DocumentJob;
  if (!input || typeof input !== "object") throw new Error("invalid job");
  const bytes = Buffer.from(input.bytes ?? "", "base64");
  if (bytes.length > 8 * 1024 * 1024) throw new Error("input limit");
  switch (input.operation) {
    case "extract":
      return { text: await extractDocumentText(bytes, input.fileName ?? "") };
    case "avatar":
      if (bytes.length > 2 * 1024 * 1024) throw new Error("input limit");
      return { bytes: (await canonicalProfileImage(bytes)).toString("base64") };
    case "export": {
      if (!input.lesson) throw new Error("missing lesson");
      const source = input.bytes ? await sanitizeZipArchive(bytes) : undefined;
      const result = await exportLessonDocument(input.lesson, source, input.fileName);
      return { bytes: result.buffer.toString("base64"), fileName: result.fileName, exportMode: result.exportMode };
    }
    default: throw new Error("unknown operation");
  }
}
main().then((result) => writeJob(result, 12_000_000)).catch((error) => {
  const message = error instanceof Error && error.message.startsWith("Kies een niet-geanimeerde afbeelding")
    ? error.message : "Het document kon niet veilig worden ingelezen.";
  writeJob({ error: message }, 1000);
});
