import { createReadStream } from "node:fs";
import path from "node:path";
import { OPSTAP_CORPUS_PROD, OVSG_CORPUS_PROD, GO_NIEUW_CORPUS_PROD, GO_OUD_CORPUS_PROD, ZILL_CORPUS_PROD, SECONDARY_CURRICULUM_PROD, SECONDARY_MINIMUM_GOALS_PROD, SECONDARY_POV_CURRICULUM_PROD, DOMAIN_CORPUS_PATHS } from "./corpusLevelCache";

export function corpusTargets(dataRoot = path.resolve("data")) {
  const paths = [
    ["OPSTAP", OPSTAP_CORPUS_PROD], ["OVSG", OVSG_CORPUS_PROD], ["GO_NIEUW", GO_NIEUW_CORPUS_PROD],
    ["GO_OUD", GO_OUD_CORPUS_PROD], ["ZILL", ZILL_CORPUS_PROD], ["SECUNDAIR_LEERPLANNEN", SECONDARY_CURRICULUM_PROD],
    ["SECUNDAIR_MINIMUMDOELEN", SECONDARY_MINIMUM_GOALS_PROD], ["POV", SECONDARY_POV_CURRICULUM_PROD],
    ...Object.entries(DOMAIN_CORPUS_PATHS).map(([id, entry]) => [id, entry.prod]),
  ];
  return paths.map(([id, file]) => ({ id, file: path.join(dataRoot, path.relative(path.resolve("data"), file)) }));
}

// Read-only, streaming check. No fixture fallback and no content in diagnostics.
// Valid JSONL does not establish curriculum completeness or semantic quality.
export async function inspectCorpus(file: string) {
  let records = 0, line = 0, pending = "";
  const record = (value: string) => {
    line++;
    if (!value.trim()) return;
    if (Buffer.byteLength(value) > 1_048_576) throw new Error(`Regel ${line} is groter dan 1 MiB.`);
    let parsed: unknown;
    try { parsed = JSON.parse(value.trim()); } catch { throw new Error(`Ongeldige JSON op regel ${line}.`); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`Geen recordobject op regel ${line}.`);
    records++;
  };
  try {
    for await (const chunk of createReadStream(file, { encoding: "utf8" })) {
      pending += chunk;
      let newline;
      while ((newline = pending.indexOf("\n")) !== -1) {
        record(pending.slice(0, newline)); pending = pending.slice(newline + 1);
      }
      if (Buffer.byteLength(pending) > 1_048_576) throw new Error(`Regel ${line + 1} is groter dan 1 MiB.`);
    }
    if (pending) record(pending);
    return { ok: records > 0, records, reason: records ? "JSONL gecontroleerd" : "Geen records" };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const reason = code === "ENOENT" ? "Bestand ontbreekt" : code ? "Bestand niet leesbaar" : error instanceof Error ? error.message : "Controle mislukt";
    return { ok: false, records, reason };
  }
}
