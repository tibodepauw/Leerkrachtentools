import { describe, expect, it } from "vitest";
import { buildVerificationEmail } from "@/lib/email/verificationEmail";

describe("verificatie-e-mail", () => {
  const message = buildVerificationEmail("482915");

  it("houdt de platte tekst overzichtelijk", () => {
    expect(message.subject).toBe("482915 is je eenmalige toegangscode");
    expect(message.text).toBe(
      [
        "Leerkrachtentools",
        "Eenmalige toegangscode",
        "",
        "Je verificatiecode is 482915.",
        "",
        "Voer deze code in op het inlogscherm. De code is 10 minuten geldig.",
        "",
        "Heb je dit niet aangevraagd? Dan kun je deze mail veilig negeren.",
      ].join("\n"),
    );
  });

  it("gebruikt de huisstijlkleuren en inline e-mailmarkup", () => {
    expect(message.html).toContain("color-scheme");
    expect(message.html).toContain("#000000");
    expect(message.html).toContain("#0e0e11");
    expect(message.html).toContain("#f4f4f5");
    expect(message.html).toContain("#8e8e93");
    expect(message.html).toContain("Rubik, Arial, Helvetica, sans-serif");
    expect(message.html).not.toMatch(/<link[^>]+stylesheet/i);
    expect(message.html).not.toMatch(/https?:\/\/(?!www\.w3\.org\/)/);
  });

  it("toont de code, geldigheid en geruststellende footer", () => {
    expect(message.html).toContain("Eenmalige toegangscode");
    expect(message.html).toContain("Leerkrachtentools");
    expect(message.html).toContain("10 minuten");
    expect(message.html).toContain(
      "Heb je dit niet aangevraagd? Dan kun je deze mail veilig negeren.",
    );
    for (const digit of "482915") {
      expect(message.html).toContain(`>${digit}</span>`);
    }
  });

  it("escapes onverwachte tekens in de code", () => {
    const unsafe = buildVerificationEmail("<img src=x>");
    expect(unsafe.html).not.toContain("<img");
    expect(unsafe.html).toContain("&lt;");
    expect(unsafe.html).toContain("&gt;");
  });
});
