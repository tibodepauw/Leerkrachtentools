import { describe, expect, it } from "vitest";
import {
  feedbackRecipientEmail,
  normalizeFeedbackKind,
  normalizeFeedbackMessage,
} from "@/lib/feedback/feedback";

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
    expect(feedbackRecipientEmail()).toBe("feedback-not-configured@localhost");
  });
});
