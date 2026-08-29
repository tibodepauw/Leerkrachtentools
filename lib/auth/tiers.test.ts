import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTierFromEmail } from "@/lib/auth/tiers";

describe("resolveTierFromEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("kent admin toe aan het vaste beheerdersadres", () => {
    expect(resolveTierFromEmail("r1058655@student.thomasmore.be")).toBe("admin");
  });

  it("kent student toe aan Thomas More adressen", () => {
    expect(resolveTierFromEmail("jan.janssens@student.thomasmore.be")).toBe(
      "student",
    );
    expect(resolveTierFromEmail("docent@thomasmore.be")).toBe("student");
  });

  it("kent tester en partner toe via allowlists", () => {
    vi.stubEnv("TESTER_EMAILS", "tester@example.com");
    vi.stubEnv("PARTNER_EMAILS", "partner@example.com");

    expect(resolveTierFromEmail("tester@example.com")).toBe("tester");
    expect(resolveTierFromEmail("partner@example.com")).toBe("partner");
  });

  it("geeft Thomas More student voorrang boven tester allowlist", () => {
    vi.stubEnv("TESTER_EMAILS", "jan.janssens@student.thomasmore.be");

    expect(resolveTierFromEmail("jan.janssens@student.thomasmore.be")).toBe(
      "student",
    );
  });

  it("markeert onbekende adressen als unapproved", () => {
    expect(resolveTierFromEmail("iemand@gmail.com")).toBe("unapproved");
  });
});
