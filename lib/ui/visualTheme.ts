export const VISUAL_THEME_STORAGE_KEY = "lt-visual-theme";

export const VISUAL_THEMES = ["classic", "huisstijl"] as const;

export type VisualTheme = (typeof VISUAL_THEMES)[number];

export const DEFAULT_VISUAL_THEME: VisualTheme = "classic";

export function isVisualTheme(value: unknown): value is VisualTheme {
  return value === "classic" || value === "huisstijl";
}

export function parseVisualTheme(value: string | null | undefined): VisualTheme {
  return isVisualTheme(value) ? value : DEFAULT_VISUAL_THEME;
}

export function applyVisualTheme(theme: VisualTheme) {
  if (typeof document === "undefined") return;
  if (theme === "huisstijl") {
    document.documentElement.setAttribute("data-visual-theme", "huisstijl");
    return;
  }
  document.documentElement.removeAttribute("data-visual-theme");
}

export function readStoredVisualTheme(): VisualTheme {
  if (typeof window === "undefined") return DEFAULT_VISUAL_THEME;
  try {
    return parseVisualTheme(window.localStorage.getItem(VISUAL_THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_VISUAL_THEME;
  }
}

export function persistVisualTheme(theme: VisualTheme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VISUAL_THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
}
