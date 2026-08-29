import { describe, expect, it } from "vitest";
import { readCookieValue, safeDecodeURIComponent } from "@/lib/auth/cookies";

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
