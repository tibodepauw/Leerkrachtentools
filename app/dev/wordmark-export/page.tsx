"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WordmarkLoader } from "@/components/shared/WordmarkLoader";

function WordmarkExportCanvas() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") ?? "gather";

  return (
    <div
      id="wordmark-export"
      className="flex h-[360px] w-[1200px] items-center justify-center bg-black"
    >
      <WordmarkLoader variant={mode === "static" ? "static" : "gather"} />
    </div>
  );
}

/** Minimal black canvas for README banner export scripts (Playwright + Rubik). */
export default function WordmarkExportPage() {
  return (
    <Suspense fallback={<div className="h-[360px] w-[1200px] bg-black" />}>
      <div className="wordmark-export-root bg-black">
        <WordmarkExportCanvas />
      </div>
    </Suspense>
  );
}
