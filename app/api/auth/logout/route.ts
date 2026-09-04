import { NextResponse } from "next/server";
import {
  revokeSession,
  SESSION_COOKIE,
} from "@/lib/auth/service";
import {
  getSessionCookieOptions,
  readCookieValue,
} from "@/lib/auth/cookies";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  revokeSession(readCookieValue(cookieHeader, SESSION_COOKIE));

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SESSION_COOKIE,
    "",
    getSessionCookieOptions({ maxAge: 0 }),
  );
  return response;
}
