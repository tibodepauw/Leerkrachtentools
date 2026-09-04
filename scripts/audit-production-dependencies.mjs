import { readFile } from "node:fs/promises";

const OSV_QUERY_URL = "https://api.osv.dev/v1/querybatch";
const MAX_ATTEMPTS = 3;

function packageNameFromPath(packagePath) {
  const marker = "node_modules/";
  const index = packagePath.lastIndexOf(marker);
  return index === -1 ? "" : packagePath.slice(index + marker.length);
}

async function productionQueries() {
  const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
  const seen = new Set();
  const queries = [];

  for (const [packagePath, metadata] of Object.entries(lock.packages ?? {})) {
    if (!packagePath.startsWith("node_modules/") || metadata.dev === true) {
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

const queries = await productionQueries();
const payload = await queryOsv(queries);
const vulnerabilities = [];

for (const [index, result] of (payload.results ?? []).entries()) {
  for (const vulnerability of result.vulns ?? []) {
    vulnerabilities.push({
      package: queries[index].package.name,
      version: queries[index].version,
      id: vulnerability.id,
      summary: vulnerability.summary ?? "",
    });
  }
}

console.log(`OSV controleerde ${queries.length} productiepackages.`);
if (vulnerabilities.length === 0) {
  console.log("Geen bekende productiekwetsbaarheden gevonden.");
  process.exit(0);
}

console.error(
  `${vulnerabilities.length} bekende productiekwetsbaarheden gevonden:`,
);
for (const vulnerability of vulnerabilities) {
  console.error(
    `- ${vulnerability.package}@${vulnerability.version}: ${vulnerability.id} ${vulnerability.summary}`,
  );
}
process.exit(1);
