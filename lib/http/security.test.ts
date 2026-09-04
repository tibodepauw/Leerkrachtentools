import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicy,
  isSameOriginMutation,
} from "@/lib/http/security";

describe("web security", () => {
  it("bouwt een nonce-CSP zonder unsafe-inline scripts", () => {
    const policy = contentSecurityPolicy("nonce-value", false);
    expect(policy).toContain("script-src 'self' 'nonce-nonce-value' 'strict-dynamic'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(policy).toContain("object-src 'none'");
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
});
