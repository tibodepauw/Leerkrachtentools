import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { readCookieValue } from "@/lib/auth/cookies";
import { getAuthSecret } from "@/lib/auth/secret";

/**
 * Browser-bound login challenge.
 *
 * A login code is only verifiable from the browser that requested it. The
 * browser holds a random nonce in an HttpOnly cookie; the database stores only
 * its HMAC next to the code. A request without the matching nonce cannot see,
 * invalidate or spend attempts on someone else's pending code.
 *
 * The nonce is reused while the cookie lives, so several tabs in one browser
 * share it and do not break each other's pending login.
 */
export const LOGIN_CHALLENGE_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-leerkrachtentools_login"
    : "leerkrachtentools_login";

/** Longer than the code lifetime, so a code never outlives its cookie. */
export const LOGIN_CHALLENGE_MAX_AGE_SECONDS = 15 * 60;

const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createLoginChallenge() {
  return randomBytes(32).toString("base64url");
}

export function isLoginChallenge(value: unknown): value is string {
  return typeof value === "string" && CHALLENGE_PATTERN.test(value);
}

export function hashLoginChallenge(challenge: string) {
  if (!isLoginChallenge(challenge)) {
    throw new Error("Ongeldige login-challenge.");
  }
  return createHmac("sha256", getAuthSecret())
    .update(`login-challenge:${challenge}`)
    .digest("hex");
}

/** Returns the well-formed nonce from the request cookie, otherwise null. */
export function readLoginChallenge(request: Request) {
  const value = readCookieValue(
    request.headers.get("cookie") ?? "",
    LOGIN_CHALLENGE_COOKIE,
  );
  return isLoginChallenge(value) ? value : null;
}

export function getLoginChallengeCookieOptions(
  maxAge = LOGIN_CHALLENGE_MAX_AGE_SECONDS,
) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}
