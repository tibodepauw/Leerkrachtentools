import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/extract-manual/route";
import { runStructured } from "@/lib/ai/router";
import { absoluteAppUrl } from "@/lib/http/appUrl";

vi.mock("@/lib/auth/guard", () => ({
  sessionFromRequest: () => ({
    id: "scanner-user",
    email: "admin@example.com",
    displayName: "Scanner",
    tier: "admin",
    marketingOptIn: false,
    profileImageUrl: null,
    pinnedModules: [],
    expiresAt: Date.now() + 60_000,
  }),
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
}));

vi.mock("@/lib/ai/serverAccess", () => ({
  checkServerAiAccess: () => ({ allowed: true, usesServerQuota: false }),
  runWithServerAiQuota: async (
    _access: unknown,
    _userId: string,
    run: () => Promise<unknown>,
  ) => ({ ok: true, result: await run() }),
  serverAiAccessDeniedResponse: () =>
    new Response(JSON.stringify({ error: "denied" }), { status: 403 }),
}));

vi.mock("@/lib/auth/moduleRouteGuard", () => ({
  requireModuleAccess: () => null,
}));

vi.mock("@/lib/ai/userCredentials", () => ({
  getUserAiConfig: () => null,
}));

vi.mock("@/lib/ai/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/providers")>();
  return {
    ...actual,
    hasAnyAiProvider: () => true,
  };
});

vi.mock("@/lib/ai/router", () => ({
  runStructured: vi.fn(),
}));

describe("extract-manual URL-uploads", () => {
  afterEach(() => {
    vi.mocked(runStructured).mockReset();
  });

  it("breekt de provider af wanneer de client de aanvraag afbreekt", async () => {
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    let providerAborted = false;
    vi.mocked(runStructured).mockImplementationOnce(({ abortSignal }) => new Promise((_, reject) => {
      const timeout = setTimeout(() => reject(new Error("missing cancellation")), 1000);
      abortSignal?.addEventListener("abort", () => {
        providerAborted = true;
        clearTimeout(timeout);
        reject(new Error("cancelled"));
      }, { once: true });
      started();
    }));
    const controller = new AbortController();
    const response = POST(new Request(absoluteAppUrl("/api/extract-manual"), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Een les over tellen met blokken." }), signal: controller.signal,
    }));
    await ready;
    controller.abort();
    await response;
    expect(providerAborted).toBe(true);
  });

  it("stuurt geen URL-string naar de SDK", async () => {
    const response = await POST(
      new Request(absoluteAppUrl("/api/extract-manual"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileData: "https://files.example/handleiding.pdf",
          mediaType: "application/pdf",
          fileName: "handleiding.pdf",
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(vi.mocked(runStructured)).not.toHaveBeenCalled();
  });

  it("stuurt gedecodeerde bytes voor geldige base64", async () => {
    vi.mocked(runStructured).mockResolvedValueOnce({
      data: {
        learningArea: "",
        component: "",
        topic: "",
        targetGroup: "",
        materials: [],
        rawPublisherGoals: [],
      },
      provider: "local",
      fallbackErrors: [],
    });
    const payload = Buffer.from("%PDF-1.4 test").toString("base64");
    const response = await POST(
      new Request(absoluteAppUrl("/api/extract-manual"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileData: payload,
          mediaType: "application/pdf",
          fileName: "handleiding.pdf",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(vi.mocked(runStructured)).toHaveBeenCalled();
    const file = vi.mocked(runStructured).mock.calls[0]?.[0]?.file;
    expect(file?.data).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(file?.data as Uint8Array).toString("utf8")).toContain("%PDF-1.4");
  });
});
