import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runProcessJob } from "./processJob";
const folder = mkdtempSync(path.join(tmpdir(), "lt-worker-test-"));
const entry = path.join(folder, "fixture.cjs");
writeFileSync(entry, `const fs = require('node:fs');
let input = ''; process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  const job = JSON.parse(input);
  if (job.marker) fs.writeFileSync(job.marker, String(process.pid));
  if (job.kind === 'spin') { while (true) { Math.sqrt(Math.random()); } }
  if (job.kind === 'large') { process.stdout.write('x'.repeat(20000)); return; }
  process.stdout.write(JSON.stringify({ value: job.value, secret: process.env.AUTH_SECRET ?? null }));
});`);
afterAll(() => rmSync(folder, { recursive: true, force: true }));

describe("hard process boundary", () => {
  it("kills CPU-bound work, reaps it before rejecting and admits a following job", async () => {
    const marker = path.join(folder, "timeout.pid");
    await expect(runProcessJob(entry, { kind: "spin", marker }, { timeoutMs: 1500 })).rejects.toThrow("te lang");
    expect(existsSync(marker)).toBe(true);
    const pid = Number(readFileSync(marker, "utf8"));
    expect(() => process.kill(pid, 0)).toThrow();
    expect(await runProcessJob(entry, { value: "after-kill" }, { timeoutMs: 1500 })).toEqual({ value: "after-kill", secret: null });
  });
  it("kills work that ignores cancellation", async () => {
    const controller = new AbortController();
    const marker = path.join(folder, "abort.pid");
    const pending = runProcessJob(entry, { kind: "spin", marker }, { signal: controller.signal, timeoutMs: 5000 });
    const outcome = expect(pending).rejects.toThrow("afgebroken");
    for (let n = 0; n < 100 && !existsSync(marker); n++) await new Promise(r => setTimeout(r, 20));
    controller.abort();
    await outcome;
    expect(existsSync(marker)).toBe(true);
    expect(() => process.kill(Number(readFileSync(marker, "utf8")), 0)).toThrow();
  });
  it("bounds output and does not inherit application secrets", async () => {
    await expect(runProcessJob(entry, { kind: "large" }, { timeoutMs: 1500, maxOutputBytes: 100 })).rejects.toThrow("te groot");
    expect(await runProcessJob(entry, { value: 42 }, { timeoutMs: 1500 })).toEqual({ value: 42, secret: null });
  });
});
