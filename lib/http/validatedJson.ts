import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody, RequestBodyTimeoutError, RequestBodyTooLargeError } from "./requestBody";

// Type assertions do not validate hostile JSON at the HTTP boundary.
export async function readValidatedJson<T>(request: Request, maxBytes: number, schema: z.ZodType<T>) {
  try {
    const result = schema.safeParse(await readJsonBody(request, maxBytes));
    if (result.success) return { data: result.data } as const;
  } catch (error) {
    const status = error instanceof RequestBodyTooLargeError ? 413 : error instanceof RequestBodyTimeoutError ? 408 : 400;
    return { response: NextResponse.json({ error: "Ongeldige of te grote aanvraag." }, { status, headers: { "Cache-Control": "no-store" } }) } as const;
  }
  return { response: NextResponse.json({ error: "Ongeldige aanvraaggegevens." }, { status: 400, headers: { "Cache-Control": "no-store" } }) } as const;
}
