"use client";

import type { CSSProperties } from "react";
import {
  chaosBurstOffset,
  orbitOffset,
  orbitRingOffset,
  scatterOffset,
  shuffleSlotPosition,
  WORDMARK_LETTERS,
  type WordmarkLoaderVariant,
} from "@/lib/wordmark/letters";
import { cn } from "@/lib/utils";

interface WordmarkLoaderProps {
  variant?: WordmarkLoaderVariant;
  /** Reseeds chaos burst directions (sidebar easter egg). */
  chaosSeed?: number;
  className?: string;
}

const VARIANT_CLASS: Record<WordmarkLoaderVariant, string | false> = {
  gather: "wordmark-loader__letter--gather",
  typewriter: "wordmark-loader__letter--typewriter",
  magnetic: "wordmark-loader__letter--magnetic",
  orbit: "wordmark-loader__letter--orbit",
  shuffle: "wordmark-loader__letter--shuffle",
  breathe: "wordmark-loader__letter--breathe",
  static: false,
  chaos: "wordmark-loader__letter--chaos",
};

export function WordmarkLoader({
  variant = "gather",
  chaosSeed = 0,
  className,
}: WordmarkLoaderProps) {
  return (
    <div
      className={cn("wordmark-loader", className)}
      role="img"
      aria-label="Leerkrachtentools"
    >
      {WORDMARK_LETTERS.map((letter, index) => {
        const scatter = scatterOffset(index);
        const orbit = orbitOffset(index, letter, scatter);
        const ring = orbitRingOffset(index);
        const shuffle0 = shuffleSlotPosition(index, 0);
        const shuffle1 = shuffleSlotPosition(index, 1);
        const chaos = chaosBurstOffset(index, chaosSeed);

        return (
          <span
            key={`${letter.char}-${index}`}
            className={cn("wordmark-loader__letter", VARIANT_CLASS[variant])}
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
                "--ox": `${ring.xEm}em`,
                "--oy": `${ring.yEm}em`,
                "--or": `${ring.rotateDeg}deg`,
                "--wx0": `${shuffle0.xEm}em`,
                "--wy0": `${shuffle0.yEm}em`,
                "--wr0": `${shuffle0.rotateDeg}deg`,
                "--wx1": `${shuffle1.xEm}em`,
                "--wy1": `${shuffle1.yEm}em`,
                "--wr1": `${shuffle1.rotateDeg}deg`,
                "--cx": `${chaos.xEm}em`,
                "--cy": `${chaos.yEm}em`,
                "--cr": `${chaos.rotateDeg}deg`,
                "--delay": `${index * 55}ms`,
                "--orbit-delay": `${600 + index * 90}ms`,
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
