"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { WordmarkLoader } from "@/components/shared/WordmarkLoader";
import {
  LT_WORDMARK_LETTERS,
  WORDMARK_LETTERS,
  type WordmarkLetter,
} from "@/lib/wordmark/letters";
import { cn } from "@/lib/utils";

interface WordmarkLogoProps {
  size?: "sm" | "md";
  className?: string;
  href?: string;
  letters?: readonly WordmarkLetter[];
}

function gatherAnimationMs(letterCount: number, compactLt: boolean) {
  if (compactLt) return 620;
  return 800 + Math.max(0, letterCount - 1) * 32 + 50;
}

export function WordmarkLogo({
  size = "md",
  className,
  href = "/",
  letters = WORDMARK_LETTERS,
}: WordmarkLogoProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [playing, setPlaying] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const compactLt = letters === LT_WORDMARK_LETTERS;

  const finishGather = useCallback(() => {
    setPlaying(false);
    if (href && pathname !== href) {
      router.push(href);
    }
  }, [href, pathname, router]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(
      finishGather,
      gatherAnimationMs(letters.length, compactLt),
    );
    return () => window.clearTimeout(timer);
  }, [playing, playKey, finishGather, letters.length, compactLt]);

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
      letters={letters}
      className={cn(
        "wordmark-logo",
        `wordmark-logo--${size}`,
        compactLt && "wordmark-logo--lt",
        playing && !compactLt && "wordmark-logo--animating",
      )}
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
        "block min-w-0 cursor-pointer overflow-visible outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-neutral-600",
        className,
      )}
      aria-label="Leerkrachtentools home"
      title="Leerkrachtentools"
    >
      {logo}
    </Link>
  );
}

/** Short gather LT, same letters as the long sidebar wordmark. */
export function LtMark({ className }: { className?: string }) {
  return (
    <WordmarkLogo
      size="sm"
      letters={LT_WORDMARK_LETTERS}
      className={className}
    />
  );
}
