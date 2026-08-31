"use client";

import { useState } from "react";
import { WordmarkLoader } from "@/components/shared/WordmarkLoader";
import { resolveLoaderVariantPreference } from "@/lib/loading/loaderVariantPreference";
import { readLoaderVariantFromStorage } from "@/lib/loading/readLoaderVariant";

export function AppLoadingScreen({ label = "Interface laden…" }: { label?: string }) {
  const [variant] = useState(() =>
    resolveLoaderVariantPreference(readLoaderVariantFromStorage()),
  );

  return (
    <div className="grid min-h-screen place-items-center bg-black px-4">
      <div className="flex w-full max-w-5xl flex-col items-center gap-8 text-center">
        <WordmarkLoader key={variant} variant={variant} />
        <p className="animate-pulse text-sm text-neutral-500">{label}</p>
      </div>
    </div>
  );
}
