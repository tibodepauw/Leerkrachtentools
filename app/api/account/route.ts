import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { getDatabase } from "@/lib/auth/database";
import { deleteProfileImageFile } from "@/lib/auth/profileImage";
import { SESSION_COOKIE } from "@/lib/auth/service";

export async function DELETE(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  const row = getDatabase()
    .prepare("SELECT profile_image_path FROM users WHERE id = ?")
    .get(session.id) as { profile_image_path: string | null } | undefined;

  deleteProfileImageFile(row?.profile_image_path);
  const database = getDatabase();
  database.transaction(() => {
    database
      .prepare("DELETE FROM feedback_events WHERE user_id = ?")
      .run(session.id);
    database.prepare("DELETE FROM users WHERE id = ?").run(session.id);
  })();
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
