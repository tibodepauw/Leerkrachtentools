import { NextResponse } from "next/server";
import {
  hashRequestIp,
  requestLoginCode,
} from "@/lib/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      marketingOptIn?: boolean;
      privacyAccepted?: boolean;
    };
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const result = await requestLoginCode({
      email: body.email ?? "",
      marketingOptIn: body.marketingOptIn === true,
      privacyAccepted: body.privacyAccepted === true,
      ipHash: hashRequestIp(ip),
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Code aanvragen is mislukt.";
    const rateLimited =
      message.includes("Te veel") || message.includes("Wacht één minuut");
    return NextResponse.json(
      { error: message },
      {
        status: rateLimited ? 429 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
