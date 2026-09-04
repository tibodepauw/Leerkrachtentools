import { z } from "zod";

const INTERNAL_ERROR_PATTERN =
  /brevo|google|generative|http \d|econn|enotfound|sqlite|api[_ -]?key|stack|cloudflare|fetch failed/iu;

export function formatClientRequestError(
  error: unknown,
  fallback = "De analyse is mislukt.",
): string {
  const message =
    error instanceof Error ? error.message.trim() : String(error ?? "").trim();
  if (
    /failed to fetch|load failed|networkerror|err_network|aborted|econn|etimedout/i.test(
      message,
    )
  ) {
    return "De verbinding met de server is verbroken. Probeer het opnieuw.";
  }
  if (!message || message.length > 220 || INTERNAL_ERROR_PATTERN.test(message)) {
    return fallback;
  }
  return message;
}

export function publicErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? fallback;
  }
  if (!(error instanceof Error)) {
    return fallback;
  }
  const message = error.message.trim();
  if (!message || message.length > 220 || INTERNAL_ERROR_PATTERN.test(message)) {
    return fallback;
  }
  return message;
}
