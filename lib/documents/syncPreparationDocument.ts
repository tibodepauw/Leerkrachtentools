import { saveLessonDocument } from "@/lib/documents/documentStorage";
import {
  createLessonDocumentId,
  mimeTypeFromFileName,
} from "@/lib/documents/preview";
import { useLessonStore } from "@/stores/useLessonStore";
import type { LessonPreparationDocument } from "@/types";

export async function syncPreparationDocumentFromFile(file: File) {
  const currentDocument = useLessonStore.getState().lesson.preparationDocument;
  const id = createLessonDocumentId();
  const document: LessonPreparationDocument = {
    id,
    fileName: file.name,
    mimeType: file.type || mimeTypeFromFileName(file.name),
    uploadedAt: new Date().toISOString(),
  };

  await saveLessonDocument(id, file);
  useLessonStore.getState().setPreparationDocument(document, currentDocument?.id);
  return document;
}
