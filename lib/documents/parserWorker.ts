import "server-only";
import net from "node:net";
import { runProcessJob, workerEntry } from "@/lib/workers/processJob";
import { RequestRateLimitError } from "@/lib/http/rateLimit";
import type { LessonExportPayload } from "@/types";

export type DocumentJob = {
  operation: "extract" | "export" | "avatar";
  bytes?: string; fileName?: string; lesson?: LessonExportPayload;
};
export type DocumentResult = { text?: string; bytes?: string; fileName?: string; exportMode?: string; error?: string };
const state = globalThis as typeof globalThis & { documentParserWorkers?: number };
const MAX_WIRE = 12_000_000;

async function runSocketJob(socketPath: string, input: DocumentJob, signal?: AbortSignal): Promise<DocumentResult> {
  signal?.throwIfAborted();
  const serialized = JSON.stringify(input);
  if (Buffer.byteLength(serialized) > MAX_WIRE) throw new Error("De aanvraag is te groot.");
  return await new Promise((resolve, reject) => {
    const socket = net.createConnection({ path: socketPath, allowHalfOpen: true });
    const chunks: Buffer[] = [];
    let total = 0;
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      socket.destroy();
      if (error) { reject(error); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as DocumentResult); }
      catch { reject(new Error("Ongeldig antwoord van de documentservice.")); }
    };
    const abort = () => finish(new Error("Documentverwerking is afgebroken."));
    // The service's independent RuntimeMaxSec is shorter than this deadline.
    const timer = setTimeout(() => finish(new Error("Documentverwerking duurde te lang.")), 12_000);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    socket.once("connect", () => socket.end(serialized));
    socket.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_WIRE) finish(new Error("Het documentantwoord is te groot."));
      else chunks.push(chunk);
    });
    socket.once("end", () => finish());
    socket.once("error", () => finish(new Error("De documentservice is niet beschikbaar.")));
  });
}

export async function runDocumentJob(input: DocumentJob, signal?: AbortSignal): Promise<DocumentResult> {
  signal?.throwIfAborted();
  if ((state.documentParserWorkers ?? 0) >= 2) throw new RequestRateLimitError("Te veel documenten tegelijk. Probeer zo opnieuw.");
  state.documentParserWorkers = (state.documentParserWorkers ?? 0) + 1;
  try {
    const socketPath = process.env.DOCUMENT_WORKER_SOCKET;
    if (!socketPath && process.env.NODE_ENV === "production" && !localSmokeAllowed()) {
      throw new Error("De geïsoleerde documentservice is niet geconfigureerd.");
    }
    const result = socketPath
      ? await runSocketJob(socketPath, input, signal)
      : await runProcessJob<DocumentResult>(workerEntry("document"), input, { signal, timeoutMs: 8_000 });
    if (result.error) throw new Error(result.error);
    return result;
  } finally { state.documentParserWorkers = Math.max(0, (state.documentParserWorkers ?? 1) - 1); }
}

function localSmokeAllowed() {
  if (process.env.ALLOW_LOCAL_DOCUMENT_WORKER !== "true") return false;
  try { return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(process.env.APP_ORIGIN ?? "").hostname); }
  catch { return false; }
}

export async function parseInWorker(bytes: Buffer, name: string, signal?: AbortSignal): Promise<string> {
  if (bytes.length > 8 * 1024 * 1024) throw new Error("Het bestand mag maximaal 8 MB zijn.");
  const fileName = name.includes(".") ? name : `document.${name}`;
  const result = await runDocumentJob({ operation: "extract", bytes: bytes.toString("base64"), fileName }, signal);
  if (typeof result.text !== "string" || result.text.length > 500_000) throw new Error("Het document kon niet veilig worden ingelezen.");
  return result.text;
}
