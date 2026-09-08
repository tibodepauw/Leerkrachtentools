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
});
