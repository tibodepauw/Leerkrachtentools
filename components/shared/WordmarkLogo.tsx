"use client";

import Link from "next/link";
import { WordmarkLoader } from "@/components/shared/WordmarkLoader";
import { cn } from "@/lib/utils";

interface WordmarkLogoProps {
  size?: "sm" | "md";
  className?: string;
  href?: string;
}

export function WordmarkLogo({
  size = "md",
  className,
  href = "/",
}: WordmarkLogoProps) {
  const logo = (
    <WordmarkLoader
      variant="static"
      className={cn("wordmark-logo", `wordmark-logo--${size}`)}
    />
  );

  if (!href) {
    return <div className={className}>{logo}</div>;
  }

  return (
    <Link
      href={href}
      className={cn(
        "block min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-neutral-600",
        className,
      )}
      aria-label="Leerkrachtentools home"
    >
      {logo}
    </Link>
  );
}
