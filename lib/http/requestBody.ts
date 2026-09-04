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

export async function readBodyBuffer(
  request: Request,
  maxBytes: number,
): Promise<ArrayBuffer> {
  assertContentLength(request, maxBytes);
  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  let total = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const body = await readBodyBuffer(request, maxBytes);
  const text = new TextDecoder().decode(body);
  return JSON.parse(text || "{}") as unknown;
}
