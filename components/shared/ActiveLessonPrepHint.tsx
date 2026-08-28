"use client";

import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  hasActiveLessonContext,
  hasLessonPreparation,
} from "@/lib/lesson/preparationText";
import { useLessonStore } from "@/stores/useLessonStore";

export function ActiveLessonPrepHint() {
  const lesson = useLessonStore((state) => state.lesson);
  const setActiveModule = useLessonStore((state) => state.setActiveModule);

  if (!hasActiveLessonContext(lesson) || hasLessonPreparation(lesson)) {
    return null;
  }

  const title = lesson.topic.trim() || "zonder titel";

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-50">
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
