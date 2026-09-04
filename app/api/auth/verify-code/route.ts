import { NextResponse } from "next/server";
import {
  hashRequestIp,
  SESSION_COOKIE,
  verifyLoginCode,
} from "@/lib/auth/service";
import { publicErrorMessage } from "@/lib/http/clientError";
import { clientIpFromRequest } from "@/lib/http/requestIp";
import { readJsonBody } from "@/lib/http/requestBody";
import {
  assertRequestRateLimit,
  RequestRateLimitError,
} from "@/lib/http/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertRequestRateLimit({
      scope: "otp-verify-ip",
      subject: hashRequestIp(clientIpFromRequest(request)),
      limit: 30,
      windowMs: 15 * 60 * 1000,
    });
    const body = (await readJsonBody(request, 16_384)) as {
      email?: string;
      code?: string;
    };
    const result = verifyLoginCode(body.email ?? "", body.code ?? "");
    const response = NextResponse.json(
      { user: result.user },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: result.expiresAt,
    });
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
