import { describe, expect, it, afterEach } from "vitest";
import { DEFAULT_GOOGLE_MODEL, getGoogleModelId } from "@/lib/ai/googleModel";

describe("googleModel", () => {
  afterEach(() => {
    delete process.env.GOOGLE_MODEL;
  });

  it("gebruikt gemini-3.5-flash-lite als standaard fallback", () => {
    expect(DEFAULT_GOOGLE_MODEL).toBe("gemini-3.5-flash-lite");
    expect(getGoogleModelId()).toBe("gemini-3.5-flash-lite");
  });

  it("respecteert GOOGLE_MODEL uit de omgeving", () => {
    process.env.GOOGLE_MODEL = "gemini-3.5-pro";
    expect(getGoogleModelId()).toBe("gemini-3.5-pro");
  });
});
