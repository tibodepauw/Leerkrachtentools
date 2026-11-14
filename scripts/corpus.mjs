import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = process.env.CURRICULUM_WORK_DIR || path.join(homedir(), ".cache", "agent-werk", "leerkrachtentools-corpus");
const venv = path.join(cache, "venv");
const python = process.env.CURRICULUM_PYTHON || path.join(venv, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const args = process.argv.slice(2);
const entries = {
  "import-ovsg-export": "scripts/import_ovsg_export.py",
  "fetch-ovsg": "scripts/fetch_ovsg_authenticated.py",
  "fetch-ovsg-secundair": "scripts/fetch_ovsg_secondary.py",
};
const script = Object.hasOwn(entries, args[0]) ? entries[args.shift()] : "scripts/refresh_curriculum.py";

function run(command, argv, env = process.env) {
  const result = spawnSync(command, argv, { cwd: root, env, stdio: "inherit" });
  if (result.error) {
    console.error(`Opdracht kon niet starten: ${result.error.code}.`);
    return 1;
  }
  return result.status ?? 1;
}

if (args[0] === "setup") {
  if (process.env.CURRICULUM_PYTHON && !existsSync(python)) {
    console.error("CURRICULUM_PYTHON verwijst niet naar een bestaande interpreter.");
    process.exit(2);
  }
  mkdirSync(path.join(cache, "tmp"), { recursive: true });
  const env = { ...process.env, UV_CACHE_DIR: path.join(cache, "uv"), TMPDIR: path.join(cache, "tmp") };
  const uv = spawnSync("uv", ["--version"], { stdio: "ignore" }).status === 0;
  if (!existsSync(python)) {
    const code = uv ? run("uv", ["venv", venv], env) : run("python3", ["-m", "venv", venv], env);
    if (code) process.exit(code);
  }
  const lock = path.join(root, "scripts", "requirements-corpus.lock");
  process.exit(uv
    ? run("uv", ["pip", "install", "--python", python, "--require-hashes", "-r", lock], env)
    : run(python, ["-m", "pip", "install", "--require-hashes", "-r", lock], env));
}

if (!existsSync(python)) {
  if (args.includes("--help") || args.includes("--list")) {
    process.exit(run(process.platform === "win32" ? "python" : "python3", [script, ...args]));
  }
  console.error("De corpusomgeving ontbreekt. Voer eerst npm run corpus:setup uit of stel CURRICULUM_PYTHON in.");
  process.exit(2);
}
process.exit(run(python, [script, ...args]));
