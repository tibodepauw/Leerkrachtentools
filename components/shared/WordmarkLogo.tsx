"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { WordmarkLoader } from "@/components/shared/WordmarkLoader";
import { cn } from "@/lib/utils";

interface WordmarkLogoProps {
  size?: "sm" | "md";
  className?: string;
  href?: string;
}

/** Compact gather: 0.8s duration + last letter stagger (16 × 32ms). */
const GATHER_ANIMATION_MS = 1350;

export function WordmarkLogo({
  size = "md",
  className,
  href = "/",
}: WordmarkLogoProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [playing, setPlaying] = useState(false);
  const [playKey, setPlayKey] = useState(0);

  const finishGather = useCallback(() => {
    setPlaying(false);
    if (href && pathname !== href) {
      router.push(href);
    }
  }, [href, pathname, router]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(finishGather, GATHER_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [playing, playKey, finishGather]);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setPlayKey((value) => value + 1);
    setPlaying(true);
  }

  const logo = (
    <WordmarkLoader
      key={playKey}
      variant={playing ? "gather" : "static"}
      compactAnimation
      className={cn("wordmark-logo", `wordmark-logo--${size}`)}
    />
  );

  if (!href) {
    return <div className={className}>{logo}</div>;
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        "block min-w-0 cursor-pointer outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-neutral-600",
        className,
      )}
      aria-label="Leerkrachtentools home"
      title="Leerkrachtentools"
    >
      {logo}
    </Link>
  );
}
