import { NextResponse } from "next/server";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { extractDocumentText } from "@/lib/documents/extractText";
import {
  isSupportedLessonDocument,
  LESSON_DOCUMENT_MAX_BYTES,
} from "@/lib/documents/supportedFormats";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sessionFromRequest(request)) return unauthorizedResponse();

  try {
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
        { error: "Het bestand mag maximaal 15 MB zijn." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractDocumentText(buffer, file.name);

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
        error:
          error instanceof Error
            ? error.message
            : "Het bestand kon niet worden ingelezen.",
      },
      { status: 400 },
    );
  }
}
