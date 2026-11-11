import { NextResponse } from "next/server";
import { hashRequestIp, requestLoginCode } from "@/lib/auth/service";
import { isDevLoginCodeAllowed } from "@/lib/auth/devLogin";
import {
  createLoginChallenge,
  getLoginChallengeCookieOptions,
  LOGIN_CHALLENGE_COOKIE,
  readLoginChallenge,
} from "@/lib/auth/loginChallenge";
import { publicErrorMessage } from "@/lib/http/clientError";
import { RequestRateLimitError } from "@/lib/http/rateLimit";
import { resolveClientIp } from "@/lib/http/requestIp";
import { readJsonBody } from "@/lib/http/requestBody";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const raw = await readJsonBody(request, 16_384);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("De inlogaanvraag bevat ongeldige gegevens.");
    const body = raw as {
      email?: string;
      marketingOptIn?: boolean;
      privacyAccepted?: boolean;
      termsVersion?: string;
    };
    const clientIp = resolveClientIp(request);
    // Reuse this browser's nonce so tabs share one challenge; mint one for a
    // browser that has none. Only its hash reaches the database.
    const challenge = readLoginChallenge(request) ?? createLoginChallenge();
    const result = await requestLoginCode({
      email: typeof body.email === "string" ? body.email : "",
      marketingOptIn: body.marketingOptIn === true,
      privacyAccepted: body.privacyAccepted === true,
      termsVersion: body.termsVersion,
      ipHash: hashRequestIp(clientIp.trusted ? clientIp.address : "unavailable"),
      ipTrusted: clientIp.trusted,
      challenge,
      exposeDevCode: isDevLoginCodeAllowed(request.url),
    });
    const response = NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set(
      LOGIN_CHALLENGE_COOKIE,
      challenge,
      getLoginChallengeCookieOptions(),
    );
    return response;
  } catch (error) {
    const message = publicErrorMessage(error, "Code aanvragen is mislukt.");
    const rateLimited = error instanceof RequestRateLimitError;
    return NextResponse.json(
      { error: message },
      {
        status: rateLimited ? 429 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
