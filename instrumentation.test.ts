import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "@/instrumentation";

describe("production startup validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("laat de Node.js-startup falen bij ontbrekende secrets", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://tools.example.be");
    delete process.env.AUTH_SECRET;
    delete process.env.API_KEY_ENCRYPTION_SECRET;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    await expect(register()).rejects.toThrow("process.exit(1)");
    expect(exit).toHaveBeenCalledWith(1);
    expect(consoleError).toHaveBeenCalledWith(
      "Fatale fout in de productieconfiguratie.",
      expect.any(Error),
    );
  });

  it("voert servervalidatie niet uit in een niet-Node.js-runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.AUTH_SECRET;
    delete process.env.API_KEY_ENCRYPTION_SECRET;
    delete process.env.APP_ORIGIN;

    await expect(register()).resolves.toBeUndefined();
  });
});
