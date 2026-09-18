import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  initSplashSession,
  markSplashComplete,
  shouldShowSplash,
} from "@/lib/loading/splashSession";

function createSessionStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem(key: string) {
      return store[key] ?? null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    },
  };
}

describe("splashSession", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", createSessionStorageMock());
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

  it("does not trap the UI in its loading screen when browser storage is blocked", () => {
    const denied = () => { throw new Error("storage blocked"); };
    vi.stubGlobal("sessionStorage", { getItem: denied, setItem: denied, removeItem: denied });
    vi.stubGlobal("performance", { getEntriesByType: () => [{ type: "reload" }] });
    expect(() => initSplashSession()).not.toThrow();
    expect(shouldShowSplash()).toBe(true);
    expect(() => markSplashComplete()).not.toThrow();
    expect(shouldShowSplash()).toBe(false);
  });
});
