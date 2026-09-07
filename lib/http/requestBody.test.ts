import { describe, expect, it } from "vitest";
import {
  readBodyBuffer,
  readJsonBody,
  RequestBodyTooLargeError,
} from "@/lib/http/requestBody";
import { absoluteAppUrl } from "@/lib/http/appUrl";

describe("begrensde request bodies", () => {
  it("leest JSON binnen de limiet", async () => {
    const request = new Request(absoluteAppUrl("/api"), {
      method: "POST",
      body: JSON.stringify({ value: "ok" }),
    });

    await expect(readJsonBody(request, 100)).resolves.toEqual({ value: "ok" });
  });

  it("weigert bodies boven de limiet zonder Content-Length", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"value":"'));
        controller.enqueue(new TextEncoder().encode("x".repeat(100)));
        controller.enqueue(new TextEncoder().encode('"}'));
        controller.close();
      },
    });
    const request = new Request(absoluteAppUrl("/api"), {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readJsonBody(request, 50)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  it("begrensd ook binaire request bodies zonder Content-Length", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(40));
        controller.enqueue(new Uint8Array(40));
        controller.close();
      },
    });
    const request = new Request(absoluteAppUrl("/upload"), {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readBodyBuffer(request, 64)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });
});
