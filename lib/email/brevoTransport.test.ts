import { afterEach, describe, expect, it, vi } from "vitest";
import { sendBrevoEmail } from "./brevo";
import { getDatabase } from "@/lib/db/sqlite";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const message = { to: "fixture@example.test", subject: "Synthetic", text: "Fixture", html: "<p>Fixture</p>" };
function configure() {
  vi.stubEnv("BREVO_API_KEY", "synthetic-not-a-real-key");
  vi.stubEnv("BREVO_FROM_EMAIL", "Audit <audit@example.test>");
}
describe("Brevo transport without real mail", () => {
  it("counts accepted and failed attempts together and blocks before the next send", async () => {
    configure();
    getDatabase().prepare("DELETE FROM external_daily_usage WHERE service = 'email'").run();
    vi.stubEnv("BREVO_DAILY_EMAIL_LIMIT", "2");
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 201 })).mockRejectedValueOnce(new Error("uncertain delivery"));
    vi.stubGlobal("fetch", fetcher);
    await sendBrevoEmail(message);
    await expect(sendBrevoEmail({ ...message, to: "different@example.test" })).rejects.toThrow("uncertain delivery");
    await expect(sendBrevoEmail(message)).rejects.toThrow("e-maildagbudget");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("can disable all outgoing mail independently of configured credentials", async () => {
    configure();
    vi.stubEnv("BREVO_DAILY_EMAIL_LIMIT", "0");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(sendBrevoEmail(message)).rejects.toThrow("e-maildagbudget");
    expect(fetcher).not.toHaveBeenCalled();
  });
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
