import { NextResponse } from "next/server";
import { z } from "zod";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";
import { runDocumentJob } from "@/lib/documents/parserWorker";
import {
  hasValidLessonDocumentSignature,
  lessonDocumentExtension,
  LESSON_DOCUMENT_MAX_BYTES,
  MAX_LESSON_TEXT_CHARS,
} from "@/lib/documents/supportedFormats";
import { withUploadCapacity } from "@/lib/http/uploadCapacity";
import { publicErrorMessage } from "@/lib/http/clientError";
import {
  readBoundedFormData,
  readJsonBody,
} from "@/lib/http/requestBody";
import { RequestRateLimitError } from "@/lib/http/rateLimit";
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
  lessonPreparation: z.string().max(MAX_LESSON_TEXT_CHARS, "De lesvoorbereiding bevat te veel tekst (maximaal 500000 tekens)."),
});

// Een headerwaarde moet een ByteString zijn. De worker levert al een
// ASCII-naam; deze controle houdt de route ook veilig als dat ooit wijzigt.
function headerSafeFileName(fileName: string) {
  return /^[A-Za-z0-9_.() -]{1,130}$/.test(fileName)
    ? fileName
    : "lesvoorbereiding.docx";
}

async function readExportInput(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const maxBytes = LESSON_DOCUMENT_MAX_BYTES + 3_100_000;

  if (contentType.includes("application/json")) {
    const lesson = exportSchema.parse(
      await readJsonBody(request, 3_100_000),
    ) as LessonExportPayload;
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
    const formData = await readBoundedFormData(request, maxBytes);
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
        throw new Error("Het bronbestand mag maximaal 8 MB zijn.");
      }
      if (lessonDocumentExtension(sourceDocument.name) !== "docx") {
        throw new Error("Het bronbestand voor export moet een DOCX-bestand zijn.");
      }
      sourceBuffer = Buffer.from(await sourceDocument.arrayBuffer());
      if (
        !hasValidLessonDocumentSignature(sourceBuffer, sourceDocument.name)
      ) {
        throw new Error(
          "De bestandsinhoud komt niet overeen met een DOCX-bestand.",
        );
      }
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
    return await withUploadCapacity(session.id, async () => {
      const { lesson, sourceBuffer, sourceFileName } = await readExportInput(request);
      const exported = await runDocumentJob({ operation: "export", lesson,
        bytes: sourceBuffer?.toString("base64"), fileName: sourceFileName,
      }, request.signal);
      if (!exported.bytes || !exported.fileName || !exported.exportMode) throw new Error("Het Word-document kon niet worden gemaakt.");

      return new Response(new Uint8Array(Buffer.from(exported.bytes, "base64")), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${headerSafeFileName(exported.fileName)}"`,
          "Cache-Control": "no-store",
          "X-Export-Mode": exported.exportMode,
        },
      });
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues.find((issue) => issue.path[0] === "lessonPreparation" && issue.code === "too_big")?.message ?? "De lesvoorbereiding bevat ongeldige gegevens."
            : publicErrorMessage(
                error,
                "Het Word-document kon niet worden gemaakt.",
              ),
      },
      { status: error instanceof RequestRateLimitError ? 429 : 400 },
    );
  }
}
