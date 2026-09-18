import { getLessonDocument } from "@/lib/documents/documentStorage";
import { useLessonStore } from "@/stores/useLessonStore";
import type { LessonPreparationDocument } from "@/types";
import { captureStorageSession } from "@/lib/storage/userStorageScope";

const syncInFlight = new Map<string, { signal: AbortSignal; promise: Promise<string | null> }>();

export async function syncPreparationTextFromDocument(
  document: LessonPreparationDocument,
): Promise<string | null> {
  const session = captureStorageSession();
  const { lesson, syncPreparation } = useLessonStore.getState();

  if (lesson.lessonPreparation.trim()) {
    return lesson.lessonPreparation;
  }

  const key = `${session.userId}:${document.id}`;
  const existing = syncInFlight.get(key);
  if (existing && !existing.signal.aborted) return existing.promise;

  const promise = (async () => {
    const blob = await getLessonDocument(document.id);
    if (!blob || !session.isCurrent()) return null;

    const file = new File([blob], document.fileName, {
      type: document.mimeType || blob.type || "application/octet-stream",
    });
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/import-lesson-document", {
      method: "POST",
      body: formData,
      signal: session.signal,
    });
    const payload = (await response.json()) as {
      error?: string;
      text?: string;
    };

    if (!session.isCurrent() || !response.ok || !payload.text?.trim()) {
      return null;
    }

    syncPreparation(payload.text);
    return payload.text;
  })().catch((error: unknown) => {
    if (!session.isCurrent()) return null;
    throw error;
  });

  syncInFlight.set(key, { signal: session.signal, promise });

  try {
    return await promise;
  } finally {
    if (syncInFlight.get(key)?.promise === promise) syncInFlight.delete(key);
  }
}
