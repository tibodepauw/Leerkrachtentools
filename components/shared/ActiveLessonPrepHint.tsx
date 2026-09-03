"use client";

import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  hasActiveLessonContext,
  hasLessonPreparation,
  needsPreparationTextSync,
} from "@/lib/lesson/preparationText";
import { useLessonStore } from "@/stores/useLessonStore";

export function ActiveLessonPrepHint() {
  const lesson = useLessonStore((state) => state.lesson);
  const setActiveModule = useLessonStore((state) => state.setActiveModule);

  if (!hasActiveLessonContext(lesson) || hasLessonPreparation(lesson)) {
    return null;
  }

  if (needsPreparationTextSync(lesson)) {
    const documentName = lesson.preparationDocument?.fileName ?? "je document";
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-neutral-100">
        <p>
          Je lesvoorbereiding{" "}
          <span className="font-medium">{documentName}</span> staat klaar in
          Actieve les. De tekst wordt automatisch ingeladen voor analyse.
        </p>
      </div>
    );
  }

  const title = lesson.topic.trim() || "zonder titel";

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-neutral-100">
      <p>
        Je actieve les <span className="font-medium">{title}</span> is
        herkend, maar er staat nog geen lesvoorbereidingstekst klaar.
      </p>
      <p className="mt-1 text-neutral-300">
        De Handleiding Scanner vult vooral doelen en metadata in. Upload of
        plak hier je lesfase, of werk je volledige lesvoorbereiding bij in
        Actieve les.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => setActiveModule("active-lesson")}
      >
        Naar Actieve les
        <ArrowUpRight className="size-4" />
      </Button>
    </div>
  );
}
