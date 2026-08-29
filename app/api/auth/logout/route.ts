import { NextResponse } from "next/server";
import {
  revokeSession,
  SESSION_COOKIE,
} from "@/lib/auth/service";
import { readCookieValue } from "@/lib/auth/cookies";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  revokeSession(readCookieValue(cookieHeader, SESSION_COOKIE));

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
