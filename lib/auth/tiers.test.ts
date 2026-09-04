import { afterEach, describe, expect, it, vi } from "vitest";
import { hasAppAccess, resolveTierFromEmail } from "@/lib/auth/tiers";

describe("resolveTierFromEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("kent admin toe via ADMIN_EMAILS allowlist", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com, owner@example.com");

    expect(resolveTierFromEmail("admin@example.com")).toBe("admin");
    expect(resolveTierFromEmail("owner@example.com")).toBe("admin");
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

  it("geeft lokale testers alleen buiten productie toegang", () => {
    expect(resolveTierFromEmail("wxdsfq@zear.cez")).toBe("tester");
    expect(resolveTierFromEmail("WXDSFQ@ZEAR.CEZ")).toBe("tester");
    expect(hasAppAccess("wxdsfq@zear.cez")).toBe(true);
    expect(hasAppAccess("iemand@gmail.com")).toBe(false);

    vi.stubEnv("NODE_ENV", "production");
    expect(resolveTierFromEmail("wxdsfq@zear.cez")).toBe("unapproved");
  });
});
