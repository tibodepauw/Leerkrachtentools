import { afterEach, describe, expect, it, vi } from "vitest";
import {
  contentSecurityPolicy,
  isSameOriginMutation,
} from "@/lib/http/security";

describe("web security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("bouwt een nonce-CSP zonder unsafe-inline scripts", () => {
    const policy = contentSecurityPolicy("nonce-value", false);
    expect(policy).toContain("script-src 'self' 'nonce-nonce-value' 'strict-dynamic'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("worker-src 'self'");
    expect(policy).toContain("manifest-src 'self'");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("weigert mutaties van een andere origin", () => {
    const request = new Request("https://app.example/api/account", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(isSameOriginMutation(request)).toBe(false);
  });

  it("laat same-origin mutaties en requests zonder browser-Origin toe", () => {
    expect(
      isSameOriginMutation(
        new Request("https://app.example/api/account", {
          method: "POST",
          headers: { origin: "https://app.example" },
        }),
      ),
    ).toBe(true);
    expect(
      isSameOriginMutation(
        new Request("https://app.example/api/account", { method: "POST" }),
      ),
    ).toBe(true);
  });

  it("weigert mutaties zonder Origin in productie", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://tools.example.be");

    expect(
      isSameOriginMutation(
        new Request("https://tools.example.be/api/account", {
          method: "DELETE",
        }),
      ),
    ).toBe(false);
  });

  it("vergelijkt Origin met de genormaliseerde APP_ORIGIN", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://tools.example.be/config/path");

    expect(
      isSameOriginMutation(
        new Request("https://internal.example/api/account", {
          method: "PATCH",
          headers: { origin: "https://tools.example.be" },
        }),
      ),
    ).toBe(true);
    expect(
      isSameOriginMutation(
        new Request("https://internal.example/api/account", {
          method: "PATCH",
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false);
  });

  it("laat lokale previewpoorten alleen buiten productie toe", () => {
    const request = new Request("http://localhost:3000/api/auth/request-code", {
      method: "POST",
      headers: { origin: "http://127.0.0.1:63483" },
    });
    expect(isSameOriginMutation(request)).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://tools.example.be");
    expect(isSameOriginMutation(request)).toBe(false);
  });

  it("weigert een misvormde Origin-header", () => {
    expect(
      isSameOriginMutation(
        new Request("https://app.example/api/account", {
          method: "POST",
          headers: { origin: "not a url" },
        }),
      ),
    ).toBe(false);
  });
});
