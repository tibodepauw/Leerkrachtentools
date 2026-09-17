import { NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const session = sessionFromRequest(request);
  return NextResponse.json({ userId: session?.id ?? null }, {
    status: session ? 200 : 401,
    headers: { "Cache-Control": "no-store, private" },
  });
}
