import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { assertFeedbackRateLimit } from "@/lib/feedback/rateLimit";
import { sendFeedbackEmail } from "@/lib/feedback/sendFeedback";
import { publicErrorMessage } from "@/lib/http/clientError";

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  try {
    const body = (await request.json()) as {
      message?: string;
      kind?: string;
      activeModule?: string;
      anonymous?: boolean;
    };

    assertFeedbackRateLimit(session.id);

    await sendFeedbackEmail({
      fromEmail: session.email,
      kind: body.kind,
      message: body.message ?? "",
      activeModule: body.activeModule,
      anonymous: body.anonymous === true,
    });

    return NextResponse.json({
      ok: true,
      message: "Bedankt! Je feedback is doorgestuurd.",
    });
  } catch (error) {
    const message = publicErrorMessage(
      error,
      "Feedback versturen is mislukt.",
    );
    const rateLimited = message.includes("recent al meerdere");
    return NextResponse.json(
      { error: message },
      { status: rateLimited ? 429 : 400 },
    );
  }
}
