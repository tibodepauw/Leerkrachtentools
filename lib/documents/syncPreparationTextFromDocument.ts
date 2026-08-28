import { getLessonDocument } from "@/lib/documents/documentStorage";
import { useLessonStore } from "@/stores/useLessonStore";
import type { LessonPreparationDocument } from "@/types";

const syncInFlight = new Map<string, Promise<string | null>>();

export async function syncPreparationTextFromDocument(
  document: LessonPreparationDocument,
): Promise<string | null> {
  const { lesson, syncPreparation } = useLessonStore.getState();

  if (lesson.lessonPreparation.trim()) {
    return lesson.lessonPreparation;
  }

  const existing = syncInFlight.get(document.id);
  if (existing) return existing;

  const promise = (async () => {
    const blob = await getLessonDocument(document.id);
    if (!blob) return null;

    const file = new File([blob], document.fileName, {
      type: document.mimeType || blob.type || "application/octet-stream",
    });
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/import-lesson-document", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as {
      error?: string;
      text?: string;
    };

    if (!response.ok || !payload.text?.trim()) {
      return null;
    }

    syncPreparation(payload.text);
    return payload.text;
  })();

  syncInFlight.set(document.id, promise);

  try {
    return await promise;
  } finally {
    syncInFlight.delete(document.id);
  }
}
