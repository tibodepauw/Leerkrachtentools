"use client";

import { useState } from "react";
import { Scale } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CURRICULUM_ATTRIBUTION_ITEMS } from "@/lib/legal/curriculumAttribution";

export function LegalColophon({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        "space-y-2 text-xs leading-5 text-neutral-500",
        className,
      )}
    >
      {CURRICULUM_ATTRIBUTION_ITEMS.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function AboutAppDialog({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const trigger = (
    <button
      type="button"
      aria-label="Over deze applicatie"
      onClick={() => setOpen(true)}
      className={cn(
        "text-neutral-500 transition-colors hover:text-neutral-300",
        collapsed
          ? "grid size-10 place-items-center rounded-full hover:bg-neutral-900"
          : "text-left text-[11px] underline-offset-2 hover:underline",
        className,
      )}
    >
      {collapsed ? <Scale className="size-4 shrink-0" /> : "Over deze applicatie"}
    </button>
  );

  return (
    <>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right">Over deze applicatie</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Over deze applicatie</DialogTitle>
            <DialogDescription>
              Bronnen, auteursrecht en AI-transparantie volgens art. 50 van
              Verordening 2024/1689.
            </DialogDescription>
          </DialogHeader>
          <LegalColophon className="text-neutral-400" />
        </DialogContent>
      </Dialog>
    </>
  );
}
