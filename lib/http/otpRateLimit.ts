import "server-only";

import { createHmac } from "node:crypto";
import { getDatabase } from "@/lib/auth/database";
import { hashLoginChallenge } from "@/lib/auth/loginChallenge";
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

/**
 * The address bucket is keyed on address plus browser challenge. Another
 * browser, even one holding its own code for the same address, lands in a
 * different bucket and cannot use up the owner's verifications.
 */
function hashEmailForOtpLimit(email: string, challenge: string) {
  return createHmac("sha256", getAuthSecret())
    .update(`otp-rate:${normalizeEmail(email)}:${hashLoginChallenge(challenge)}`)
    .digest("hex");
}

/**
 * Call only after the caller established that `challenge` (the raw nonce
 * from the login-challenge cookie) has a pending code for `email`. Requests
 * without a matching challenge must not reach these buckets at all.
 */
export function assertOtpVerifyRateLimits(
  request: Request,
  email: string,
  challenge: string,
) {
  const emailSubject = hashEmailForOtpLimit(email, challenge);
  // A denial must not leave rows in earlier buckets. Otherwise rotating the
  // email field lets an already blocked caller grow the database indefinitely.
  getDatabase().transaction(() => {
    assertRequestRateLimit({
      scope: "otp-verify-email",
      subject: emailSubject,
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
  })();
}
