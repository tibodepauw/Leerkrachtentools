import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("huisstijl", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const layout = readFileSync("app/layout.tsx", "utf8");

  it("is het vaste design, niet een optionele overlay", () => {
    expect(css).not.toMatch(/data-visual-theme/);
    expect(css).not.toMatch(/visual-theme-toggle/);
    expect(layout).not.toMatch(/theme=huisstijl|lt-visual-theme|VisualThemeProvider/);
  });

  it("houdt pagina-inhoud boven het raster zonder portals te breken", () => {
    expect(css).toMatch(/\.lt-app \{/);
    expect(layout).toMatch(/lt-app/);
  });

  it("zet kaartradius en pill-knoppen uit de brand kit", () => {
    expect(css).toMatch(/--gl-radius-card:\s*20px/);
    expect(css).toMatch(/--gl-radius-pill:\s*9999px/);
    expect(css).toMatch(/\[data-slot="button"\]/);
    expect(css).toMatch(/\[data-slot="card"\]/);
  });

  it("toont de glow-wordmark op login", () => {
    const glow = css.slice(css.indexOf(".glow-wordmark {"));
    expect(glow).toMatch(/display:\s*block/);
    expect(glow.slice(0, 80)).not.toMatch(/display:\s*none/);
  });

  it("geeft de GitHub-banner het huisstijl-raster", () => {
    expect(css).toMatch(/\.wordmark-export-canvas::before/);
  });
});

describe("dialogs", () => {
  it("centreert kaders met inset in plaats van translate", () => {
    const dialog = readFileSync("components/ui/dialog.tsx", "utf8");
    expect(dialog).toMatch(/inset-4/);
    expect(dialog).not.toMatch(/top-1\/2 left-1\/2/);
  });
});
