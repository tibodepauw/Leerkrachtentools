"use client";

import type { CSSProperties } from "react";
import {
  orbitOffset,
  scatterOffset,
  WORDMARK_LETTERS,
  type WordmarkLoaderVariant,
} from "@/lib/wordmark/letters";
import { cn } from "@/lib/utils";

interface WordmarkLoaderProps {
  variant?: WordmarkLoaderVariant;
  className?: string;
}

export function WordmarkLoader({ variant = "gather", className }: WordmarkLoaderProps) {
  return (
    <div
      className={cn("wordmark-loader", className)}
      role="img"
      aria-label="Leerkrachtentools"
    >
      {WORDMARK_LETTERS.map((letter, index) => {
        const scatter = scatterOffset(index);
        const orbit = orbitOffset(index, letter, scatter);

        return (
          <span
            key={`${letter.char}-${index}`}
            className={cn(
              "wordmark-loader__letter",
              variant === "gather" && "wordmark-loader__letter--gather",
            )}
            style={
              {
                "--fx": `${letter.xEm}em`,
                "--fy": `${letter.yEm}em`,
                "--fr": `${letter.rotateDeg}deg`,
                "--sx": `${scatter.xEm}em`,
                "--sy": `${scatter.yEm}em`,
                "--sr": `${scatter.rotateDeg}deg`,
                "--mx": `${orbit.xEm}em`,
                "--my": `${orbit.yEm}em`,
                "--mr": `${orbit.rotateDeg}deg`,
                "--delay": `${index * 55}ms`,
              } as CSSProperties
            }
          >
            {letter.char}
          </span>
        );
      })}
    </div>
  );
}
