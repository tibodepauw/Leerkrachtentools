"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function ModuleActionButton({
  disabled,
  disabledReason = "Vul eerst invoer in om deze actie te starten.",
  children,
  ...props
}: ComponentProps<typeof Button> & {
  disabledReason?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Button type="button" {...props} disabled={disabled}>
        {children}
      </Button>
      {disabled && disabledReason ? (
        <p className="text-xs leading-5 text-neutral-500">{disabledReason}</p>
      ) : null}
    </div>
  );
}
