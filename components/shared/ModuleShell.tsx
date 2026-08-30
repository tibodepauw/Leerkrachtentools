"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAccountTier } from "@/components/auth/ModuleAccessProvider";
import { Card, CardContent } from "@/components/ui/card";
import {
  hasModuleAccess,
  moduleAccessDeniedMessage,
  type ModuleConfigKey,
} from "@/lib/auth/moduleAccess";
import { cn } from "@/lib/utils";

export function ModuleAccessDeniedCard({ tier }: { tier: string }) {
  return (
    <div className="mx-auto w-full max-w-[720px] p-4 lg:p-6">
      <Card className="border-neutral-800 bg-neutral-950">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <div className="grid size-12 place-items-center rounded-full border border-neutral-800 bg-neutral-900">
            <Lock className="size-5 text-neutral-400" />
          </div>
          <p className="max-w-lg text-sm leading-6 text-neutral-300">
            {moduleAccessDeniedMessage(tier)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function ModuleShell({
  moduleId,
  title,
  description,
  input,
  output,
  scrollMode = "page",
}: {
  moduleId: ModuleConfigKey;
  title: string;
  description: string;
  input: ReactNode;
  output: ReactNode;
  scrollMode?: "panel" | "page";
}) {
  const tier = useAccountTier();

  if (!hasModuleAccess(tier, moduleId)) {
    return <ModuleAccessDeniedCard tier={tier} />;
  }

  const pageScroll = scrollMode === "page";

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
          {description}
        </p>
      </div>
      <div
        className={cn(
          "grid gap-px overflow-hidden rounded-xl border border-neutral-800 bg-neutral-800 xl:grid-cols-2",
          !pageScroll &&
            "h-[calc(100vh-11rem)] max-h-[calc(100vh-11rem)]",
        )}
      >
        <section
          className={cn(
            "flex flex-col rounded-tl-xl rounded-tr-xl bg-neutral-950 p-4 sm:p-6 xl:rounded-tr-none xl:rounded-bl-xl",
            !pageScroll && "min-h-0 overflow-hidden",
          )}
        >
          <p className="mb-5 shrink-0 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Invoer
          </p>
          <div
            className={cn(
              "flex flex-col",
              pageScroll ? "gap-4" : "min-h-0 flex-1 overflow-hidden",
            )}
          >
            {input}
          </div>
        </section>
        <section
          className={cn(
            "flex flex-col rounded-br-xl rounded-bl-xl bg-black p-4 sm:p-6 xl:rounded-tl-none xl:rounded-bl-none xl:rounded-tr-xl",
            !pageScroll && "min-h-0 overflow-hidden",
          )}
        >
          <p className="mb-5 shrink-0 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Resultaat
          </p>
          <div className={cn(!pageScroll && "min-h-0 flex-1 overflow-y-auto pr-1")}>
            {output}
          </div>
        </section>
      </div>
    </div>
  );
}

export function EmptyOutput({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
      {children}
    </div>
  );
}
