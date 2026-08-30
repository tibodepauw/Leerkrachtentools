const SPLASH_DONE_KEY = "lt-splash-done";

/** Call once on client boot so a hard refresh can replay the splash. */
export function initSplashSession(): void {
  if (typeof window === "undefined") return;

  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;

  if (nav?.type === "reload") {
    sessionStorage.removeItem(SPLASH_DONE_KEY);
  }
}

export function shouldShowSplash(): boolean {
  if (typeof window === "undefined") return false;
  return !sessionStorage.getItem(SPLASH_DONE_KEY);
}

export function markSplashComplete(): void {
  sessionStorage.setItem(SPLASH_DONE_KEY, "1");
}
