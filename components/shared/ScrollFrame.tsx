import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ScrollFrameProps {
  children: ReactNode;
  className?: string;
  heightClassName?: string;
  innerScroll?: boolean;
}

export function ScrollFrame({
  children,
  className,
  heightClassName = "h-72",
  innerScroll = true,
}: ScrollFrameProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/40",
        heightClassName,
        className,
      )}
    >
      {innerScroll ? (
        <div className="h-full overflow-y-auto">{children}</div>
      ) : (
        children
      )}
    </div>
  );
}
