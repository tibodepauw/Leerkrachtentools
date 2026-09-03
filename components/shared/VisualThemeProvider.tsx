"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyVisualTheme,
  DEFAULT_VISUAL_THEME,
  parseVisualTheme,
  persistVisualTheme,
  readStoredVisualTheme,
  type VisualTheme,
} from "@/lib/ui/visualTheme";

interface VisualThemeContextValue {
  theme: VisualTheme;
  setTheme: (theme: VisualTheme) => void;
}

const VisualThemeContext = createContext<VisualThemeContextValue>({
  theme: DEFAULT_VISUAL_THEME,
  setTheme: () => {},
});

export function useVisualTheme() {
  return useContext(VisualThemeContext);
}

function VisualThemeToggle() {
  const { theme, setTheme } = useVisualTheme();
  const isHuisstijl = theme === "huisstijl";

  return (
    <div className="visual-theme-toggle">
      <p className="visual-theme-toggle__label">Testversie</p>
      <div className="visual-theme-toggle__switch" role="group" aria-label="Visueel thema">
        <button
          type="button"
          className={!isHuisstijl ? "is-active" : undefined}
          onClick={() => setTheme("classic")}
        >
          Huidig
        </button>
        <button
          type="button"
          className={isHuisstijl ? "is-active" : undefined}
          onClick={() => setTheme("huisstijl")}
        >
          Huisstijl
        </button>
      </div>
    </div>
  );
}

export function VisualThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<VisualTheme>(DEFAULT_VISUAL_THEME);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queried = params.get("theme");
    const next =
      queried === "huisstijl" || queried === "classic"
        ? parseVisualTheme(queried)
        : readStoredVisualTheme();
    setThemeState(next);
    applyVisualTheme(next);
    if (queried === "huisstijl" || queried === "classic") {
      persistVisualTheme(next);
    }
  }, []);

  const setTheme = useCallback((next: VisualTheme) => {
    setThemeState(next);
    applyVisualTheme(next);
    persistVisualTheme(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <VisualThemeContext.Provider value={value}>
      <div className="lt-app">{children}</div>
      <VisualThemeToggle />
    </VisualThemeContext.Provider>
  );
}
