import { readBodyBuffer } from "./requestBody";
import { EXTERNAL_API_TIMEOUT_MS } from "./externalTimeout";

export async function readExternalJson(response: Response, signal?: AbortSignal, maxBytes = 1_048_576): Promise<unknown> {
  try {
    const bytes = await readBodyBuffer(response, maxBytes, EXTERNAL_API_TIMEOUT_MS, signal);
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    // Declared oversize bodies are rejected before a reader is obtained.
    // Do not leave that upstream body flowing, and do not echo its contents.
    if (response.body && !response.body.locked) void response.body.cancel().catch(() => {});
    throw new Error("Het externe antwoord is ongeldig, te groot of afgebroken.");
  }
}
