import { NextResponse } from "next/server";
import { hashRequestIp, requestLoginCode } from "@/lib/auth/service";
import { isDevLoginCodeAllowed } from "@/lib/auth/devLogin";
import { publicErrorMessage } from "@/lib/http/clientError";
import { clientIpFromRequest } from "@/lib/http/requestIp";
import { readJsonBody } from "@/lib/http/requestBody";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await readJsonBody(request, 16_384)) as {
      email?: string;
      marketingOptIn?: boolean;
      privacyAccepted?: boolean;
    };
    const clientIp = clientIpFromRequest(request);
    const result = await requestLoginCode({
      email: body.email ?? "",
      marketingOptIn: body.marketingOptIn === true,
      privacyAccepted: body.privacyAccepted === true,
      ipHash: hashRequestIp(clientIp),
      exposeDevCode: isDevLoginCodeAllowed(request.url),
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = publicErrorMessage(error, "Code aanvragen is mislukt.");
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
