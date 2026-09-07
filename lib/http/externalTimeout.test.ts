import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  EXTERNAL_API_TIMEOUT_MS,
  externalApiAbortSignal,
} from "@/lib/http/externalTimeout";

describe("external API timeouts", () => {
  it("gebruikt 12 seconden voor externe fetch-abort", () => {
    expect(EXTERNAL_API_TIMEOUT_MS).toBe(12_000);
    expect(externalApiAbortSignal()).toBeInstanceOf(AbortSignal);
  });

  it("zet Groq, Cerebras en Discovery Engine op die abort", () => {
    const listModels = readFileSync("lib/ai/listModels.ts", "utf8");
    const router = readFileSync("lib/ai/router.ts", "utf8");
    const discovery = readFileSync("lib/rag/discoveryEngine.ts", "utf8");
    const brevo = readFileSync("lib/email/brevo.ts", "utf8");
    expect(listModels).toContain("externalApiAbortSignal()");
    expect(listModels).toContain("https://api.groq.com");
    expect(listModels).toContain("https://api.cerebras.ai");
    expect(router).toContain("EXTERNAL_API_TIMEOUT_MS");
    expect(discovery).toContain("AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS)");
    expect(brevo).toContain("externalApiAbortSignal()");
  });
});
