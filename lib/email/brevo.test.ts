import { describe, expect, it } from "vitest";
import { parseSenderAddress } from "@/lib/email/sender";

describe("Brevo afzender", () => {
  it("parseert naam + e-mail", () => {
    expect(parseSenderAddress("Leerkrachtentools <login@school.be>")).toEqual({
      name: "Leerkrachtentools",
      email: "login@school.be",
    });
  });

  it("valt terug op standaardnaam bij enkel e-mailadres", () => {
    expect(parseSenderAddress("login@school.be")).toEqual({
      name: "Leerkrachtentools",
      email: "login@school.be",
    });
  });
});
