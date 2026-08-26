import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { getDatabase } from "@/lib/auth/database";

export async function PATCH(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as { marketingOptIn?: boolean };
  if (typeof body.marketingOptIn !== "boolean") {
    return NextResponse.json(
      { error: "Ongeldige toestemmingswaarde." },
      { status: 400 },
    );
  }
  const now = Date.now();
  getDatabase()
    .prepare(
      `UPDATE users
       SET marketing_opt_in = ?,
           marketing_consent_at = ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .run(
      body.marketingOptIn ? 1 : 0,
      body.marketingOptIn ? now : null,
      now,
      session.id,
    );
  return NextResponse.json({ marketingOptIn: body.marketingOptIn });
}
