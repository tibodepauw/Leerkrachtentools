import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function gitLines(args: string[]) {
  const output = execFileSync("git", args, {
    encoding: "utf8",
    cwd: process.cwd(),
  }).trim();
  return output ? output.split("\n") : [];
}

function isGitIgnored(path: string) {
  try {
    execFileSync("git", ["check-ignore", "--no-index", "-q", path], {
      cwd: process.cwd(),
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function isAllowedFixture(path: string) {
  return path.startsWith("test/fixtures/") && path.endsWith(".jsonl");
}

describe("corpus hygiene", () => {
  it("houdt volledige .jsonl-corpora buiten git, op kleine test-fixtures na", () => {
    const gitignore = readFileSync(".gitignore", "utf8");
    expect(gitignore).toContain("data/**/*.jsonl");
    expect(gitignore).toContain("data/**/*.pdf");
    expect(gitignore).toContain("data/**/*.json");
    expect(gitignore).toContain("data/okan/");
    expect(gitignore).toContain("data/bubao/");
    expect(gitignore).toContain("data/buso/");
    expect(gitignore).toContain("data/dko/");
    expect(gitignore).toContain("data/secundair/");
    expect(gitignore).toContain("data/basisonderwijs/");
    expect(gitignore).toContain("!data/templates/**");
    expect(gitignore).toContain("!test/fixtures/**");

    const tracked = gitLines(["ls-files", "--", "*.jsonl"]);
    expect(tracked.length).toBeGreaterThan(0);
    expect(tracked.every(isAllowedFixture)).toBe(true);

    const staged = gitLines([
      "diff",
      "--cached",
      "--name-only",
      "--diff-filter=ACMR",
      "--",
      "*.jsonl",
    ]);
    expect(staged.every(isAllowedFixture)).toBe(true);

    const rootJsonl = readdirSync(".", { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map((entry) => entry.name);
    expect(rootJsonl).toEqual([]);

    const ignoredSamples = [
      "data/opstap/opstap_volledig.jsonl",
      "data/secundair/leerplannen_secundair.jsonl",
      "data/okan/onderwijsdoelen_okan.jsonl",
      "data/basisonderwijs/corpus.jsonl",
      "data/bubao/secret.json",
      "data/dko/plan.pdf",
    ];
    for (const sample of ignoredSamples) {
      expect(isGitIgnored(sample)).toBe(true);
    }
  });
});
