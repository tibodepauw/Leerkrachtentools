"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

export function ModuleActionButton({
  disabled,
  children,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button type="button" {...props} disabled={disabled}>
      {children}
    </Button>
  );
}
