import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { getDatabase } from "@/lib/auth/database";
import { readValidatedJson } from "@/lib/http/validatedJson";
import { z } from "zod";

export async function PATCH(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  const input = await readValidatedJson(request, 16_384, z.object({ displayName: z.string() }));
  if (input.response) return input.response;
  const body = input.data;
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
