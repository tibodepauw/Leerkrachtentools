import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIpFromRequest, resolveClientIp } from "@/lib/http/requestIp";
import { absoluteAppUrl } from "@/lib/http/appUrl";

describe("clientIpFromRequest", () => {
  beforeEach(() => {
    vi.stubEnv("TRUST_PROXY_IP_HEADERS", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("gebruikt de eerste forwarded hop van een vertrouwde proxy", () => {
    const request = new Request(absoluteAppUrl("/api"), {
      headers: {
        "x-forwarded-for": "1.1.1.1, 10.0.0.1",
        "x-real-ip": "9.9.9.9",
      },
    });
    expect(clientIpFromRequest(request)).toBe("1.1.1.1");
  });

  it("gebruikt de eerste hop in x-forwarded-for", () => {
    const request = new Request(absoluteAppUrl("/api"), {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.8" },
    });
    expect(clientIpFromRequest(request)).toBe("1.2.3.4");
  });

  it("vertrouwt clientheaders niet zonder proxyconfiguratie", () => {
    vi.stubEnv("TRUST_PROXY_IP_HEADERS", "false");
    vi.stubEnv("VERCEL", "0");
    const request = new Request(absoluteAppUrl("/api"), {
      headers: {
        "x-real-ip": "9.9.9.9",
        "x-forwarded-for": "8.8.8.8, 10.0.0.1",
      },
    });
    expect(clientIpFromRequest(request)).toBe("unavailable");
    expect(resolveClientIp(request)).toEqual({
      address: "unavailable",
      trusted: false,
      source: "unavailable",
    });
  });

  it("behandelt ontbrekende headers als unavailable, geen gedeelde unknown-bucket", () => {
    vi.stubEnv("TRUST_PROXY_IP_HEADERS", "false");
    const request = new Request(absoluteAppUrl("/api"));
    expect(resolveClientIp(request).trusted).toBe(false);
    expect(resolveClientIp(request).address).toBe("unavailable");
  });
});
