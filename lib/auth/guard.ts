import "server-only";

import { NextResponse } from "next/server";
import {
  getSession,
  SESSION_COOKIE,
} from "@/lib/auth/service";
import { readCookieValue } from "@/lib/auth/cookies";

export function sessionFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return getSession(readCookieValue(cookieHeader, SESSION_COOKIE));
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Je sessie is verlopen. Log opnieuw in." },
    {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
