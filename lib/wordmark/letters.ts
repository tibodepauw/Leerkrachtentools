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

export type WordmarkLoaderVariant =
  | "gather"
  | "typewriter"
  | "magnetic"
  | "orbit"
  | "shuffle"
  | "breathe"
  | "static";

export const WORDMARK_LOADER_VARIANTS: {
  id: WordmarkLoaderVariant;
  name: string;
  description: string;
}[] = [
  {
    id: "gather",
    name: "Gather",
    description:
      "Letters starten verspreid in een spiraal, swingen een halve boog en klikken op hun plek.",
  },
  {
    id: "typewriter",
    name: "Typewriter wave",
    description: "Letters verschijnen één voor één van links naar rechts, elk met een mini-bounce.",
  },
  {
    id: "magnetic",
    name: "Magnetic pull",
    description: "Letters zweven eerst rustig, daarna trekken ze tegelijk naar het midden.",
  },
  {
    id: "orbit",
    name: "Orbit lock",
    description: "Alles cirkelt rond het midden, daarna klikken letters sequentieel op hun plek.",
  },
  {
    id: "shuffle",
    name: "Shuffle sort",
    description: "Letters staan in verkeerde volgorde, wisselen een paar keer en eindigen correct.",
  },
  {
    id: "breathe",
    name: "Breathe hold",
    description: "Woord staat stil met subtiel ademen, handig als laden langer duurt dan de intro.",
  },
  {
    id: "static",
    name: "Static (geen animatie)",
    description: "Referentie: eindlayout zonder beweging.",
  },
];

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

/** Tighter gather scatter anchored near each letter's final slot (sidebar logo). */
export function compactGatherScatter(index: number, final: WordmarkLetter) {
  const angle = index * 2.399963 + Math.PI * 0.2;
  const radiusEm = 0.42 + (index % 4) * 0.14;
  return {
    xEm: final.xEm + Math.cos(angle) * radiusEm,
    yEm: final.yEm + Math.sin(angle) * radiusEm,
    rotateDeg: final.rotateDeg + (index % 2 === 0 ? -1 : 1) * (10 + (index % 4) * 3),
  };
}

/** Compact gather arc midpoint (smaller swing than full-screen gather). */
export function compactGatherOrbit(
  index: number,
  final: WordmarkLetter,
  scatter: { xEm: number; yEm: number; rotateDeg: number },
) {
  const swirl = index % 2 === 0 ? 1 : -1;
  return {
    xEm: scatter.xEm * 0.55 + final.xEm * 0.5 + swirl * 0.28,
    yEm: scatter.yEm * 0.55 + final.yEm * 0.5 - swirl * 0.2,
    rotateDeg: final.rotateDeg * 0.5 + scatter.rotateDeg * 0.4,
  };
}

/** Midpoint on the arc before snapping into place (gather variant). */
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

/** Starting position on a shared circle (orbit-lock variant). */
export function orbitRingOffset(index: number, total = WORDMARK_LETTERS.length) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const radiusEm = 6.2;
  return {
    xEm: Math.cos(angle) * radiusEm,
    yEm: Math.sin(angle) * radiusEm,
    rotateDeg: (angle * 180) / Math.PI + 90,
  };
}

/** Wrong slot indices for shuffle-sort (three swap steps → correct order). */
export const SHUFFLE_SLOT_STEPS = [
  [8, 14, 3, 16, 1, 12, 0, 5, 7, 4, 15, 2, 10, 6, 11, 9, 13],
  [3, 1, 2, 5, 4, 7, 6, 9, 8, 11, 10, 13, 12, 15, 14, 16, 0],
  WORDMARK_LETTERS.map((_, index) => index),
] as const;

export function shuffleSlotPosition(letterIndex: number, step: number) {
  const slotIndex = SHUFFLE_SLOT_STEPS[step][letterIndex];
  return WORDMARK_LETTERS[slotIndex];
}
