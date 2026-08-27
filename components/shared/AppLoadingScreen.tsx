"use client";

import { Loader2 } from "lucide-react";

export function AppLoadingScreen({ label = "Interface laden…" }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-black px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="size-6 animate-spin text-neutral-500" aria-hidden="true" />
        <p className="text-sm text-neutral-500">{label}</p>
      </div>
    </div>
  );
}
