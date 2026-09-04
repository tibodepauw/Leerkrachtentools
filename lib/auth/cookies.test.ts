import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSessionCookieOptions,
  readCookieValue,
  safeDecodeURIComponent,
} from "@/lib/auth/cookies";

describe("cookie parsing", () => {
  it("decodeert geldige cookie-waarden", () => {
    expect(safeDecodeURIComponent("abc%20123")).toBe("abc 123");
    expect(readCookieValue("session=abc%20123; other=1", "session")).toBe(
      "abc 123",
    );
  });

  it("behandelt misvormde cookie-waarden als afwezig", () => {
    expect(safeDecodeURIComponent("%")).toBeUndefined();
    expect(readCookieValue("session=%; other=1", "session")).toBeUndefined();
  });
});

describe("centrale sessiecookie-opties", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maakt een __Host-compatibele productiecookie", () => {
    vi.stubEnv("NODE_ENV", "production");
    const expires = new Date("2030-01-01T00:00:00.000Z");

    expect(getSessionCookieOptions({ expires })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      expires,
    });
    expect(getSessionCookieOptions({ expires })).not.toHaveProperty("domain");
  });

  it("gebruikt dezelfde attributen bij het verwijderen van de cookie", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(getSessionCookieOptions({ maxAge: 0 })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  });
});
