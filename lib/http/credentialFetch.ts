import { readBodyBuffer } from "./requestBody";
import { externalApiAbortSignal, EXTERNAL_API_TIMEOUT_MS } from "./externalTimeout";

/** Bounded transport for our non-streaming AI SDK calls, including error bodies.
 * Never forward provider credentials or request content through redirects.
 */
export const credentialFetch: typeof fetch = async (input, init) => {
  const caller = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const signal = externalApiAbortSignal(caller ?? undefined);
  signal.throwIfAborted();
  const response = await fetch(input, { ...init, redirect: "error", signal });
  if (!response.body) return response;
  try {
    const bytes = await readBodyBuffer(response, 1_048_576, EXTERNAL_API_TIMEOUT_MS, signal);
    const headers = new Headers(response.headers);
    // Fetch already decoded the upstream content encoding.
    headers.delete("content-encoding");
    headers.delete("content-length");
    return new Response(bytes, { status: response.status, statusText: response.statusText, headers });
  } catch {
    if (!response.body.locked) void response.body.cancel().catch(() => {});
    throw new Error("Het externe antwoord is ongeldig, te groot of afgebroken.");
  }
};
