import { describe, expect, it, vi } from "vitest";
import {
  LOADER_RANDOM_OPTION,
  RANDOM_LOADER_VARIANTS,
  isLoaderVariantPreference,
  pickRandomLoaderVariant,
  resolveLoaderVariantPreference,
} from "@/lib/loading/loaderVariantPreference";

describe("loaderVariantPreference", () => {
  it("recognises random as a valid preference", () => {
    expect(isLoaderVariantPreference("random")).toBe(true);
    expect(isLoaderVariantPreference("gather")).toBe(true);
    expect(isLoaderVariantPreference("nope")).toBe(false);
  });

  it("resolves random to an animated variant", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(resolveLoaderVariantPreference("random")).toBe(RANDOM_LOADER_VARIANTS[0]);
    vi.restoreAllMocks();
  });

  it("passes through explicit variants", () => {
    expect(resolveLoaderVariantPreference("typewriter")).toBe("typewriter");
  });

  it("never picks static for random", () => {
    expect(RANDOM_LOADER_VARIANTS).not.toContain("static");
    for (let index = 0; index < RANDOM_LOADER_VARIANTS.length; index += 1) {
      vi.spyOn(Math, "random").mockReturnValue(index / RANDOM_LOADER_VARIANTS.length);
      expect(pickRandomLoaderVariant()).toBe(RANDOM_LOADER_VARIANTS[index]);
      vi.restoreAllMocks();
    }
  });

  it("documents the random option for settings UI", () => {
    expect(LOADER_RANDOM_OPTION.name).toBe("Willekeurig");
  });
});
