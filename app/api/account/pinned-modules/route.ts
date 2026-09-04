import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { getDatabase } from "@/lib/auth/database";
import {
  parsePinnedModules,
  serializePinnedModules,
} from "@/lib/auth/pinnedModules";
import { readJsonBody } from "@/lib/http/requestBody";

export async function GET(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();
  return NextResponse.json({ pinnedModules: session.pinnedModules });
}

export async function PUT(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  const body = (await readJsonBody(request, 4_096)) as {
    pinnedModules?: unknown;
  };
  if (!Array.isArray(body.pinnedModules)) {
    return NextResponse.json(
      { error: "Ongeldige lijst met vastgezette tools." },
      { status: 400 },
    );
  }

  const pinnedModules = parsePinnedModules(body.pinnedModules);
  getDatabase()
    .prepare(
      "UPDATE users SET pinned_modules = ?, updated_at = ? WHERE id = ?",
    )
    .run(serializePinnedModules(pinnedModules), Date.now(), session.id);

  return NextResponse.json({ pinnedModules });
}
