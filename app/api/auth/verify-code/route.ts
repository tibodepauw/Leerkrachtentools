import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  verifyLoginCode,
} from "@/lib/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; code?: string };
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
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Verificatie is mislukt.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
