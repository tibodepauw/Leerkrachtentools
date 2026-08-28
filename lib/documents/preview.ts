import { lessonDocumentExtension } from "@/lib/documents/supportedFormats";

export type LessonDocumentPreviewMode = "pdf" | "docx" | "text" | "unsupported";

export function mimeTypeFromFileName(fileName: string) {
  switch (lessonDocumentExtension(fileName)) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "doc":
      return "application/msword";
    case "odt":
      return "application/vnd.oasis.opendocument.text";
    case "rtf":
      return "application/rtf";
    case "txt":
      return "text/plain";
    case "md":
      return "text/markdown";
    case "csv":
      return "text/csv";
    default:
      return "application/octet-stream";
  }
}

export function previewModeFromFileName(fileName: string): LessonDocumentPreviewMode {
  switch (lessonDocumentExtension(fileName)) {
    case "pdf":
      return "pdf";
    case "docx":
      return "docx";
    case "txt":
    case "md":
    case "csv":
    case "rtf":
      return "text";
    default:
      return "unsupported";
  }
}

export function createLessonDocumentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
