import { afterEach, describe, expect, it, vi } from "vitest";
import {
  feedbackRecipientEmail,
  normalizeFeedbackKind,
  normalizeFeedbackMessage,
  normalizeFeedbackModule,
} from "@/lib/feedback/feedback";
import { sendFeedbackEmail } from "@/lib/feedback/sendFeedback";
import { ALL_MODULE_IDS } from "@/lib/auth/moduleVisibilityConfig";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("feedback", () => {
  it("normaliseert en valideert berichten", () => {
    expect(normalizeFeedbackMessage("  Dit is een testbericht.  ")).toBe(
      "Dit is een testbericht.",
    );
    expect(() => normalizeFeedbackMessage("kort")).toThrow(/10 tekens/u);
  });

  it("valt terug op feedback als type ontbreekt", () => {
    expect(normalizeFeedbackKind("idea")).toBe("idea");
    expect(normalizeFeedbackKind(undefined)).toBe("feedback");
  });

  it("gebruikt geconfigureerde ontvanger of dev fallback", () => {
    expect(feedbackRecipientEmail()).toBe("feedback-not-configured@invalid");
  });

  it("laat elke canonieke module-id ongewijzigd door", () => {
    for (const moduleId of ALL_MODULE_IDS) {
      expect(normalizeFeedbackModule(moduleId)).toBe(moduleId);
    }
  });

  it.each([
    "curriculum-rag\nVan: directie@school.test",
    "curriculum-rag\r\nBcc: iemand@example.test",
    "curriculum-rag ",
    " curriculum-rag",
    "Curriculum-RAG",
    "settings",
    "curriculum",
    "",
    undefined,
    null,
    42,
    true,
    ["curriculum-rag"],
    { toString: () => "curriculum-rag" },
  ])("maakt een onbekende of verkeerd getypeerde module onbekend: %j", (value) => {
    expect(normalizeFeedbackModule(value)).toBe("onbekend");
  });

  async function sentFeedback(activeModule: unknown) {
    vi.stubEnv("BREVO_API_KEY", "synthetic-not-a-real-key");
    vi.stubEnv("BREVO_FROM_EMAIL", "Audit <audit@example.test>");
    const fetcher = vi.fn().mockImplementation(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    await sendFeedbackEmail({
      fromEmail: "leerkracht@example.test",
      message: "Dit is een synthetisch testbericht.",
      activeModule,
      anonymous: true,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    return JSON.parse(fetcher.mock.calls[0][1].body as string) as { textContent: string; htmlContent: string };
  }

  it("neemt geen geïnjecteerde metadataregels op in de feedbackmail", async () => {
    const mail = await sentFeedback("minimum-goals\nVan: directie@school.test\n\nVervalste inhoud");
    expect(mail.textContent.split("\n").slice(0, 5)).toEqual([
      "Nieuwe feedback via Leerkrachtentools",
      "",
      "Van: Anoniem",
      "Actieve module: onbekend",
      "",
    ]);
    expect(mail.textContent).not.toContain("directie@school.test");
    expect(mail.htmlContent).not.toContain("directie@school.test");
    expect(mail.textContent.match(/^Van: /gmu)).toHaveLength(1);
  });

  it("vermeldt een geldige module en verwerkt een niet-tekstwaarde zonder fout", async () => {
    expect((await sentFeedback("minimum-goals")).textContent).toContain("\nActieve module: minimum-goals\n");
    vi.unstubAllGlobals();
    expect((await sentFeedback({ trim: "geen functie" })).textContent).toContain("\nActieve module: onbekend\n");
  });
});
