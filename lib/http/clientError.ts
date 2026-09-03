import { z } from "zod";

const INTERNAL_ERROR_PATTERN =
  /brevo|google|generative|http \d|econn|enotfound|sqlite|api[_ -]?key|stack|cloudflare|fetch failed/iu;

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
