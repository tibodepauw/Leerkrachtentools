import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/import-lesson-document/route";
import { absoluteAppUrl } from "@/lib/http/appUrl";
import { LESSON_DOCUMENT_MAX_BYTES } from "@/lib/documents/supportedFormats";
import { readBoundedFormData } from "@/lib/http/requestBody";
import { RequestBodyTooLargeError } from "@/lib/http/requestBody";

vi.mock("@/lib/auth/guard", () => ({
  sessionFromRequest: () => ({
    id: "import-user",
    email: "admin@example.com",
    displayName: "Import",
    tier: "admin",
    marketingOptIn: false,
    profileImageUrl: null,
    pinnedModules: [],
    expiresAt: Date.now() + 60_000,
  }),
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
}));

function multipartWithoutLength(parts: Array<{ name: string; filename?: string; value: Uint8Array | string }>) {
  const boundary = "----ltboundary";
  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();
  for (const part of parts) {
    chunks.push(encoder.encode(`--${boundary}\r\n`));
    if (part.filename) {
      chunks.push(
        encoder.encode(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\nContent-Type: text/plain\r\n\r\n`,
        ),
      );
    } else {
      chunks.push(
        encoder.encode(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n`),
      );
    }
    chunks.push(typeof part.value === "string" ? encoder.encode(part.value) : part.value);
    chunks.push(encoder.encode("\r\n"));
  }
  chunks.push(encoder.encode(`--${boundary}--\r\n`));
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    },
  });
  return new Request(absoluteAppUrl("/api/import-lesson-document"), {
    method: "POST",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("multipart bodygrenzen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("telt genegeerde velden mee vóór formData-parsing", async () => {
    const request = multipartWithoutLength([
      { name: "file", filename: "les.txt", value: "Instap" },
      { name: "ignored", value: "x".repeat(2_000) },
    ]);
    await expect(readBoundedFormData(request, 1_000)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  it("weigert import zonder Content-Length als het totaal over de limiet gaat", async () => {
    const ignored = new Uint8Array(LESSON_DOCUMENT_MAX_BYTES + 300_000);
    ignored.fill(65);
    const response = await POST(
      multipartWithoutLength([
        { name: "file", filename: "les.txt", value: "Instap met blokken" },
        { name: "padding", value: ignored },
      ]),
    );
    expect(response.status).toBe(400);
  });

  it("accepteert een klein geldig tekstbestand", async () => {
    const response = await POST(
      multipartWithoutLength([
        { name: "file", filename: "les.txt", value: "Instap met blokken" },
      ]),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { text: string };
    expect(payload.text).toContain("Instap");
  });
});
