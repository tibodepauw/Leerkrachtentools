import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Exercise the reviewed historical approval independently of current app deps.
// These exact registry manifests and lock records remain pinned by the real
// exception policy; the frozen fixture does not renew its expired approval.
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
