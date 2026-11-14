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
  vi.stubEnv("DOCUMENT_WORKER_SOCKET", "/run/leerkrachtentools-parser.sock");
  vi.stubEnv("TRUST_PROXY_IP_HEADERS", "true");
  vi.stubEnv("HOSTNAME", "127.0.0.1");
  vi.stubEnv("VERCEL", "");
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

  it.each(["http://tools.example.be", "https://user:pass@tools.example.be", "https://tools.example.be/path"])("weigert een onveilige oorsprong: %s", (origin) => {
    configureValidProductionEnvironment();
    vi.stubEnv("APP_ORIGIN", origin);
    expect(() => validateProductionEnvironment()).toThrow("APP_ORIGIN");
  });

  it("weigert de lokale parseroptie op een publieke oorsprong", () => {
    configureValidProductionEnvironment();
    vi.stubEnv("ALLOW_LOCAL_DOCUMENT_WORKER", "true");
    expect(() => validateProductionEnvironment()).toThrow("uitsluitend voor localhost");
  });
  it.each([undefined, "", "false", "TRUE", "1", " true"])(
    "weigert publieke productie zonder expliciet vertrouwde proxy: %j",
    (value) => {
      configureValidProductionEnvironment();
      if (value === undefined) delete process.env.TRUST_PROXY_IP_HEADERS;
      else vi.stubEnv("TRUST_PROXY_IP_HEADERS", value);
      expect(() => validateProductionEnvironment()).toThrow("TRUST_PROXY_IP_HEADERS");
    },
  );

  it("aanvaardt VERCEL=1 niet als vervanging voor de proxyconfiguratie", () => {
    configureValidProductionEnvironment();
    delete process.env.TRUST_PROXY_IP_HEADERS;
    vi.stubEnv("VERCEL", "1");
    expect(() => validateProductionEnvironment()).toThrow("TRUST_PROXY_IP_HEADERS");
  });

  it("weigert VERCEL=1 op de zelfgehoste deployment, ook met vertrouwde proxy", () => {
    configureValidProductionEnvironment();
    vi.stubEnv("VERCEL", "1");
    expect(() => validateProductionEnvironment()).toThrow("VERCEL=1");
  });

  it.each([undefined, "", "0.0.0.0", "::", "tools.example.be", "203.0.113.7"])(
    "weigert een publiek bereikbare Node-listener: %j",
    (hostname) => {
      configureValidProductionEnvironment();
      if (hostname === undefined) delete process.env.HOSTNAME;
      else vi.stubEnv("HOSTNAME", hostname);
      expect(() => validateProductionEnvironment()).toThrow("HOSTNAME");
    },
  );

  it.each(["127.0.0.1", "::1", "localhost"])("aanvaardt loopbacklistener %s", (hostname) => {
    configureValidProductionEnvironment();
    vi.stubEnv("HOSTNAME", hostname);
    expect(() => validateProductionEnvironment()).not.toThrow();
  });

  it.each(["http://127.0.0.1:3000", "http://localhost:3000", "http://[::1]:3000"])(
    "vraagt geen proxyconfiguratie voor loopback-smoketest %s",
    (origin) => {
      configureValidProductionEnvironment();
      vi.stubEnv("APP_ORIGIN", origin);
      vi.stubEnv("DOCUMENT_WORKER_SOCKET", "");
      vi.stubEnv("HOSTNAME", "0.0.0.0");
      vi.stubEnv("VERCEL", "1");
      delete process.env.TRUST_PROXY_IP_HEADERS;
      expect(() => validateProductionEnvironment()).not.toThrow();
    },
  );

  it("weigert publieke productie zonder documentservice", () => {
    configureValidProductionEnvironment();
    vi.stubEnv("DOCUMENT_WORKER_SOCKET", "");
    expect(() => validateProductionEnvironment()).toThrow("DOCUMENT_WORKER_SOCKET");
  });
});
