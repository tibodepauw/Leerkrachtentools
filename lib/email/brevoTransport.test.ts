import { afterEach, describe, expect, it, vi } from "vitest";
import { sendBrevoEmail } from "./brevo";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const message = { to: "fixture@example.test", subject: "Synthetic", text: "Fixture", html: "<p>Fixture</p>" };
function configure() {
  vi.stubEnv("BREVO_API_KEY", "synthetic-not-a-real-key");
  vi.stubEnv("BREVO_FROM_EMAIL", "Audit <audit@example.test>");
}
describe("Brevo transport without real mail", () => {
  it("rejects missing configuration without sending", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(sendBrevoEmail(message)).rejects.toThrow("niet geconfigureerd");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 429, 500])("cancels the %s response body and does not echo it", async status => {
    configure(); const cancel = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), { status })));
    await expect(sendBrevoEmail(message)).rejects.toThrow(`Brevo HTTP ${status}`);
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ redirect: "error", signal: expect.any(AbortSignal) });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://api.brevo.com/v3/smtp/email");
  });
  it("accepts successful delivery and does not retry network failures", async () => {
    configure(); const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 201 })).mockRejectedValueOnce(new Error("network failed"));
    vi.stubGlobal("fetch", fetcher);
    await expect(sendBrevoEmail(message)).resolves.toBeUndefined();
    await expect(sendBrevoEmail(message)).rejects.toThrow("network failed");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
