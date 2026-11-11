import { NextResponse } from "next/server";
import {
  hasPendingLoginCode,
  LOGIN_CODE_EXPIRED_MESSAGE,
  SESSION_COOKIE,
  verifyLoginCode,
} from "@/lib/auth/service";
import { getSessionCookieOptions } from "@/lib/auth/cookies";
import {
  getLoginChallengeCookieOptions,
  LOGIN_CHALLENGE_COOKIE,
  readLoginChallenge,
} from "@/lib/auth/loginChallenge";
import { publicErrorMessage } from "@/lib/http/clientError";
import { assertOtpVerifyRateLimits } from "@/lib/http/otpRateLimit";
import { readJsonBody } from "@/lib/http/requestBody";
import { RequestRateLimitError } from "@/lib/http/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const raw = await readJsonBody(request, 16_384);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("De inlogaanvraag bevat ongeldige gegevens.");
    const body = raw as {
      email?: string;
      code?: string;
    };
    const email = typeof body.email === "string" ? body.email : "";
    const code = typeof body.code === "string" ? body.code : "";
    // A request that does not come from the browser that asked for the code
    // stops here: no attempt and no rate-limit bucket is spent for the address.
    const challenge = readLoginChallenge(request);
    if (!challenge || !hasPendingLoginCode(email, challenge)) {
      throw new Error(LOGIN_CODE_EXPIRED_MESSAGE);
    }
    assertOtpVerifyRateLimits(request, email, challenge);
    const result = verifyLoginCode(email, code, challenge);
    const response = NextResponse.json(
      { user: result.user },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(
      SESSION_COOKIE,
      result.sessionToken,
      getSessionCookieOptions({ expires: result.expiresAt }),
    );
    response.cookies.set(
      LOGIN_CHALLENGE_COOKIE,
      "",
      getLoginChallengeCookieOptions(0),
    );
    return response;
  } catch (error) {
    const message = publicErrorMessage(error, "Verificatie is mislukt.");
    const inviteOnly = message.includes("invite-only");
    const rateLimited = error instanceof RequestRateLimitError;
    return NextResponse.json(
      { error: message },
      {
        status: rateLimited ? 429 : inviteOnly ? 403 : 400,
        headers: {
          "Cache-Control": "no-store",
          ...(rateLimited ? { "Retry-After": "900" } : {}),
        },
      },
    );
  }
}
