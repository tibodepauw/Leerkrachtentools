import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ModuleShell({
  title,
  description,
  input,
  output,
  scrollMode = "panel",
}: {
  title: string;
  description: string;
  input: ReactNode;
  output: ReactNode;
  scrollMode?: "panel" | "page";
}) {
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
          "grid gap-px rounded-xl border border-neutral-800 bg-neutral-800 xl:grid-cols-2",
          pageScroll
            ? "overflow-visible"
            : "h-[calc(100vh-11rem)] max-h-[calc(100vh-11rem)] overflow-hidden",
        )}
      >
        <section
          className={cn(
            "flex flex-col bg-neutral-950 p-4 sm:p-6",
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
            "flex flex-col bg-black p-4 sm:p-6",
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
