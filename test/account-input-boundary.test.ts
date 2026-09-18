import { describe, expect, it, vi } from "vitest";
import { PATCH as profile } from "@/app/api/account/profile/route";
import { PATCH as consent } from "@/app/api/account/marketing-consent/route";
import { PATCH as keys } from "@/app/api/account/api-keys/route";
import { PUT as pins } from "@/app/api/account/pinned-modules/route";
import { POST as models } from "@/app/api/account/list-models/route";

vi.mock("@/lib/auth/guard", () => ({
  sessionFromRequest: () => ({ id: "synthetic-input-probe" }),
  unauthorizedResponse: () => Response.json({}, { status: 401 }),
}));

describe("account input boundary", () => {
  for (const [name, handler, method, badField] of [
    ["profile", profile, "PATCH", { displayName: 42 }],
    ["consent", consent, "PATCH", { marketingOptIn: "false" }],
    ["keys", keys, "PATCH", { enabled: "false" }],
    ["pins", pins, "PUT", { pinnedModules: "spellcheck" }],
    ["models", models, "POST", { provider: 42 }],
  ] as const) {
    it(`${name} rejects malformed JSON, non-objects and wrong field types`, async () => {
      for (const body of ["{", "null", "[]", "42", JSON.stringify(badField)]) {
        const response = await handler(new Request(`http://localhost/api/account/${name}`, { method, body }));
        expect(response.status, body).toBe(400);
        expect(response.headers.get("cache-control")).toBe("no-store");
      }
    });
    it(`${name} rejects oversize input before accessing account data`, async () => {
      const response = await handler(new Request(`http://localhost/api/account/${name}`, { method, body: " ".repeat(17000) }));
      expect(response.status).toBe(413);
    });
  }
});
