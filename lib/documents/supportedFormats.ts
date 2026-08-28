export const LESSON_DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.odt,.rtf,.txt,.md,.csv";

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

export const LESSON_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;

export function lessonDocumentExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isSupportedLessonDocument(fileName: string) {
  return LESSON_DOCUMENT_EXTENSIONS.has(lessonDocumentExtension(fileName));
}
