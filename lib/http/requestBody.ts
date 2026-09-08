export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("De aanvraag is te groot.");
    this.name = "RequestBodyTooLargeError";
  }
}

export class RequestBodyTimeoutError extends Error {
  constructor() {
    super("Het inlezen van de aanvraag duurde te lang.");
    this.name = "RequestBodyTimeoutError";
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

export function concatUint8(chunks: Uint8Array[], total: number) {
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readBodyBuffer(
  request: Request,
  maxBytes: number,
  timeoutMs = 15_000,
): Promise<ArrayBuffer> {
  assertContentLength(request, maxBytes);
  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  let total = 0;
  const chunks: Uint8Array[] = [];
  const deadline = Date.now() + timeoutMs;

  while (true) {
    if (Date.now() > deadline) {
      await reader.cancel();
      throw new RequestBodyTimeoutError();
    }
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }

  return concatUint8(chunks, total).buffer;
}

export async function readBoundedFormData(
  request: Request,
  maxBytes: number,
): Promise<FormData> {
  const rawBody = await readBodyBuffer(request, maxBytes);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  return new Request(request.url, {
    method: request.method,
    headers,
    body: rawBody,
  }).formData();
}

export async function readResponseTextBounded(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) return { text: "", truncated: false };

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { text: "", truncated: true };
    }
    chunks.push(value);
  }
  return {
    text: new TextDecoder().decode(concatUint8(chunks, total)),
    truncated: false,
  };
}

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const body = await readBodyBuffer(request, maxBytes);
  const text = new TextDecoder().decode(body);
  return JSON.parse(text || "{}") as unknown;
}
