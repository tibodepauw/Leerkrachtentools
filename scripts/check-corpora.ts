import path from "node:path";
import { corpusTargets, inspectCorpus } from "../lib/rag/corpusReadiness";

async function main() {
  const args = process.argv.slice(2);
  let dataRoot = path.resolve("data"), required: string[] | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--data-root" && args[i + 1]) dataRoot = path.resolve(args[++i]);
    else if (args[i] === "--required" && args[i + 1]) required = args[++i].split(",").map(value => value.trim().toUpperCase());
    else throw new Error("Gebruik: check:corpora [--data-root PAD] [--required OPSTAP,ZILL,...]");
  }
  const targets = corpusTargets(dataRoot);
  if (required?.some(id => !targets.some(target => target.id === id))) throw new Error(`Onbekende dataset. Geldige namen: ${targets.map(target => target.id).join(", ")}`);
  let failed = false;
  for (const target of targets.filter(target => !required || required.includes(target.id))) {
    const result = await inspectCorpus(target.file);
    console.log(`${result.ok ? "OK" : "ONTBREEKT/ONGELDIG"} ${target.id}: ${result.records} records; ${result.reason}; ${path.relative(dataRoot, target.file)}`);
    failed ||= !result.ok;
  }
  console.log("Alleen bestandsstructuur gecontroleerd; inhoudelijke dekking en echte zoekvragen blijven aparte controles. Er is niets gedownload of gewijzigd.");
  process.exitCode = failed ? 1 : 0;
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Controle mislukt"); process.exitCode = 1; });
