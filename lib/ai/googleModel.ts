export const DEFAULT_GOOGLE_MODEL = "gemini-3.5-flash-lite";

export function getGoogleModelId(): string {
  return process.env.GOOGLE_MODEL || DEFAULT_GOOGLE_MODEL;
}
