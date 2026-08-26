import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { getDatabase } from "@/lib/auth/database";

export async function PATCH(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as { displayName?: string };
  const displayName = body.displayName?.trim() ?? "";
  if (
    displayName.length < 2 ||
    displayName.length > 60 ||
    /[\p{C}<>]/u.test(displayName)
  ) {
    return NextResponse.json(
      { error: "Gebruik een naam van 2 tot 60 geldige tekens." },
      { status: 400 },
    );
  }

  getDatabase()
    .prepare(
      "UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?",
    )
    .run(displayName, Date.now(), session.id);
  return NextResponse.json({ displayName });
}
