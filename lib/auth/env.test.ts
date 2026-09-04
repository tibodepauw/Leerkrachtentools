import { afterEach, describe, expect, it, vi } from "vitest";
import { validateProductionEnvironment } from "@/lib/auth/env";

const VALID_AUTH_SECRET = "auth-secret-with-at-least-thirty-two-characters";
const VALID_ENCRYPTION_SECRET =
  "encryption-secret-with-at-least-thirty-two-characters";

function configureValidProductionEnvironment() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("AUTH_SECRET", VALID_AUTH_SECRET);
  vi.stubEnv("API_KEY_ENCRYPTION_SECRET", VALID_ENCRYPTION_SECRET);
  vi.stubEnv("APP_ORIGIN", "https://tools.example.be");
}

describe("validateProductionEnvironment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepteert een geldige productieconfiguratie", () => {
    configureValidProductionEnvironment();
    expect(() => validateProductionEnvironment()).not.toThrow();
  });

  it.each(["AUTH_SECRET", "API_KEY_ENCRYPTION_SECRET"] as const)(
    "weigert een te korte %s",
    (name) => {
      configureValidProductionEnvironment();
      vi.stubEnv(name, "te-kort");

      expect(() => validateProductionEnvironment()).toThrow(name);
    },
  );

  it.each(["AUTH_SECRET", "API_KEY_ENCRYPTION_SECRET"] as const)(
    "weigert een ontbrekende %s",
    (name) => {
      configureValidProductionEnvironment();
      delete process.env[name];

      expect(() => validateProductionEnvironment()).toThrow(name);
    },
  );

  it("weigert gelijke secrets", () => {
    configureValidProductionEnvironment();
    vi.stubEnv("API_KEY_ENCRYPTION_SECRET", VALID_AUTH_SECRET);

    expect(() => validateProductionEnvironment()).toThrow(
      "moeten verschillend zijn",
    );
  });

  it.each(["geen-url", "mailto:admin@example.be"])(
    "weigert een ongeldige APP_ORIGIN: %s",
    (origin) => {
      configureValidProductionEnvironment();
      vi.stubEnv("APP_ORIGIN", origin);

      expect(() => validateProductionEnvironment()).toThrow("APP_ORIGIN");
    },
  );

  it("valideert niet buiten productie", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("API_KEY_ENCRYPTION_SECRET", "");
    vi.stubEnv("APP_ORIGIN", "");

    expect(() => validateProductionEnvironment()).not.toThrow();
  });
});
