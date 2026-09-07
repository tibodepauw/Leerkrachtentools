import { afterEach, describe, expect, it, vi } from "vitest";
import { isDevLoginCodeAllowed } from "@/lib/auth/devLogin";

describe("isDevLoginCodeAllowed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("negeert ALLOW_DEV_LOGIN_CODE altijd in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEV_LOGIN_CODE", "true");
    vi.stubEnv("APP_ORIGIN", "https://tools.example.be");
    expect(isDevLoginCodeAllowed("http://127.0.0.1:3000/api/auth/request-code")).toBe(
      false,
    );
    expect(
      isDevLoginCodeAllowed("https://tools.example.be/api/auth/request-code"),
    ).toBe(false);
  });

  it("laat lokale codes alleen toe buiten production met de env-flag", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ALLOW_DEV_LOGIN_CODE", "true");
    vi.stubEnv("APP_ORIGIN", "");
    expect(isDevLoginCodeAllowed("http://127.0.0.1:3000/api/auth/request-code")).toBe(
      true,
    );
    vi.stubEnv("ALLOW_DEV_LOGIN_CODE", "false");
    expect(isDevLoginCodeAllowed("http://127.0.0.1:3000/api/auth/request-code")).toBe(
      false,
    );
  });
});
