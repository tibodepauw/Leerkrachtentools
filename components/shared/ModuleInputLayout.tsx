import type { ReactNode } from "react";

export function ModuleInputLayout({
  fields,
  actions,
}: {
  fields: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">{fields}</div>
      <div className="shrink-0 border-t border-neutral-800 bg-neutral-950 pt-4">
        {actions}
      </div>
    </div>
  );
}
