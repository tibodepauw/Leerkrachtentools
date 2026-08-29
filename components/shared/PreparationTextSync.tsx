"use client";

import { useEffect } from "react";
import { syncPreparationTextFromDocument } from "@/lib/documents/syncPreparationTextFromDocument";
import { needsPreparationTextSync } from "@/lib/lesson/preparationText";
import { useLessonStore } from "@/stores/useLessonStore";

export function PreparationTextSync() {
  const lesson = useLessonStore((state) => state.lesson);

  useEffect(() => {
    const document = lesson.preparationDocument;
    if (!needsPreparationTextSync(lesson) || !document) return;

    void syncPreparationTextFromDocument(document);
  }, [lesson]);

  return null;
}
