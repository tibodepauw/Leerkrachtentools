import { NextResponse } from "next/server";
import { sessionFromRequest, unauthorizedResponse } from "@/lib/auth/guard";
import { getDatabase } from "@/lib/db/sqlite";
import { exportUserData } from "@/lib/privacy/dataControls";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();
  return NextResponse.json(exportUserData(getDatabase(), session.id), { headers: {
    "Cache-Control": "no-store, private", "Content-Disposition": 'attachment; filename="mijn-accountgegevens.json"', "X-Content-Type-Options": "nosniff",
  } });
}
