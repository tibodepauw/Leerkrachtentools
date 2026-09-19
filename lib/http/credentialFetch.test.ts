import { afterEach, expect, it, vi } from "vitest";
import { credentialFetch } from "./credentialFetch";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it.each([200, 500])("rejects an oversized SDK response body (HTTP %i)", async (status) => {
  const cancel = vi.fn();
  let chunks = 0;
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({
    pull(controller) {
      chunks++;
      controller.enqueue(new Uint8Array(262_144));
      if (chunks === 12) controller.close();
    }, cancel,
  }), { status })));
  await expect(credentialFetch("https://provider.example/test").then(r => r.text())).rejects.toThrow();
  expect(cancel).toHaveBeenCalledOnce();
  expect(chunks).toBeLessThan(12);
});

it("preserves successful responses and rejects redirect forwarding", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ok: true }, { headers: { "x-request-id": "synthetic" } }));
  vi.stubGlobal("fetch", fetcher);
  const response = await credentialFetch("https://provider.example/test", { redirect: "follow" });
  expect(await response.json()).toEqual({ ok: true });
  expect(response.headers.get("x-request-id")).toBe("synthetic");
  expect(fetcher.mock.calls[0][1]?.redirect).toBe("error");
});

it("cancels a declared oversized body before reading", async () => {
  const cancel = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ cancel }), { headers: { "content-length": "99999999" } })));
  await expect(credentialFetch("https://provider.example/test")).rejects.toThrow("te groot");
  expect(cancel).toHaveBeenCalledOnce();
});

it("cancels a stalled SDK body when the request is aborted", async () => {
  const controller = new AbortController();
  const cancel = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ cancel }))));
  const result = credentialFetch(new Request("https://provider.example/test", { signal: controller.signal }));
  const rejection = expect(result).rejects.toThrow("afgebroken");
  await Promise.resolve();
  controller.abort();
  await rejection;
  expect(cancel).toHaveBeenCalledOnce();
});

it("stops a stalled body at its own deadline even without caller cancellation", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ cancel }))));
  const rejection = expect(credentialFetch("https://provider.example/test")).rejects.toThrow("afgebroken");
  await vi.advanceTimersByTimeAsync(12_050);
  await rejection;
  expect(cancel).toHaveBeenCalledOnce();
});
