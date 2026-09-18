import { afterEach, describe, expect, it, vi } from "vitest";
import { getDatabase } from "@/lib/auth/database";
import { assertOtpVerifyRateLimits } from "@/lib/http/otpRateLimit";
import { RequestRateLimitError } from "@/lib/http/rateLimit";
import { absoluteAppUrl } from "@/lib/http/appUrl";

describe("OTP verify rate limits", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    getDatabase().prepare("DELETE FROM request_rate_events WHERE scope LIKE 'otp-verify%'").run();
  });

  it("deelt geen IP-bucket wanneer forwardingheaders onbetrouwbaar zijn", () => {
    vi.stubEnv("TRUST_PROXY_IP_HEADERS", "false");
    vi.stubEnv("VERCEL", "0");

    for (let index = 0; index < 30; index += 1) {
      assertOtpVerifyRateLimits(
        new Request(absoluteAppUrl("/api/auth/verify-code"), {
          headers: { "x-forwarded-for": "1.1.1.1" },
        }),
        "alpha@school.test",
      );
    }

    expect(() =>
      assertOtpVerifyRateLimits(
        new Request(absoluteAppUrl("/api/auth/verify-code"), {
          headers: { "x-forwarded-for": "2.2.2.2" },
        }),
        "beta@school.test",
      ),
    ).not.toThrow();
  });

  it("begrenst wel per e-mail, ook zonder IP", () => {
    vi.stubEnv("TRUST_PROXY_IP_HEADERS", "false");
    const request = new Request(absoluteAppUrl("/api/auth/verify-code"));
    for (let index = 0; index < 30; index += 1) {
      assertOtpVerifyRateLimits(request, "zelfde@school.test");
    }
    expect(() =>
      assertOtpVerifyRateLimits(request, "zelfde@school.test"),
    ).toThrow(RequestRateLimitError);
  });

  it("laat geblokkeerde IPs geen nieuwe e-mailrijen opslaan", () => {
    vi.stubEnv("TRUST_PROXY_IP_HEADERS", "true");
    vi.stubEnv("VERCEL", "0");
    const request = new Request(absoluteAppUrl("/api/auth/verify-code"), {
      headers: { "x-forwarded-for": "192.0.2.10" },
    });
    for (let index = 0; index < 30; index++) {
      assertOtpVerifyRateLimits(request, `initial-${index}@example.test`);
    }
    const count = () => (getDatabase().prepare("SELECT COUNT(*) AS n FROM request_rate_events WHERE scope LIKE 'otp-verify%'").get() as { n: number }).n;
    const before = count();
    for (let index = 0; index < 50; index++) {
      expect(() => assertOtpVerifyRateLimits(request, `blocked-${index}@example.test`)).toThrow(RequestRateLimitError);
    }
    expect(count()).toBe(before);
  });
});
