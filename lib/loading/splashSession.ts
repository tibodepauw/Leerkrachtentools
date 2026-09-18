const SPLASH_DONE_KEY = "lt-splash-done";
let completedInMemory = false;

/** Call once on client boot so a hard refresh can replay the splash. */
export function initSplashSession(): void {
  if (typeof window === "undefined") return;

  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;

  if (nav?.type === "reload") {
    completedInMemory = false;
    try { sessionStorage.removeItem(SPLASH_DONE_KEY); } catch { /* optional animation state */ }
  }
}

export function shouldShowSplash(): boolean {
  if (typeof window === "undefined") return false;
  try { return !sessionStorage.getItem(SPLASH_DONE_KEY); }
  catch { return !completedInMemory; }
}

export function markSplashComplete(): void {
  completedInMemory = true;
  try { sessionStorage.setItem(SPLASH_DONE_KEY, "1"); } catch { /* memory fallback */ }
}
