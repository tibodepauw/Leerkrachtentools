import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, appendFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Isolates functional regressions from installed sources; this is not a content-quality benchmark. */
export function createCorpusTestRoot(repositoryRoot: string) {
  const root = mkdtempSync(path.join(tmpdir(), "lt-corpus-test-"));
  cpSync(path.join(repositoryRoot, "test", "fixtures"), path.join(root, "test", "fixtures"), { recursive: true });
  // B2B tests execute the real production worker, which must read this same root.
  symlinkSync(path.join(repositoryRoot, "workers"), path.join(root, "workers"), "dir");

  function seed(relativePath: string, record: Record<string, unknown>) {
    const target = path.join(root, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(record)}\n`);
  }

  seed("data/basisonderwijs/minimumdoelen_basisonderwijs.jsonl", {
    code: "2.2.99", corpus_id: "synthetic-counting", netwerk: "AHOVOKS",
    onderwijsniveau: "LAGER", graad: "Lager onderwijs", discipline: "Wiskunde",
    titel: "Tellen tot twintig met blokken en een getallenlijn.",
    bron_url: "https://example.test/synthetic-counting",
  });
  seed("data/buso/onderwijsdoelen_buso.jsonl", {
    code: "SYN-LAS", netwerk: "AHOVOKS", onderwijsniveau: "BUSO",
    graad: "Opleidingsvorm 3", discipline: "Techniek",
    titel: "Veilig lassen van een metalen buis.",
    bron_url: "https://example.test/synthetic-welding",
  });
  seed("data/bubao/onderwijsdoelen_bubao.jsonl", {
    code: "SYN-RUST", netwerk: "AHOVOKS", onderwijsniveau: "BUBAO",
    graad: "Type 9", discipline: "Prikkelverwerking",
    titel: "Prikkelarm werken in een rustige klasomgeving.",
    bron_url: "https://example.test/synthetic-classroom",
  });
  seed("data/okan/onderwijsdoelen_okan.jsonl", {
    code: "SYN-NT2", netwerk: "AHOVOKS", onderwijsniveau: "OKAN",
    graad: "OKAN", discipline: "Nederlands NT2",
    titel: "Nederlands leren op school door informatie in teksten te verwerken.",
    bron_url: "https://example.test/synthetic-language",
  });
  appendFileSync(path.join(root, "test", "fixtures", "curriculum-zill.jsonl"), `${JSON.stringify({
    code: "SYN-SOC", netwerk: "ZILL", onderwijsniveau: "KLEUTER",
    ontwikkelveld: "Sociaal-emotionele ontwikkeling", subdomein: "Omgaan met conflicten",
    titel: "Niet slaan op de speelplaats en een conflict vreedzaam oplossen.",
    leerlijn: [{ leeftijd: "3-6j", ontwikkelstappen: ["Elkaar niet slaan op de speelplaats en hulp vragen bij ruzie."] }],
    bron_url: "https://example.test/synthetic-playground",
  })}\n`);

  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
