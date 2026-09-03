import { describe, expect, it } from "vitest";
import { clientIpFromRequest } from "@/lib/http/requestIp";

describe("clientIpFromRequest", () => {
  it("gebruikt x-real-ip wanneer aanwezig", () => {
    const request = new Request("http://localhost/api", {
      headers: {
        "x-forwarded-for": "1.1.1.1, 10.0.0.1",
        "x-real-ip": "9.9.9.9",
      },
    });
    expect(clientIpFromRequest(request)).toBe("9.9.9.9");
  });

  it("gebruikt de laatste hop in x-forwarded-for, niet de eerste", () => {
    const request = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.8" },
    });
    expect(clientIpFromRequest(request)).toBe("10.0.0.8");
  });
});
