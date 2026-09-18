import { randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { createOrganization } from "@/lib/api-keys";
import { reserveOrgAiBudget } from "./orgBudget";
afterEach(() => vi.unstubAllEnvs());
it("shares an organization budget, keeps global limits and opens a new UTC day", () => {
  vi.stubEnv("ORG_AI_DAILY_LIMIT", "2");
  vi.stubEnv("ORG_AI_GLOBAL_DAILY_LIMIT", "3");
  const make = () => createOrganization({ name: "AI budget test", email: `${randomUUID()}@example.test`, tier: "enterprise", quota: 1000 }).id;
  const org = make(); const other = make();
  // A unique far-future day isolates this from concurrent fixture requests.
  const now = Date.UTC(2040, 0, 1) + Math.floor(Math.random() * 10000) * 86_400_000;
  expect(reserveOrgAiBudget(org, now)).toBe(true);
  expect(reserveOrgAiBudget(org, now)).toBe(true);
  expect(reserveOrgAiBudget(org, now)).toBe(false);
  expect(reserveOrgAiBudget(other, now)).toBe(true);
  expect(reserveOrgAiBudget(other, now)).toBe(false);
  expect(reserveOrgAiBudget(org, now + 86_400_000)).toBe(true);
  expect(reserveOrgAiBudget("nonexistent", now)).toBe(false);
  vi.stubEnv("ORG_AI_DAILY_LIMIT", "0");
  expect(reserveOrgAiBudget(org, now + 2 * 86_400_000)).toBe(false);
});
