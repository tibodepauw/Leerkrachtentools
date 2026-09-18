import { spawn } from "node:child_process";
import path from "node:path";

export class JobAbortedError extends Error {
  constructor() { super("De verwerking is afgebroken."); }
}
export class JobTimeoutError extends Error {
  constructor() { super("De verwerking duurde te lang."); }
}

// Resolve only after close, including on timeout/abort. Callers must retain
// concurrency/lease reservations until the child really has been reaped.
export async function runProcessJob<T>(entry: string, input: unknown, options: {
  signal?: AbortSignal; timeoutMs: number; maxInputBytes?: number;
  maxOutputBytes?: number; heapMb?: number; env?: Record<string, string | undefined>;
}): Promise<T> {
  options.signal?.throwIfAborted();
  const serialized = JSON.stringify(input);
  if (Buffer.byteLength(serialized) > (options.maxInputBytes ?? 12_000_000)) throw new Error("De aanvraag is te groot.");
  const child = spawn(process.execPath, [
    `--max-old-space-size=${options.heapMb ?? 192}`, "--max-semi-space-size=16", entry,
  ], {
    cwd: process.cwd(), windowsHide: true,
    env: { NODE_ENV: "production", ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}), ...options.env },
    stdio: ["pipe", "pipe", "ignore"],
  });
  return await new Promise<T>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let count = 0;
    let failure: Error | undefined;
    const stop = (error: Error) => {
      failure ??= error;
      child.kill("SIGKILL");
    };
    const abort = () => stop(new JobAbortedError());
    const timer = setTimeout(() => stop(new JobTimeoutError()), options.timeoutMs);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    child.stdout.on("data", (chunk: Buffer) => {
      count += chunk.length;
      if (count > (options.maxOutputBytes ?? 12_000_000)) stop(new Error("Het antwoord is te groot."));
      else chunks.push(chunk);
    });
    child.on("error", () => { failure ??= new Error("De verwerking kon niet starten."); });
    child.stdin.on("error", () => stop(new Error("De verwerking kon niet starten.")));
    child.once("close", (code) => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      if (failure) { reject(failure); return; }
      if (code !== 0) { reject(new Error("De verwerking is onverwacht gestopt.")); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as T); }
      catch { reject(new Error("Ongeldig antwoord van de verwerking.")); }
    });
    child.stdin.end(serialized);
  });
}

export function workerEntry(name: "document" | "b2b") {
  return path.join(process.cwd(), "workers", `${name}.cjs`);
}
