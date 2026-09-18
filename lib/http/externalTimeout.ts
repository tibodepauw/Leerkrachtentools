export const EXTERNAL_API_TIMEOUT_MS = 12_000;

export function externalApiAbortSignal(caller?: AbortSignal): AbortSignal {
  const deadline = AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS);
  return caller ? AbortSignal.any([caller, deadline]) : deadline;
}
