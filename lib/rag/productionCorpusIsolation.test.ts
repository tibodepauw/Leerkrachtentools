import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let root = "";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
  if (root) rmSync(root, { recursive: true, force: true });
});

async function corpus(mode: string, real = false) {
  root = mkdtempSync(path.join(tmpdir(), "lt-source-isolation-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.stubEnv("NODE_ENV", mode);
  vi.resetModules();
  const fixture = path.join(root, "test/fixtures");
  mkdirSync(fixture, { recursive: true });
  writeFileSync(path.join(fixture, "curriculum-opstap.jsonl"), JSON.stringify({
    code: "SAMPLE", titel: "Synthetisch voorbeeld",
  }) + "\n");
  if (real) {
    const folder = path.join(root, "data/opstap");
    mkdirSync(folder, { recursive: true });
    writeFileSync(path.join(folder, "opstap_volledig.jsonl"), JSON.stringify({
      code: "REAL", titel: "Lokaal aangeleverd synthetisch bronrecord",
    }) + "\n");
  }
  return (await import("./corpusLevelCache")).getCorpusForLevel("BASISONDERWIJS");
}

it.each(["production", "development"])(
  "never substitutes test fixtures for a missing source in %s",
  async mode => { expect(await corpus(mode)).toEqual([]); },
);
it("keeps fixtures available to the isolated test suite", async () => {
  expect((await corpus("test")).map(r => r.code)).toContain("SAMPLE");
});
it("uses installed sources in production", async () => {
  expect((await corpus("production", true)).map(r => r.code)).toEqual(["REAL"]);
});
