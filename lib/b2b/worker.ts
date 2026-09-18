import "server-only";
import { runProcessJob, workerEntry } from "@/lib/workers/processJob";
import { orgApiExecutionLimitMs } from "@/lib/api/orgQuota";
import { ApiAuthError } from "@/lib/api-keys";
export type B2bTask = "match" | "audit" | "improve";
const state = globalThis as typeof globalThis & { b2bWorkers?: number };

// These are trusted application calculations, not a document-parser sandbox.
// Only configuration needed for retrieval/provider budgets reaches this child.
const ENV_KEYS = ["DATABASE_PATH", "ORG_AI_DAILY_LIMIT", "ORG_AI_GLOBAL_DAILY_LIMIT", "GROQ_API_KEY", "GROQ_MODEL", "CEREBRAS_API_KEY", "CEREBRAS_MODEL", "SAMBANOVA_API_KEY", "SAMBANOVA_BASE_URL", "SAMBANOVA_MODEL", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_MODEL", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_MODEL"];
export async function runB2bJob(task: B2bTask, body: unknown, orgId: string, signal: AbortSignal) {
  signal.throwIfAborted();
  if ((state.b2bWorkers ?? 0) >= 4) throw new ApiAuthError("Te veel berekeningen tegelijk. Probeer zo opnieuw.", 429);
  state.b2bWorkers = (state.b2bWorkers ?? 0) + 1;
  try {
    const result = await runProcessJob<{ payload?: unknown; error?: boolean }>(workerEntry("b2b"), { task, body, orgId }, {
      signal, timeoutMs: orgApiExecutionLimitMs(), heapMb: 256,
      maxInputBytes: 70_000, maxOutputBytes: 520_000,
      env: Object.fromEntries(ENV_KEYS.flatMap((name) => process.env[name] ? [[name, process.env[name]]] : [])),
    });
    if (result.error || !result.payload) throw new Error("De berekening kon niet worden uitgevoerd.");
    return result.payload;
  } finally { state.b2bWorkers = Math.max(0, (state.b2bWorkers ?? 1) - 1); }
}
