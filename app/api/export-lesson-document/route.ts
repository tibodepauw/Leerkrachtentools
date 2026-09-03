import { NextResponse } from "next/server";
import { z } from "zod";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { exportLessonDocument } from "@/lib/documents/exportLessonDocument";
import { LESSON_DOCUMENT_MAX_BYTES } from "@/lib/documents/supportedFormats";
import { publicErrorMessage } from "@/lib/http/clientError";
import type { LessonExportPayload } from "@/types";

export const runtime = "nodejs";

const exportSchema = z.object({
  topic: z.string().max(500),
  learningArea: z.string().max(500),
  component: z.string().max(500),
  targetGroup: z.string().max(500),
  materials: z.array(z.string().max(500)).max(100),
  goals: z
    .array(
      z.object({
        id: z.string().max(10),
        text: z.string().max(5_000),
        taxonomy: z.enum(["MC", "DAS", "SPM"]).optional(),
      }),
    )
    .max(12),
  totalMinutes: z.number().min(1).max(240),
  educationNetwork: z.enum(["ZILL", "OVSG", "GO"]),
  lessonPreparation: z.string().max(500_000),
});

async function readExportInput(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    const lesson = exportSchema.parse(await request.json()) as LessonExportPayload;
    return {
      lesson,
      sourceBuffer: undefined,
      sourceFileName: undefined,
    };
  }

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const formData = await request.formData();
    const lessonPayload = formData.get("lesson");
    const sourceDocument = formData.get("sourceDocument");

    if (typeof lessonPayload !== "string") {
      throw new Error("Lesgegevens ontbreken.");
    }

    const lesson = exportSchema.parse(JSON.parse(lessonPayload)) as LessonExportPayload;
    let sourceBuffer: Buffer | undefined;
    let sourceFileName: string | undefined;

    if (sourceDocument instanceof File && sourceDocument.size > 0) {
      if (sourceDocument.size > LESSON_DOCUMENT_MAX_BYTES) {
        throw new Error("Het bronbestand mag maximaal 15 MB zijn.");
      }
      sourceBuffer = Buffer.from(await sourceDocument.arrayBuffer());
      sourceFileName = sourceDocument.name;
    }

    return { lesson, sourceBuffer, sourceFileName };
  }

  throw new Error(
    "Upload het formulier opnieuw en probeer de download nog eens.",
  );
}

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  try {
    const { lesson, sourceBuffer, sourceFileName } = await readExportInput(request);
    const exported = await exportLessonDocument(
      lesson,
      sourceBuffer,
      sourceFileName,
    );

    return new Response(new Uint8Array(exported.buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${exported.fileName}"`,
        "Cache-Control": "no-store",
        "X-Export-Mode": exported.exportMode,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "De lesvoorbereiding bevat ongeldige gegevens."
            : publicErrorMessage(
                error,
                "Het Word-document kon niet worden gemaakt.",
              ),
      },
      { status: 400 },
    );
  }
}
