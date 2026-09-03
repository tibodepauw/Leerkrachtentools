import type { ReactNode } from "react";

export function ModuleInputLayout({
  fields,
  actions,
  flow = true,
}: {
  fields: ReactNode;
  actions: ReactNode;
  flow?: boolean;
}) {
  if (flow) {
    return (
      <div className="flex flex-col gap-4">
        <div>{fields}</div>
        <div>{actions}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">{fields}</div>
      <div className="shrink-0 bg-neutral-950">{actions}</div>
    </div>
  );
}
