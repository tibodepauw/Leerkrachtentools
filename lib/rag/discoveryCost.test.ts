import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@google-cloud/discoveryengine/build/src/v1/search_service_client", () => ({
  SearchServiceClient: class {
    search = mocks.search;
    projectLocationCollectionDataStoreServingConfigPath() { return "synthetic-config"; }
  },
}));
import { searchDiscoveryEngine } from "./discoveryEngine";
import { getDatabase } from "@/lib/db/sqlite";
afterEach(() => { vi.unstubAllEnvs(); mocks.search.mockReset(); });
const budgetSubject = "a".repeat(64);
const otherSubject = "b".repeat(64);
function configure(limit: string) {
  for (const name of ["GOOGLE_PROJECT_ID", "GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_DATA_STORE_ID"]) vi.stubEnv(name, "synthetic");
  vi.stubEnv("DISCOVERY_DAILY_CALL_LIMIT", limit);
}

it("bounds distinct upstream searches while cached and coalesced calls remain free", async () => {
  configure("1");
  mocks.search.mockResolvedValue([[], null, {}]);
  const results = await Promise.all([searchDiscoveryEngine({ query: "same", budgetSubject }), searchDiscoveryEngine({ query: "same", budgetSubject })]);
  expect(results[0].failed).not.toBe(true);
  await searchDiscoveryEngine({ query: "same", budgetSubject });
  expect((await searchDiscoveryEngine({ query: "different", budgetSubject })).failed).toBe(true);
  expect(mocks.search).toHaveBeenCalledTimes(1);
  expect(mocks.search.mock.calls[0][0].contentSearchSpec.summarySpec).toBeUndefined();
  expect(mocks.search.mock.calls[0][1]).toMatchObject({ autoPaginate: false, retry: null, timeout: 6000 });
});

it("does not call the provider when explicitly disabled", async () => {
  configure("0");
  expect((await searchDiscoveryEngine({ query: "disabled", budgetSubject })).failed).toBe(true);
  expect(mocks.search).not.toHaveBeenCalled();
});

it("stops one user at the per-user ceiling without blocking another user or cached results", async () => {
  configure("50");
  vi.stubEnv("DISCOVERY_USER_DAILY_CALL_LIMIT", "2");
  getDatabase().prepare("DELETE FROM external_daily_usage").run();
  mocks.search.mockResolvedValue([[], null, {}]);
  expect((await searchDiscoveryEngine({ query: "per-user one", budgetSubject })).failed).not.toBe(true);
  expect((await searchDiscoveryEngine({ query: "per-user two", budgetSubject })).failed).not.toBe(true);
  expect((await searchDiscoveryEngine({ query: "per-user three", budgetSubject })).failed).toBe(true);
  expect(mocks.search).toHaveBeenCalledTimes(2);

  // Results already fetched stay free for the user who reached the ceiling.
  expect((await searchDiscoveryEngine({ query: "per-user one", budgetSubject })).failed).not.toBe(true);
  expect(mocks.search).toHaveBeenCalledTimes(2);

  // An independent user still reaches the provider, and their cached query costs nobody anything.
  expect((await searchDiscoveryEngine({ query: "per-user three", budgetSubject: otherSubject })).failed).not.toBe(true);
  expect(mocks.search).toHaveBeenCalledTimes(3);
  expect((await searchDiscoveryEngine({ query: "per-user three", budgetSubject })).failed).not.toBe(true);
  expect(mocks.search).toHaveBeenCalledTimes(3);
  expect(getDatabase().prepare("SELECT service, consumed FROM external_daily_usage ORDER BY service").all()).toEqual([
    { service: "discovery", consumed: 3 },
    { service: `discovery-subject:${budgetSubject}`, consumed: 2 },
    { service: `discovery-subject:${otherSubject}`, consumed: 1 },
  ]);
});

it("counts a failed provider call against the user", async () => {
  configure("50");
  vi.stubEnv("DISCOVERY_USER_DAILY_CALL_LIMIT", "1");
  getDatabase().prepare("DELETE FROM external_daily_usage").run();
  mocks.search.mockRejectedValue(new Error("synthetic provider failure"));
  expect((await searchDiscoveryEngine({ query: "failing search", budgetSubject })).failed).toBe(true);
  expect((await searchDiscoveryEngine({ query: "failing search again", budgetSubject })).failed).toBe(true);
  expect(mocks.search).toHaveBeenCalledTimes(1);
});

it.each([undefined, "", "user-id"])("makes no outbound search without a valid identity: %j", async (subject) => {
  configure("50");
  mocks.search.mockResolvedValue([[], null, {}]);
  const response = await searchDiscoveryEngine({ query: `identity ${String(subject)}`, budgetSubject: subject as string });
  expect(response.failed).toBe(true);
  expect(mocks.search).not.toHaveBeenCalled();
});
