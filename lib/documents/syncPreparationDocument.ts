import { saveLessonDocument } from "@/lib/documents/documentStorage";
import {
  createLessonDocumentId,
  mimeTypeFromFileName,
} from "@/lib/documents/preview";
import { useLessonStore } from "@/stores/useLessonStore";
import type { LessonPreparationDocument } from "@/types";
import { captureStorageSession } from "@/lib/storage/userStorageScope";

export async function syncPreparationDocumentFromFile(file: File) {
  const session = captureStorageSession();
  const currentDocument = useLessonStore.getState().lesson.preparationDocument;
  const id = createLessonDocumentId();
  const document: LessonPreparationDocument = {
    id,
    fileName: file.name,
    mimeType: file.type || mimeTypeFromFileName(file.name),
    uploadedAt: new Date().toISOString(),
  };

  await saveLessonDocument(id, file);
  session.assertCurrent();
  useLessonStore.getState().setPreparationDocument(document, currentDocument?.id);
  return document;
}
