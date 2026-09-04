import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIpFromRequest } from "@/lib/http/requestIp";

describe("clientIpFromRequest", () => {
  beforeEach(() => {
    vi.stubEnv("TRUST_PROXY_IP_HEADERS", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("gebruikt de eerste forwarded hop van een vertrouwde proxy", () => {
    const request = new Request("http://localhost/api", {
      headers: {
        "x-forwarded-for": "1.1.1.1, 10.0.0.1",
        "x-real-ip": "9.9.9.9",
      },
    });
    expect(clientIpFromRequest(request)).toBe("1.1.1.1");
  });

  it("gebruikt de eerste hop in x-forwarded-for", () => {
    const request = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.8" },
    });
    expect(clientIpFromRequest(request)).toBe("1.2.3.4");
  });

  it("vertrouwt clientheaders niet zonder proxyconfiguratie", () => {
    vi.stubEnv("TRUST_PROXY_IP_HEADERS", "false");
    const request = new Request("http://localhost/api", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(clientIpFromRequest(request)).toBe("unknown");
  });
});
