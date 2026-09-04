import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { extractDocumentText } from "@/lib/documents/extractText";
import {
  hasValidLessonDocumentSignature,
  isSupportedLessonDocument,
  LESSON_DOCUMENT_MAX_BYTES,
} from "@/lib/documents/supportedFormats";
import { publicErrorMessage } from "@/lib/http/clientError";
import { assertContentLength } from "@/lib/http/requestBody";
import { withRequestConcurrency } from "@/lib/http/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  try {
    assertContentLength(request, LESSON_DOCUMENT_MAX_BYTES + 256_000);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Kies een bestand om te uploaden." },
        { status: 400 },
      );
    }

    if (!isSupportedLessonDocument(file.name)) {
      return NextResponse.json(
        {
          error:
            "Ondersteunde formaten: PDF, DOC, DOCX, ODT, RTF, TXT en MD.",
        },
        { status: 400 },
      );
    }

    if (file.size > LESSON_DOCUMENT_MAX_BYTES) {
      return NextResponse.json(
        { error: "Het bestand mag maximaal 8 MB zijn." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasValidLessonDocumentSignature(buffer, file.name)) {
      return NextResponse.json(
        { error: "De bestandsinhoud komt niet overeen met het bestandstype." },
        { status: 400 },
      );
    }
    const text = await withRequestConcurrency({
      scope: "document-parse",
      subject: session.id,
      limit: 1,
      task: () => extractDocumentText(buffer, file.name),
    });

    if (!text.trim()) {
      return NextResponse.json(
        {
          error:
            "Er kon geen leesbare tekst uit dit bestand worden gehaald.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      text,
      fileName: file.name,
      characters: text.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: publicErrorMessage(
          error,
          "Het bestand kon niet veilig worden ingelezen.",
        ),
      },
      { status: 400 },
    );
  }
}
