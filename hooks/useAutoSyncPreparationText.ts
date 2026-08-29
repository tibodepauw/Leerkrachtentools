"use client";

import { useEffect, useState } from "react";
import { syncPreparationTextFromDocument } from "@/lib/documents/syncPreparationTextFromDocument";
import { needsPreparationTextSync } from "@/lib/lesson/preparationText";
import { useLessonStore } from "@/stores/useLessonStore";

export function useAutoSyncPreparationText() {
  const lesson = useLessonStore((state) => state.lesson);
  const shouldSync =
    needsPreparationTextSync(lesson) && Boolean(lesson.preparationDocument);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    const document = lesson.preparationDocument;
    if (!shouldSync || !document) {
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setSyncing(true);
      setSyncError("");
    });

    void syncPreparationTextFromDocument(document)
      .then((text) => {
        if (cancelled) return;
        if (!text) {
          setSyncError(
            "Tekst kon niet uit je document worden gehaald. Plak de lesvoorbereiding handmatig.",
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSyncError(
            "Tekst kon niet uit je document worden gehaald. Plak de lesvoorbereiding handmatig.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lesson.preparationDocument, lesson.lessonPreparation, shouldSync]);

  return {
    syncing: shouldSync ? syncing : false,
    syncError: shouldSync ? syncError : "",
  };
}
