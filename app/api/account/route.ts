import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { getDatabase } from "@/lib/auth/database";
import { normalizeEmail } from "@/lib/auth/normalizeEmail";
import { deleteProfileImageFile } from "@/lib/auth/profileImage";
import { SESSION_COOKIE } from "@/lib/auth/service";
import { getSessionCookieOptions } from "@/lib/auth/cookies";

export async function DELETE(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  const row = getDatabase()
    .prepare("SELECT email, profile_image_path FROM users WHERE id = ?")
    .get(session.id) as
    | { email: string; profile_image_path: string | null }
    | undefined;

  deleteProfileImageFile(row?.profile_image_path);
  const database = getDatabase();
  database.transaction(() => {
    if (row?.email) {
      database
        .prepare("DELETE FROM login_codes WHERE email = ?")
        .run(normalizeEmail(row.email));
    }
    database
      .prepare("DELETE FROM feedback_events WHERE user_id = ?")
      .run(session.id);
    database
      .prepare("DELETE FROM request_rate_events WHERE subject = ?")
      .run(session.id);
    database.prepare("DELETE FROM users WHERE id = ?").run(session.id);
  })();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SESSION_COOKIE,
    "",
    getSessionCookieOptions({ maxAge: 0 }),
  );
  return response;
}
