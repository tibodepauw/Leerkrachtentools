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

function abortError(signal?: AbortSignal) {
  if (signal?.aborted) {
    const reason = signal.reason;
    if (reason instanceof RequestBodyTimeoutError) return reason;
    if (reason instanceof Error) return reason;
    return new RequestBodyTimeoutError();
  }
  return new RequestBodyTimeoutError();
}

async function cancelReaderSoon(reader: ReadableStreamDefaultReader<Uint8Array>) {
  try {
    await Promise.race([
      reader.cancel().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 25)),
    ]);
  } catch {
    // The pending read may already be settled.
  }
}

export async function readBodyBuffer(
  request: Request,
  maxBytes: number,
  timeoutMs = 15_000,
  signal: AbortSignal | undefined = request.signal,
): Promise<ArrayBuffer> {
  assertContentLength(request, maxBytes);
  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  let total = 0;
  const chunks: Uint8Array[] = [];
  const deadline = Date.now() + timeoutMs;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortReject: ((error: Error) => void) | undefined;

  const throwIfDeadlinePassed = () => {
    if (signal?.aborted || Date.now() > deadline) {
      throw abortError(signal);
    }
  };

  const onAbort = () => {
    abortReject?.(abortError(signal));
  };
  const disconnect = signal
    ? new Promise<never>((_, reject) => {
        abortReject = reject;
      })
    : null;

  try {
    if (signal) {
      if (signal.aborted) throw abortError(signal);
      signal.addEventListener("abort", onAbort);
    }

    while (true) {
      throwIfDeadlinePassed();
      const remaining = Math.max(1, deadline - Date.now());
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new RequestBodyTimeoutError());
        }, remaining);
      });

      let done = false;
      let value: Uint8Array | undefined;
      try {
        const raced = (await Promise.race([
          reader.read(),
          timeout,
          ...(disconnect ? [disconnect] : []),
        ])) as ReadableStreamReadResult<Uint8Array>;
        done = raced.done;
        value = raced.value;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      }

      if (done) {
        throwIfDeadlinePassed();
        break;
      }
      total += value?.byteLength ?? 0;
      if (total > maxBytes) {
        throw new RequestBodyTooLargeError();
      }
      if (value) chunks.push(value);
    }
  } catch (error) {
    await cancelReaderSoon(reader);
    if (error instanceof RequestBodyTooLargeError) throw error;
    if (error instanceof RequestBodyTimeoutError) throw error;
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new RequestBodyTimeoutError();
    }
    throw error;
  } finally {
    abortReject = undefined;
    if (timeoutId) clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onAbort);
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
      await cancelReaderSoon(reader);
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
  timeoutMs?: number,
): Promise<unknown> {
  const body = await readBodyBuffer(request, maxBytes, timeoutMs);
  const text = new TextDecoder().decode(body);
  return JSON.parse(text || "{}") as unknown;
}
