import { describe, expect, it, vi } from "vitest";
import { readExternalJson } from "./externalJson";

describe("bounded external JSON", () => {
  it("reads a valid response", async () => {
    await expect(readExternalJson(Response.json({ ok: true }))).resolves.toEqual({ ok: true });
  });
  it("stops a streamed response at the actual byte limit", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(20)); }, cancel }));
    await expect(readExternalJson(response, undefined, 30)).rejects.toThrow("te groot");
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("cancels a declared oversize response without consuming it", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ cancel }), { headers: { "content-length": "1000" } });
    await expect(readExternalJson(response, undefined, 30)).rejects.toThrow("te groot");
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("terminates a stalled body on cancellation", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ cancel }));
    const result = readExternalJson(response, controller.signal);
    controller.abort();
    await expect(result).rejects.toThrow("afgebroken");
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("does not echo malformed provider bodies", async () => {
    await expect(readExternalJson(new Response("synthetic-private-value"))).rejects.toThrow(/^Het externe antwoord/);
  });
});
