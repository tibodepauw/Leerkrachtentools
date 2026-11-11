import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// These tests exercise the historical approval, not the current dependency tree.
// Manifests were recovered from their registry tarballs and verified against
// the unchanged approval-policy hashes. This does not renew that approval.
const fixture = JSON.parse(readFileSync(new URL("./braces-approved-tree.json", import.meta.url), "utf8"));
export function writeApprovedInputs(root, includeLock = true) {
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "package.json"), fixture.package);
  if (includeLock) writeFileSync(path.join(root, "package-lock.json"), JSON.stringify(fixture.lock));
}
export function writeApprovedManifests(root) {
  for (const [location, content] of Object.entries(fixture.manifests)) {
    const directory = path.join(root, location);
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, "package.json"), content);
  }
}
