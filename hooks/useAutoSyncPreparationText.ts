"use client";

import { useEffect, useState } from "react";
import { syncPreparationTextFromDocument } from "@/lib/documents/syncPreparationTextFromDocument";
import { needsPreparationTextSync } from "@/lib/lesson/preparationText";
import { useLessonStore } from "@/stores/useLessonStore";

export function useAutoSyncPreparationText() {
  const lesson = useLessonStore((state) => state.lesson);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    const document = lesson.preparationDocument;
    if (!needsPreparationTextSync(lesson) || !document) {
      setSyncing(false);
      setSyncError("");
      return;
    }

    let cancelled = false;
    setSyncing(true);
    setSyncError("");

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
  }, [lesson.preparationDocument, lesson.lessonPreparation]);

  return { syncing, syncError };
}
