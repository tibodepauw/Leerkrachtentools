export const EXTERNAL_API_TIMEOUT_MS = 12_000;

export function externalApiAbortSignal(): AbortSignal {
  return AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS);
}
