import { describe, expect, it } from "vitest";
import { z } from "zod";
import { publicErrorMessage } from "@/lib/http/clientError";

describe("publicErrorMessage", () => {
  it("laat eigen Nederlandstalige fouten door", () => {
    expect(publicErrorMessage(new Error("Vul een geldig e-mailadres in."), "x")).toBe(
      "Vul een geldig e-mailadres in.",
    );
  });

  it("verbergt providerfouten", () => {
    expect(
      publicErrorMessage(new Error("Brevo: invalid api-key"), "Versturen is mislukt."),
    ).toBe("Versturen is mislukt.");
    expect(
      publicErrorMessage(new Error("Google Generative AI: 429"), "De analyse is mislukt."),
    ).toBe("De analyse is mislukt.");
  });

  it("gebruikt het eerste Zod-issue", () => {
    const parsed = z.object({ n: z.number() }).safeParse({ n: "a" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(publicErrorMessage(parsed.error, "fallback")).toBe(
      parsed.error.issues[0]?.message,
    );
  });
});
