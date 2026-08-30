import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  initSplashSession,
  markSplashComplete,
  shouldShowSplash,
} from "@/lib/loading/splashSession";

describe("splashSession", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
      clear() {
        this.store = {};
      },
    });
    sessionStorage.clear();
    vi.stubGlobal("performance", {
      getEntriesByType: () => [{ type: "navigate" }],
    });
  });

  it("shows splash until marked complete", () => {
    expect(shouldShowSplash()).toBe(true);
    markSplashComplete();
    expect(shouldShowSplash()).toBe(false);
  });

  it("clears splash flag on hard reload", () => {
    markSplashComplete();
    vi.stubGlobal("performance", {
      getEntriesByType: () => [{ type: "reload" }],
    });
    initSplashSession();
    expect(shouldShowSplash()).toBe(true);
  });
});
