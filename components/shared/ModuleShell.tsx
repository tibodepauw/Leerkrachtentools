import type { ReactNode } from "react";

export function ModuleShell({
  title,
  description,
  input,
  output,
}: {
  title: string;
  description: string;
  input: ReactNode;
  output: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
          {description}
        </p>
      </div>
      <div className="grid h-[calc(100vh-11rem)] max-h-[calc(100vh-11rem)] gap-px overflow-hidden rounded-xl border border-neutral-800 bg-neutral-800 xl:grid-cols-2">
        <section className="flex min-h-0 flex-col overflow-hidden bg-neutral-950 p-4 sm:p-6">
          <p className="mb-5 shrink-0 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Invoer
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">{input}</div>
        </section>
        <section className="flex min-h-0 flex-col overflow-hidden bg-black p-4 sm:p-6">
          <p className="mb-5 shrink-0 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Resultaat
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">{output}</div>
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
