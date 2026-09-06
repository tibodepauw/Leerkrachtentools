import { describe, expect, it } from "vitest";
import {
  defaultModelForProvider,
  isUsableChatModelId,
  pickPreferredModelId,
} from "@/lib/ai/usableModels";

describe("usableModels", () => {
  it("houdt chatmodellen en weert embedding/audio/guard", () => {
    expect(isUsableChatModelId("google", "gemini-3.5-flash-lite")).toBe(true);
    expect(isUsableChatModelId("google", "gemini-embedding-001")).toBe(false);
    expect(isUsableChatModelId("groq", "llama-3.3-70b-versatile")).toBe(true);
    expect(isUsableChatModelId("groq", "whisper-large-v3")).toBe(false);
    expect(isUsableChatModelId("groq", "llama-guard-3-8b")).toBe(false);
  });

  it("houdt het huidige model als het nog in de lijst staat", () => {
    expect(
      pickPreferredModelId(
        [{ id: "gemini-2.5-flash" }, { id: "gemini-3.5-flash-lite" }],
        "gemini-2.5-flash",
        "gemini-3.5-flash-lite",
      ),
    ).toBe("gemini-2.5-flash");
  });

  it("kiest de provider-fallback of flash-lite als het huidige model ontbreekt", () => {
    expect(
      pickPreferredModelId(
        [{ id: "gemini-2.5-pro" }, { id: "gemini-3.5-flash-lite" }],
        "gemini-embedding-001",
        "gemini-3.5-flash-lite",
      ),
    ).toBe("gemini-3.5-flash-lite");
    expect(defaultModelForProvider("google")).toBe("gemini-3.5-flash-lite");
  });
});
