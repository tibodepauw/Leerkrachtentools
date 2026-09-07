import "server-only";

import { createHmac } from "node:crypto";
import { hashRequestIp } from "@/lib/auth/service";
import { getAuthSecret } from "@/lib/auth/secret";
import { normalizeEmail } from "@/lib/auth/normalizeEmail";
import { resolveClientIp } from "@/lib/http/requestIp";
import {
  assertRequestRateLimit,
} from "@/lib/http/rateLimit";

export const OTP_VERIFY_WINDOW_MS = 15 * 60 * 1000;
export const OTP_VERIFY_EMAIL_LIMIT = 30;
export const OTP_VERIFY_IP_LIMIT = 30;
export const OTP_VERIFY_GLOBAL_LIMIT = 2_000;

function hashEmailForOtpLimit(email: string) {
  return createHmac("sha256", getAuthSecret())
    .update(`otp-rate:${normalizeEmail(email)}`)
    .digest("hex");
}

export function assertOtpVerifyRateLimits(request: Request, email: string) {
  assertRequestRateLimit({
    scope: "otp-verify-email",
    subject: hashEmailForOtpLimit(email),
    limit: OTP_VERIFY_EMAIL_LIMIT,
    windowMs: OTP_VERIFY_WINDOW_MS,
  });

  const ip = resolveClientIp(request);
  if (ip.trusted) {
    assertRequestRateLimit({
      scope: "otp-verify-ip",
      subject: hashRequestIp(ip.address),
      limit: OTP_VERIFY_IP_LIMIT,
      windowMs: OTP_VERIFY_WINDOW_MS,
    });
  }

  assertRequestRateLimit({
    scope: "otp-verify-global",
    subject: "emergency",
    limit: OTP_VERIFY_GLOBAL_LIMIT,
    windowMs: OTP_VERIFY_WINDOW_MS,
  });
}
