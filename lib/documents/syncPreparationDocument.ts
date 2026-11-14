import { saveLessonDocument, deleteLessonDocument } from "@/lib/documents/documentStorage";
import {
  createLessonDocumentId,
  mimeTypeFromFileName,
} from "@/lib/documents/preview";
import { useLessonStore } from "@/stores/useLessonStore";
import type { LessonPreparationDocument } from "@/types";
import { captureStorageSession } from "@/lib/storage/userStorageScope";

export async function syncPreparationDocumentFromFile(file: File) {
  const session = captureStorageSession();
  const original = useLessonStore.getState().lesson;
  const currentDocument = original.preparationDocument;
  const id = createLessonDocumentId();
  const document: LessonPreparationDocument = {
    id,
    fileName: file.name,
    mimeType: file.type || mimeTypeFromFileName(file.name),
    uploadedAt: new Date().toISOString(),
  };

  await saveLessonDocument(id, file);
  session.assertCurrent();
  if (useLessonStore.getState().lesson !== original) {
    await deleteLessonDocument(id);
    throw new Error("Je les is intussen gewijzigd. Upload het document opnieuw om het te vervangen.");
  }
  useLessonStore.getState().setPreparationDocument(document, currentDocument?.id);
  return document;
}

/** Validate first: a failed upload must not replace the last usable document. */
export async function importPreparationDocumentFromFile(file: File) {
  const session = captureStorageSession();
  const original = useLessonStore.getState().lesson;
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/import-lesson-document", {
    method: "POST", body: formData, signal: session.signal,
  });
  const payload = await response.json() as { error?: string; text?: string };
  if (!response.ok || !payload.text?.trim()) throw new Error(payload.error ?? "Upload mislukt.");
  session.assertCurrent();
  if (useLessonStore.getState().lesson !== original) {
    throw new Error("Je les is intussen gewijzigd. Upload het document opnieuw om het te vervangen.");
  }
  await syncPreparationDocumentFromFile(file);
  session.assertCurrent();
  useLessonStore.getState().syncPreparation(payload.text);
  return payload.text;
}
