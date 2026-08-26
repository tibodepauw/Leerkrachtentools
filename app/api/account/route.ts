import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { getDatabase } from "@/lib/auth/database";
import { SESSION_COOKIE } from "@/lib/auth/service";

export async function DELETE(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  getDatabase().prepare("DELETE FROM users WHERE id = ?").run(session.id);
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
