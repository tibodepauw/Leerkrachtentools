import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { sendFeedbackEmail } from "@/lib/feedback/sendFeedback";

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  try {
    const body = (await request.json()) as {
      message?: string;
      kind?: string;
      activeModule?: string;
    };

    await sendFeedbackEmail({
      fromEmail: session.email,
      kind: body.kind,
      message: body.message ?? "",
      activeModule: body.activeModule,
    });

    return NextResponse.json({
      ok: true,
      message: "Bedankt! Je feedback is doorgestuurd.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Feedback versturen is mislukt.",
      },
      { status: 400 },
    );
  }
}
