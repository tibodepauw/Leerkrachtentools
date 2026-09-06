import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("module descriptions", () => {
  it("laat de subtekst de volle modulebreedte gebruiken", () => {
    const shell = readFileSync("components/shared/ModuleShell.tsx", "utf8");
    const lesson = readFileSync("components/modules/ActiveLessonView.tsx", "utf8");

    expect(shell).toContain(
      '<p className="mt-2 text-sm leading-6 text-neutral-400">',
    );
    expect(shell).not.toMatch(/max-w-2xl text-sm leading-6 text-neutral-400/);
    expect(lesson).not.toMatch(/max-w-2xl text-sm leading-6 text-neutral-400/);
  });
});
