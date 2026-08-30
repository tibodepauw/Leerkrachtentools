"use client";

import { WordmarkLoader } from "@/components/shared/WordmarkLoader";
import { cn } from "@/lib/utils";

export function AppLoadingScreen({ label = "Interface laden…" }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-black px-4">
      <div className="flex w-full max-w-5xl flex-col items-center gap-8 text-center">
        <WordmarkLoader />
        <p className="animate-pulse text-sm text-neutral-500">{label}</p>
      </div>
    </div>
  );
}

export function AppLoadingScreenMinimal({
  label = "Interface laden…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid min-h-screen place-items-center bg-black px-4", className)}>
      <div className="flex flex-col items-center gap-3 text-center">
        <WordmarkLoader variant="static" />
        <p className="text-sm text-neutral-500">{label}</p>
      </div>
    </div>
  );
}
