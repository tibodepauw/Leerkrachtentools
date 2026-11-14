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
    getDatabase().prepare("DELETE FROM external_daily_usage WHERE service LIKE 'email%'").run();
    vi.stubEnv("BREVO_DAILY_EMAIL_LIMIT", "3");
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 201 })).mockRejectedValueOnce(new Error("uncertain delivery"));
    vi.stubGlobal("fetch", fetcher);
    await sendBrevoEmail(message);
    await expect(sendBrevoEmail({ ...message, to: "different@example.test" })).rejects.toThrow("uncertain delivery");
    await expect(sendBrevoEmail(message)).rejects.toThrow("e-maildagbudget");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("keeps mail for existing accounts available after general mail used its share", async () => {
    configure();
    const db = getDatabase();
    db.prepare("DELETE FROM external_daily_usage WHERE service LIKE 'email%'").run();
    db.prepare("INSERT INTO users(id, email, email_verified_at, created_at, updated_at) VALUES ('mail-budget-user', 'bestaand@example.test', 1, 1, 1)").run();
    vi.stubEnv("BREVO_DAILY_EMAIL_LIMIT", "5");
    vi.stubEnv("FEEDBACK_TO_EMAIL", "bestaand@example.test");
    const fetcher = vi.fn().mockImplementation(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    const login = (to: string) => sendBrevoEmail({ ...message, to, mailClass: "login" });

    // Four general slots: first logins for unknown addresses, unclassified mail and feedback.
    await login("nieuw-1@example.test");
    await login("nieuw-2@example.test");
    await sendBrevoEmail(message);
    await sendBrevoEmail({ ...message, to: "bestaand@example.test", mailClass: "feedback" });
    await expect(login("nieuw-3@example.test")).rejects.toThrow("e-maildagbudget");
    // A recipient with an account does not make feedback or unclassified mail privileged.
    await expect(sendBrevoEmail({ ...message, to: "bestaand@example.test", mailClass: "feedback" })).rejects.toThrow("e-maildagbudget");
    await expect(sendBrevoEmail({ ...message, to: "bestaand@example.test" })).rejects.toThrow("e-maildagbudget");
    expect(fetcher).toHaveBeenCalledTimes(4);

    // The reserved slot is found for the normalized account address, and only once.
    await expect(login("  Bestaand@Example.test ")).resolves.toBeUndefined();
    await expect(login("bestaand@example.test")).rejects.toThrow("e-maildagbudget");
    expect(fetcher).toHaveBeenCalledTimes(5);
    db.prepare("DELETE FROM users WHERE id = 'mail-budget-user'").run();
    db.prepare("DELETE FROM external_daily_usage WHERE service LIKE 'email%'").run();
  });
  it("counts a failed login mail to an existing account against the reserve", async () => {
    configure();
    const db = getDatabase();
    db.prepare("DELETE FROM external_daily_usage WHERE service LIKE 'email%'").run();
    db.prepare("INSERT INTO users(id, email, email_verified_at, created_at, updated_at) VALUES ('mail-budget-failed', 'mislukt@example.test', 1, 1, 1)").run();
    vi.stubEnv("BREVO_DAILY_EMAIL_LIMIT", "1");
    const fetcher = vi.fn().mockRejectedValue(new Error("uncertain delivery"));
    vi.stubGlobal("fetch", fetcher);
    // With a limit of one, the single mail is reserved for existing accounts.
    await expect(sendBrevoEmail(message)).rejects.toThrow("e-maildagbudget");
    await expect(sendBrevoEmail({ ...message, to: "mislukt@example.test", mailClass: "login" })).rejects.toThrow("uncertain delivery");
    await expect(sendBrevoEmail({ ...message, to: "mislukt@example.test", mailClass: "login" })).rejects.toThrow("e-maildagbudget");
    expect(fetcher).toHaveBeenCalledTimes(1);
    db.prepare("DELETE FROM users WHERE id = 'mail-budget-failed'").run();
    db.prepare("DELETE FROM external_daily_usage WHERE service LIKE 'email%'").run();
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
