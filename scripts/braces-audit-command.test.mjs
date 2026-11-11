import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { writeApprovedInputs, writeApprovedManifests } from "./test-fixtures/braces-approved-fixture.mjs";

const advisory = JSON.parse(readFileSync("docs/audit-evidence/2026-10-03/braces-advisory.json", "utf8"));
const directories = [];
const json = (file, value) => writeFileSync(file, JSON.stringify(value));
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function fixture() {
  const base = mkdtempSync(path.join(tmpdir(), "lt-braces-command-"));
  directories.push(base);
  const root = path.join(base, "project");
  const standalone = path.join(root, ".next/standalone");
  for (const file of ["package.json", "package-lock.json", "scripts/audit-production-dependencies.mjs", "scripts/with-production-audit-install.mjs", "scripts/proposals/braces-audit-exception.mjs", "scripts/proposals/braces-exception-policy.json", "scripts/apply-braces-security-patch.mjs", "patches/braces-3.0.3-depth.json"]) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    cpSync(file, path.join(root, file));
  }
  writeApprovedInputs(root);
  writeApprovedManifests(root);
  cpSync("node_modules/braces", path.join(root, "node_modules/braces"), { recursive: true });
  mkdirSync(path.join(standalone, ".next"), { recursive: true });
  writeApprovedInputs(standalone, false);
  for (const file of [".next/BUILD_ID", ".next/standalone/.next/BUILD_ID"]) writeFileSync(path.join(root, file), "synthetic-build");
  writeFileSync(path.join(standalone, "server.js"), "// Synthetic standalone");
  cpSync("scripts/test-fixtures/braces-audit-preload.mjs", path.join(base, "preload.mjs"));
  const config = { base, root, now: "2026-10-16T23:59:59.999Z", advisory, release: { name: "braces", version: "3.0.3" } };
  return { base, root, standalone, config };
}

function run(options, all = true) {
  json(path.join(options.base, "audit-test.json"), options.config);
  // Resolve npm from the wrapper PATH: exercise both supported npm 10/11.
  const npmCli = execFileSync("which", ["npm"], { encoding: "utf8" }).trim();
  const result = spawnSync(npmCli, ["run", "security:audit", ...(all ? ["--", "--all"] : [])], {
    cwd: options.root,
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=256 --import=" + path.join(options.base, "preload.mjs") },
    encoding: "utf8", timeout: 15_000, maxBuffer: 1024 * 1024,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  const marker = path.join(options.base, "production-path");
  if (existsSync(marker)) expect(existsSync(readFileSync(marker, "utf8"))).toBe(false);
  return { status: result.status, output: result.stdout + result.stderr, productionChecked: existsSync(marker) };
}

describe("real active npm run security:audit subprocess", () => {
  it("warns visibly and exits 0 only for the intact approved mitigation", () => {
    const result = run(fixture());
    expect(result.status).toBe(0);
    expect(result.productionChecked).toBe(true);
    expect(result.output).toContain("TIJDELIJK GEMITIGEERD: braces@3.0.3 GHSA-vfj7-8cjw-p6xm");
    expect(result.output).toContain("geen officiële herstelrelease");
    expect(result.output).toContain("2026-10-17T00:00:00.000Z");
    expect(result.output).toContain("1 findings; 1 tijdelijk gemitigeerd; 0 overige blokkerende findings");
    expect(result.output).not.toContain("Geen bekende kwetsbaarheden");
  });

  it.each([
    ["complete unpatched official release", o => {
      const patch = JSON.parse(readFileSync("patches/braces-3.0.3-depth.json", "utf8"));
      for (const file of patch.files) {
        const filename = path.join(o.root, "node_modules/braces", file.path);
        let content = readFileSync(filename, "utf8");
        for (const edit of [...file.edits].reverse()) content = content.replace(edit.after, () => edit.before);
        writeFileSync(filename, content);
      }
    }],
    ["missing patched file", o => rmSync(path.join(o.root, "node_modules/braces/lib/parse.js"))],
    ["changed installed patch", o => writeFileSync(path.join(o.root, "node_modules/braces/lib/parse.js"), "// unpatched or changed")],
    ["changed manifest", o => writeFileSync(path.join(o.root, "patches/braces-3.0.3-depth.json"), "{}")],
    ["different version", o => json(path.join(o.root, "node_modules/braces/package.json"), { name: "braces", version: "3.0.4" })],
    ["changed actual dependency chain", o => {
      const file = path.join(o.root, "package.json");
      const pkg = JSON.parse(readFileSync(file, "utf8")); pkg.devDependencies.micromatch = "4.0.8"; json(file, pkg);
    }],
    ["production braces", o => { o.config.productionBraces = true; }],
    ["standalone braces", o => {
      mkdirSync(path.join(o.standalone, "node_modules/alias"), { recursive: true });
      json(path.join(o.standalone, "node_modules/alias/package.json"), { name: "braces", version: "3.0.3" });
    }],
    ["extra advisory", o => { o.config.extra = true; }],
    ["exact expiry", o => { o.config.now = "2026-10-17T00:00:00.000Z"; }],
    ["after expiry", o => { o.config.now = "2026-10-18T00:00:00.000Z"; }],
    ["invalid upstream metadata", o => { o.config.advisory = {}; }],
    ["incomplete affected events", o => { o.config.advisory = structuredClone(advisory); o.config.advisory.affected[0].ranges[0].events.shift(); }],
    ["new official release", o => { o.config.release.version = "3.0.4"; }],
    ["invalid audit metadata", o => { o.config.invalidAudit = true; }],
    ["production install failure", o => { o.config.installFailure = true; }],
  ])("exits 1 for %s and cleans temporary production proof", (_name, mutate) => {
    const options = fixture(); mutate(options);
    const result = run(options);
    expect(result.status).toBe(1);
    if (!options.config.invalidAudit) expect(result.output).toContain("GHSA-vfj7-8cjw-p6xm");
    if (!options.config.extra) expect(result.output).not.toContain("TIJDELIJK GEMITIGEERD:");
    if (options.config.extra) expect(result.output).toContain("2 findings; 1 tijdelijk gemitigeerd; 1 overige blokkerende findings");
  });

  it("does not introduce an exception path into the production-only audit", () => {
    const result = run(fixture(), false);
    expect(result.status).toBe(0);
    expect(result.output).toContain("Geen bekende kwetsbaarheden gevonden.");
    expect(result.output).not.toContain("TIJDELIJK GEMITIGEERD");
    expect(result.productionChecked).toBe(false);
  });
});
