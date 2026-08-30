export interface WordmarkLetter {
  char: string;
  /** Offset from word center in em (matches banner-wordmark.svg at 96px) */
  xEm: number;
  yEm: number;
  rotateDeg: number;
}

/** Shared playful layout for banner SVG and loading animation. */
export const WORDMARK_LETTERS: WordmarkLetter[] = [
  { char: "L", xEm: -5.667, yEm: 0.104, rotateDeg: -5.5 },
  { char: "e", xEm: -4.958, yEm: -0.104, rotateDeg: 5.5 },
  { char: "e", xEm: -4.25, yEm: 0.104, rotateDeg: -4.5 },
  { char: "r", xEm: -3.542, yEm: -0.104, rotateDeg: 5 },
  { char: "k", xEm: -2.833, yEm: 0.125, rotateDeg: -5.5 },
  { char: "r", xEm: -2.125, yEm: -0.104, rotateDeg: 4.5 },
  { char: "a", xEm: -1.417, yEm: 0.104, rotateDeg: -5 },
  { char: "c", xEm: -0.708, yEm: -0.104, rotateDeg: 5.5 },
  { char: "h", xEm: 0, yEm: 0, rotateDeg: 0 },
  { char: "t", xEm: 0.708, yEm: 0.125, rotateDeg: -5 },
  { char: "e", xEm: 1.417, yEm: -0.104, rotateDeg: 5.5 },
  { char: "n", xEm: 2.125, yEm: 0.104, rotateDeg: -5.5 },
  { char: "t", xEm: 2.833, yEm: -0.104, rotateDeg: 4.5 },
  { char: "o", xEm: 3.542, yEm: 0.125, rotateDeg: -5 },
  { char: "o", xEm: 4.25, yEm: -0.104, rotateDeg: 5.5 },
  { char: "l", xEm: 4.958, yEm: 0.104, rotateDeg: -4.5 },
  { char: "s", xEm: 5.667, yEm: 0, rotateDeg: 5 },
];

export type WordmarkLoaderVariant = "gather" | "static";

/** Deterministic scatter orbit for letter index (golden-angle spiral). */
export function scatterOffset(index: number) {
  const angle = index * 2.399963;
  const radiusEm = 7.5 + (index % 5) * 1.35;
  return {
    xEm: Math.cos(angle) * radiusEm,
    yEm: Math.sin(angle) * radiusEm,
    rotateDeg: (index % 2 === 0 ? -1 : 1) * (18 + (index % 6) * 4),
  };
}

/** Midpoint on the arc before snapping into place. */
export function orbitOffset(
  index: number,
  final: WordmarkLetter,
  scatter: { xEm: number; yEm: number; rotateDeg: number },
) {
  const swirl = index % 2 === 0 ? 1 : -1;
  return {
    xEm: scatter.xEm * 0.35 + final.xEm * 0.45 + swirl * 1.8,
    yEm: scatter.yEm * 0.35 + final.yEm * 0.45 - swirl * 1.2,
    rotateDeg: final.rotateDeg * 0.45 + scatter.rotateDeg * 0.25,
  };
}
