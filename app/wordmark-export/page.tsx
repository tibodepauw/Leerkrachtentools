"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GlowWordmark } from "@/components/shared/GlowWordmark";

function WordmarkExportCanvas() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") ?? "sweep";

  return (
    <div id="wordmark-export" className="wordmark-export-canvas">
      <GlowWordmark layout="banner" autoSweep={mode !== "static"} />
      <h1 className="wordmark-export-title">Leerkrachtentools</h1>
      <p className="wordmark-export-subtitle">Lesvoorbereiding zonder gedoe</p>
    </div>
  );
}

/** Public black canvas for README banner export (Playwright + Rubik). */
export default function WordmarkExportPage() {
  return (
    <Suspense fallback={<div className="wordmark-export-canvas" />}>
      <div className="wordmark-export-root">
        <WordmarkExportCanvas />
      </div>
    </Suspense>
  );
}
