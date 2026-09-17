import "server-only";
import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const MAX_WORKERS = 2;
const MAX_TEXT = 500_000;
const MAX_BYTES = 8 * 1024 * 1024;
const state = globalThis as typeof globalThis & { documentParserWorkers?: number };

// No application credentials or database are passed to the parser. Termination
// interrupts JavaScript even when a malformed document blocks its event loop.
const workerSource = `
process.once('message', async (workerData) => {
try {
  const bytes = Buffer.from(workerData.bytes);
  let text;
  if (workerData.kind === 'pdf') {
    const { PDFParse } = require(workerData.parserPath);
    const parser = new PDFParse({ data: bytes });
    try { text = (await parser.getText()).text; }
    finally { await parser.destroy(); }
  } else {
    const WordExtractor = require(workerData.parserPath);
    text = (await new WordExtractor().extract(bytes)).getBody();
  }
  if (typeof text !== 'string' || text.length > workerData.maxText) throw new Error('text limit');
  process.send({ text });
} catch { process.send({ error: true }); }
});
`;

export async function parseInWorker(bytes: Buffer, kind: "pdf" | "doc", signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  if (bytes.length > MAX_BYTES) throw new Error("Het bestand mag maximaal 8 MB zijn.");
  if ((state.documentParserWorkers ?? 0) >= MAX_WORKERS) throw new Error("Te veel documenten tegelijk. Probeer zo opnieuw.");
  state.documentParserWorkers = (state.documentParserWorkers ?? 0) + 1;
  let worker: ChildProcess | undefined;
  let exited: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    worker = spawn(process.execPath, ["--max-old-space-size=128", "--max-semi-space-size=16", "-e", workerSource], {
      windowsHide: true,
      env: { NODE_ENV: "production", ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) },
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      serialization: "advanced",
    });
    exited = new Promise<void>((resolve) => {
      worker!.once("close", () => resolve());
      worker!.once("error", () => resolve());
    });
    const input = {
        bytes, kind, maxText: MAX_TEXT,
        parserPath: createRequire(path.join(process.cwd(), "package.json")).resolve(kind === "pdf" ? "pdf-parse" : "word-extractor"),
    };
    return await new Promise<string>((resolve, reject) => {
      onAbort = () => reject(new Error("Documentverwerking is afgebroken."));
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
      timer = setTimeout(() => reject(new Error("Het inlezen van het document duurde te lang.")), 8_000);
      worker!.once("message", (result: { text?: string }) => {
        if (typeof result.text !== "string" || result.text.length > MAX_TEXT) reject(new Error("Het document kon niet veilig worden ingelezen."));
        else resolve(result.text);
      });
      worker!.once("error", () => reject(new Error("Het document kon niet veilig worden ingelezen.")));
      worker!.once("exit", () => reject(new Error("Documentverwerking is gestopt.")));
      worker!.send(input, (error) => { if (error) reject(new Error("Documentverwerking kon niet starten.")); });
    });
  } finally {
    if (timer) clearTimeout(timer);
    if (onAbort) signal?.removeEventListener("abort", onAbort);
    try {
      if (worker && worker.exitCode === null && worker.signalCode === null) worker.kill("SIGKILL");
      await exited;
    }
    finally { state.documentParserWorkers = Math.max(0, (state.documentParserWorkers ?? 1) - 1); }
  }
}
