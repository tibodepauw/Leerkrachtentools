import "server-only";

import { NextResponse } from "next/server";
import {
  getSession,
  SESSION_COOKIE,
} from "@/lib/auth/service";

function cookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const encoded = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return encoded ? decodeURIComponent(encoded) : undefined;
}

export function sessionFromRequest(request: Request) {
  return getSession(cookieValue(request, SESSION_COOKIE));
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
