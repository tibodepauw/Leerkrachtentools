import {
  WORDMARK_LOADER_VARIANTS,
  type WordmarkLoaderVariant,
} from "@/lib/wordmark/letters";

/** Persisted user choice in settings (includes meta option "random"). */
export type LoaderVariantPreference = WordmarkLoaderVariant | "random";

export const LOADER_RANDOM_OPTION = {
  id: "random" as const,
  name: "Willekeurig",
  description:
    "Bij elke volledige laadbeurt speelt een andere wordmark-animatie af.",
};

export const LOADER_VARIANT_PREFERENCES = new Set<LoaderVariantPreference>([
  ...WORDMARK_LOADER_VARIANTS.map((item) => item.id),
  "random",
]);

/** Animated variants eligible for random selection (excludes static). */
export const RANDOM_LOADER_VARIANTS: WordmarkLoaderVariant[] =
  WORDMARK_LOADER_VARIANTS.filter((item) => item.id !== "static").map(
    (item) => item.id,
  );

export function pickRandomLoaderVariant(): WordmarkLoaderVariant {
  const index = Math.floor(Math.random() * RANDOM_LOADER_VARIANTS.length);
  return RANDOM_LOADER_VARIANTS[index] ?? "gather";
}

export function resolveLoaderVariantPreference(
  preference: LoaderVariantPreference,
): WordmarkLoaderVariant {
  if (preference === "random") return pickRandomLoaderVariant();
  return preference;
}

export function isLoaderVariantPreference(
  value: string | undefined,
): value is LoaderVariantPreference {
  return Boolean(value && LOADER_VARIANT_PREFERENCES.has(value as LoaderVariantPreference));
}
