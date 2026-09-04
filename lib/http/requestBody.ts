export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("De aanvraag is te groot.");
    this.name = "RequestBodyTooLargeError";
  }
}

export function assertContentLength(request: Request, maxBytes: number) {
  const value = request.headers.get("content-length");
  if (!value) return;
  const length = Number(value);
  if (Number.isFinite(length) && length > maxBytes) {
    throw new RequestBodyTooLargeError();
  }
}

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  assertContentLength(request, maxBytes);
  if (!request.body) return {};

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RequestBodyTooLargeError();
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text || "{}") as unknown;
}
