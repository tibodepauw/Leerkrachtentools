import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("agent instruction files", () => {
  it("houdt AGENTS.md en soortgelijke bestanden buiten GitHub", () => {
    const gitignore = readFileSync(".gitignore", "utf8");

    expect(gitignore).toMatch(/^AGENTS\.md$/m);
    expect(gitignore).toMatch(/^CLAUDE\.md$/m);
    expect(gitignore).toMatch(/^GEMINI\.md$/m);
    expect(gitignore).toMatch(/^\.cursorrules$/m);
    expect(gitignore).toMatch(/^\.cursor\/rules\/$/m);
  });
});
