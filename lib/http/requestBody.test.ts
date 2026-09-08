import { describe, expect, it } from "vitest";
import {
  readBodyBuffer,
  readJsonBody,
  RequestBodyTimeoutError,
  RequestBodyTooLargeError,
} from "@/lib/http/requestBody";
import { absoluteAppUrl } from "@/lib/http/appUrl";

function streamRequest(start: (controller: ReadableStreamDefaultController<Uint8Array>) => void) {
  const body = new ReadableStream<Uint8Array>({ start });
  return new Request(absoluteAppUrl("/api"), {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

function trackAbortListeners(signal: AbortSignal) {
  const live = new Set<EventListenerOrEventListenerObject>();
  let peak = 0;
  const add = signal.addEventListener.bind(signal);
  const remove = signal.removeEventListener.bind(signal);
  signal.addEventListener = ((type, listener, options) => {
    if (type === "abort" && listener) {
      live.add(listener);
      peak = Math.max(peak, live.size);
    }
    return add(type, listener, options);
  }) as AbortSignal["addEventListener"];
  signal.removeEventListener = ((type, listener, options) => {
    if (type === "abort" && listener) live.delete(listener);
    return remove(type, listener, options);
  }) as AbortSignal["removeEventListener"];
  return {
    live: () => live.size,
    peak: () => peak,
  };
}

function streamRequestWithSignal(
  start: (controller: ReadableStreamDefaultController<Uint8Array>) => void,
  signal: AbortSignal,
) {
  const body = new ReadableStream<Uint8Array>({ start });
  return new Request(absoluteAppUrl("/api"), {
    method: "POST",
    body,
    signal,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("begrensde request bodies", () => {
  it("leest JSON binnen de limiet", async () => {
    const request = new Request(absoluteAppUrl("/api"), {
      method: "POST",
      body: JSON.stringify({ value: "ok" }),
    });

    await expect(readJsonBody(request, 100)).resolves.toEqual({ value: "ok" });
  });

  it("weigert bodies boven de limiet zonder Content-Length", async () => {
    const request = streamRequest((controller) => {
      controller.enqueue(new TextEncoder().encode('{"value":"'));
      controller.enqueue(new TextEncoder().encode("x".repeat(100)));
      controller.enqueue(new TextEncoder().encode('"}'));
      controller.close();
    });

    await expect(readJsonBody(request, 50)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  it("begrensd ook binaire request bodies zonder Content-Length", async () => {
    const request = streamRequest((controller) => {
      controller.enqueue(new Uint8Array(40));
      controller.enqueue(new Uint8Array(40));
      controller.close();
    });

    await expect(readBodyBuffer(request, 64)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  it("PR1-01 stopt een hangende read binnen de deadline", async () => {
    const request = streamRequest((controller) => {
      controller.enqueue(new TextEncoder().encode("{}"));
    });
    const started = Date.now();
    await expect(readBodyBuffer(request, 1_000, 80)).rejects.toBeInstanceOf(
      RequestBodyTimeoutError,
    );
    expect(Date.now() - started).toBeLessThan(1_500);
  });

  it("PR1-01 weigert een late EOF na de deadline", async () => {
    const request = streamRequest((controller) => {
      controller.enqueue(new TextEncoder().encode("{}"));
      setTimeout(() => controller.close(), 200);
    });
    await expect(readBodyBuffer(request, 1_000, 80)).rejects.toBeInstanceOf(
      RequestBodyTimeoutError,
    );
  });

  it("PR1-01 stopt bij client-abort tijdens een pending read", async () => {
    const abort = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{}"));
      },
    });
    const request = new Request(absoluteAppUrl("/api"), {
      method: "POST",
      body,
      signal: abort.signal,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const pending = readBodyBuffer(request, 1_000, 5_000, abort.signal);
    setTimeout(() => abort.abort(), 30);
    await expect(pending).rejects.toBeInstanceOf(RequestBodyTimeoutError);
  });

  it("stapelt geen abort-listeners bij veel kleine chunks tot EOF", async () => {
    const abort = new AbortController();
    const tracked = trackAbortListeners(abort.signal);
    const request = streamRequestWithSignal((controller) => {
      for (let index = 0; index < 8; index += 1) {
        controller.enqueue(new Uint8Array([index]));
      }
      controller.close();
    }, abort.signal);

    await expect(readBodyBuffer(request, 1_000, 5_000, abort.signal)).resolves.toBeInstanceOf(
      ArrayBuffer,
    );
    expect(tracked.peak()).toBeLessThanOrEqual(1);
    expect(tracked.live()).toBe(0);
  });

  it("ruimt abort-listeners op bij oversize, timeout en client-abort", async () => {
    const oversizeAbort = new AbortController();
    const oversizeTracked = trackAbortListeners(oversizeAbort.signal);
    const oversize = streamRequestWithSignal((controller) => {
      controller.enqueue(new Uint8Array(40));
      controller.enqueue(new Uint8Array(40));
      controller.close();
    }, oversizeAbort.signal);
    await expect(
      readBodyBuffer(oversize, 64, 5_000, oversizeAbort.signal),
    ).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(oversizeTracked.peak()).toBeLessThanOrEqual(1);
    expect(oversizeTracked.live()).toBe(0);

    const timeoutAbort = new AbortController();
    const timeoutTracked = trackAbortListeners(timeoutAbort.signal);
    const hanging = streamRequestWithSignal((controller) => {
      controller.enqueue(new TextEncoder().encode("{}"));
    }, timeoutAbort.signal);
    await expect(
      readBodyBuffer(hanging, 1_000, 80, timeoutAbort.signal),
    ).rejects.toBeInstanceOf(RequestBodyTimeoutError);
    expect(timeoutTracked.peak()).toBeLessThanOrEqual(1);
    expect(timeoutTracked.live()).toBe(0);

    const clientAbort = new AbortController();
    const clientTracked = trackAbortListeners(clientAbort.signal);
    const pendingRequest = streamRequestWithSignal((controller) => {
      controller.enqueue(new TextEncoder().encode("{}"));
    }, clientAbort.signal);
    const pending = readBodyBuffer(pendingRequest, 1_000, 5_000, clientAbort.signal);
    setTimeout(() => clientAbort.abort(), 30);
    await expect(pending).rejects.toBeInstanceOf(RequestBodyTimeoutError);
    expect(clientTracked.peak()).toBeLessThanOrEqual(1);
    expect(clientTracked.live()).toBe(0);
  });

  it("ruimt abort-listeners op als de annulering zelf nooit afvuurt", async () => {
    const abort = new AbortController();
    const tracked = trackAbortListeners(abort.signal);
    const request = streamRequestWithSignal((controller) => {
      controller.enqueue(new TextEncoder().encode('{"ok":true}'));
      controller.close();
    }, abort.signal);

    await expect(
      readBodyBuffer(request, 100, 5_000, abort.signal),
    ).resolves.toBeInstanceOf(ArrayBuffer);
    expect(abort.signal.aborted).toBe(false);
    expect(tracked.peak()).toBeLessThanOrEqual(1);
    expect(tracked.live()).toBe(0);
  });
});
