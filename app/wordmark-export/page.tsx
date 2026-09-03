"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WordmarkLoader } from "@/components/shared/WordmarkLoader";

function WordmarkExportCanvas() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") ?? "gather";

  return (
    <div id="wordmark-export" className="wordmark-export-canvas">
      <WordmarkLoader variant={mode === "static" ? "static" : "gather"} />
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
