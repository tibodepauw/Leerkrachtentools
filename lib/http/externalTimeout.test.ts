import { describe, expect, it } from "vitest";
import {
  EXTERNAL_API_TIMEOUT_MS,
  externalApiAbortSignal,
} from "@/lib/http/externalTimeout";

describe("external API timeouts", () => {
  it("gebruikt 12 seconden voor externe fetch-abort", () => {
    expect(EXTERNAL_API_TIMEOUT_MS).toBe(12_000);
    expect(externalApiAbortSignal()).toBeInstanceOf(AbortSignal);
  });

  it("propagates caller cancellation immediately with its reason", () => {
    const caller = new AbortController();
    const combined = externalApiAbortSignal(caller.signal);
    expect(combined.aborted).toBe(false);
    const reason = new Error("synthetic disconnect");
    caller.abort(reason);
    expect(combined.aborted).toBe(true);
    expect(combined.reason).toBe(reason);
  });
});
