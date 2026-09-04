export const LESSON_DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.odt,.rtf,.txt,.md,.csv";

export const MANUAL_SCANNER_ACCEPT = `${LESSON_DOCUMENT_ACCEPT},image/*`;

export const LESSON_DOCUMENT_FORMATS_LABEL =
  "PDF, DOC, DOCX, ODT, RTF, TXT, MD, CSV";

export const MANUAL_SCANNER_FORMATS_LABEL = `${LESSON_DOCUMENT_FORMATS_LABEL} of afbeelding`;

export const MANUAL_SCANNER_UPLOAD_HELPER = `${MANUAL_SCANNER_FORMATS_LABEL} · max. 8 MB`;

export const LESSON_DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "odt",
  "rtf",
  "txt",
  "md",
  "csv",
]);

export const LESSON_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;

export function lessonDocumentExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isSupportedLessonDocument(fileName: string) {
  return LESSON_DOCUMENT_EXTENSIONS.has(lessonDocumentExtension(fileName));
}

export function hasValidLessonDocumentSignature(
  buffer: Uint8Array,
  fileName: string,
) {
  const startsWith = (signature: readonly number[]) =>
    signature.every((byte, index) => buffer[index] === byte);
  const extension = lessonDocumentExtension(fileName);
  if (extension === "pdf") {
    return startsWith([0x25, 0x50, 0x44, 0x46, 0x2d]);
  }
  if (extension === "doc") {
    return startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
  if (extension === "docx" || extension === "odt") {
    return (
      startsWith([0x50, 0x4b, 0x03, 0x04]) ||
      startsWith([0x50, 0x4b, 0x05, 0x06])
    );
  }
  if (extension === "rtf") {
    return startsWith([0x7b, 0x5c, 0x72, 0x74, 0x66]);
  }
  return extension === "txt" || extension === "md" || extension === "csv";
}

export function isManualScannerImage(file: Pick<File, "name" | "type">) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp|heic)$/i.test(file.name);
}

export function isManualScannerFile(file: Pick<File, "name" | "type">) {
  return isSupportedLessonDocument(file.name) || isManualScannerImage(file);
}

/** PDF, images and plain text can go straight to Gemini; Office formats need local text extraction. */
export function isGeminiDirectManualFile(file: Pick<File, "name" | "type">) {
  if (isManualScannerImage(file)) return true;

  const extension = lessonDocumentExtension(file.name);
  if (extension === "pdf" || file.type === "application/pdf") return true;
  if (extension === "txt" || extension === "md" || extension === "csv") return true;
  if (file.type.startsWith("text/")) return true;

  return false;
}
