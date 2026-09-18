import { afterEach, expect, it, vi } from "vitest";
import { getDatabase } from "@/lib/auth/database";
import { runWithServerAiQuota } from "./serverAccess";
import { countRecentServerAiUsage } from "./usageLimits";
import { runStructured } from "./router";
import { z } from "zod";

const mocks = vi.hoisted(() => ({ generate: vi.fn(), available: true }));
vi.mock("ai", () => ({ generateText: mocks.generate, Output: { object: (v: unknown) => v } }));
vi.mock("./providers", () => ({
  getModelCandidates: () => mocks.available ? [{ name: "google", model: "synthetic" }] : [],
  hasCloudflare: () => false,
}));
afterEach(() => { mocks.generate.mockReset(); mocks.available = true; });

function seed(id: string) {
  getDatabase().prepare(`INSERT INTO users (id,email,tier,email_verified_at,created_at,updated_at) VALUES (?,?,'student',0,0,0)`).run(id, `${id}@example.com`);
}
const access = { allowed: true, usesServerQuota: true, limit: 40, used: 0 } as const;
const request = { schema: z.object({ ok: z.boolean() }), prompt: "synthetic", system: "test", mock: { ok: true } };

it("keeps quota when a remote failure falls back to a local result", async () => {
  seed("remote-fallback");
  mocks.generate.mockRejectedValue(new Error("provider may have billed"));
  const result = await runWithServerAiQuota(access, "remote-fallback", () => runStructured(request));
  expect(result.ok).toBe(true);
  expect(mocks.generate).toHaveBeenCalledTimes(1);
  expect(countRecentServerAiUsage("remote-fallback")).toBe(1);
});

it("releases quota for a proven local-only result", async () => {
  seed("local-only");
  mocks.available = false;
  await runWithServerAiQuota(access, "local-only", () => runStructured(request));
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(countRecentServerAiUsage("local-only")).toBe(0);
});
