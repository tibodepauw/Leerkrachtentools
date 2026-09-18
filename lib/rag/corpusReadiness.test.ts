import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { corpusTargets, inspectCorpus } from "./corpusReadiness";
const folders: string[] = [];
afterEach(() => { for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });
function fixture(content?: string) {
  const folder = mkdtempSync(path.join(tmpdir(), "lt-corpus-probe-")); folders.push(folder);
  const file = path.join(folder, "fixture.jsonl"); if (content !== undefined) writeFileSync(file, content); return file;
}
describe("deployment corpus checks", () => {
  it("does not replace missing or empty production files with fixtures", async () => {
    expect((await inspectCorpus(fixture())).ok).toBe(false);
    expect((await inspectCorpus(fixture("\n "))).ok).toBe(false);
    expect(corpusTargets().every(target => !target.file.includes("fixtures"))).toBe(true);
    expect(corpusTargets()).toHaveLength(14);
  });
  it("counts valid records without returning content", async () => {
    const result = await inspectCorpus(fixture('{"titel":"Synthetic private text"}\r\n\n{"code":"1"}'));
    expect(result).toEqual({ ok: true, records: 2, reason: "JSONL gecontroleerd" });
  });
  it("rejects broken records, arrays and oversized lines without echoing data", async () => {
    for (const content of ['{"private":', "[]", JSON.stringify({ title: "x".repeat(1_048_577) })]) {
      const result = await inspectCorpus(fixture(content));
      expect(result.ok).toBe(false);
      expect(result.reason.length).toBeLessThan(100);
    }
  });
});
