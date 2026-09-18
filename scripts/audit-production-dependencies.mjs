import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const OSV_QUERY_URL = "https://api.osv.dev/v1/querybatch";
const MAX_ATTEMPTS = 3;

function packageNameFromPath(packagePath) {
  const marker = "node_modules/";
  const index = packagePath.lastIndexOf(marker);
  return index === -1 ? "" : packagePath.slice(index + marker.length);
}

async function productionQueries(includeDev) {
  const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
  const seen = new Set();
  const queries = [];

  for (const [packagePath, metadata] of Object.entries(lock.packages ?? {})) {
    if (!packagePath.startsWith("node_modules/") || (!includeDev && metadata.dev === true)) {
      continue;
    }
    const name = packageNameFromPath(packagePath);
    const version = metadata.version;
    if (!name || typeof version !== "string") continue;

    const key = `${name}@${version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    queries.push({ package: { ecosystem: "npm", name }, version });
  }

  return queries;
}

async function queryOsv(queries) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(OSV_QUERY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(`OSV antwoordde met HTTP ${response.status}.`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
      }
    }
  }
  throw lastError;
}

export function collectVulnerabilities(queries, payload) {
  if (!queries.length || !payload || !Array.isArray(payload.results) || payload.results.length !== queries.length) {
    throw new Error("OSV gaf geen volledig controleerbaar resultaat terug.");
  }
  const vulnerabilities = [];
  for (const [index, result] of payload.results.entries()) {
    if (!result || typeof result !== "object" || Array.isArray(result) || result.error ||
        (result.vulns !== undefined && !Array.isArray(result.vulns))) {
      throw new Error("OSV gaf een ongeldig pakketresultaat terug.");
    }
    for (const vulnerability of result.vulns ?? []) {
      if (!vulnerability || typeof vulnerability.id !== "string" || !vulnerability.id) {
        throw new Error("OSV gaf een ongeldige kwetsbaarheid terug.");
      }
      vulnerabilities.push({
        package: queries[index].package.name,
        version: queries[index].version,
        id: vulnerability.id,
        summary: vulnerability.summary ?? "",
      });
    }
  }
  return vulnerabilities;
}

async function main() {
  const includeDev = process.argv.includes("--all");
  const queries = await productionQueries(includeDev);
  const payload = await queryOsv(queries);
  const vulnerabilities = collectVulnerabilities(queries, payload);
  console.log(`OSV controleerde ${queries.length} ${includeDev ? "productie- en buildpackages" : "productiepackages"}.`);
  if (vulnerabilities.length === 0) {
    console.log("Geen bekende kwetsbaarheden gevonden.");
    return;
  }
  console.error(
    `${vulnerabilities.length} bekende kwetsbaarheden gevonden:`,
  );
  for (const vulnerability of vulnerabilities) {
    console.error(
      `- ${vulnerability.package}@${vulnerability.version}: ${vulnerability.id} ${vulnerability.summary}`,
    );
  }
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
