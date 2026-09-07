import "server-only";

export function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "test") {
    return "local-development-secret-change-before-production";
  }
  throw new Error("AUTH_SECRET moet minstens 32 tekens bevatten.");
}
