export class ProductionConfigurationError extends Error {
  constructor(readonly issues: readonly string[]) { super(`Ongeldige productieconfiguratie:\n${issues.map(issue => `- ${issue}`).join("\n")}`); }
}

const MINIMUM_SECRET_LENGTH = 32;

function invalidSecret(value: string | undefined) {
  return !value || value.length < MINIMUM_SECRET_LENGTH;
}

export function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;

  const errors: string[] = [];
  const authSecret = process.env.AUTH_SECRET;
  const encryptionSecret = process.env.API_KEY_ENCRYPTION_SECRET;

  if (invalidSecret(authSecret)) {
    errors.push("AUTH_SECRET moet minstens 32 tekens bevatten.");
  }
  if (invalidSecret(encryptionSecret)) {
    errors.push("API_KEY_ENCRYPTION_SECRET moet minstens 32 tekens bevatten.");
  }
  if (
    authSecret &&
    encryptionSecret &&
    authSecret === encryptionSecret
  ) {
    errors.push(
      "AUTH_SECRET en API_KEY_ENCRYPTION_SECRET moeten verschillend zijn.",
    );
  }

  const appOrigin = process.env.APP_ORIGIN?.trim();
  if (!appOrigin) {
    errors.push("APP_ORIGIN moet een geldige http(s)-URL bevatten.");
  } else {
    try {
      const url = new URL(appOrigin);
      if (!["http:", "https:"].includes(url.protocol) || url.origin === "null") {
        errors.push("APP_ORIGIN moet een geldige http(s)-URL bevatten.");
      }
      const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
      if (!loopback && url.protocol !== "https:") errors.push("APP_ORIGIN moet HTTPS gebruiken buiten localhost.");
      if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) errors.push("APP_ORIGIN mag alleen de oorsprong bevatten, zonder pad of inloggegevens.");
      if (!loopback && process.env.ALLOW_LOCAL_DOCUMENT_WORKER === "true") errors.push("ALLOW_LOCAL_DOCUMENT_WORKER is uitsluitend voor localhost-tests.");
      if (!loopback && !process.env.DOCUMENT_WORKER_SOCKET?.startsWith("/")) errors.push("DOCUMENT_WORKER_SOCKET moet naar de geïsoleerde Linux-documentservice wijzen.");
    } catch {
      errors.push("APP_ORIGIN moet een geldige http(s)-URL bevatten.");
    }
  }

  if (errors.length > 0) {
    throw new ProductionConfigurationError(errors);
  }
}
