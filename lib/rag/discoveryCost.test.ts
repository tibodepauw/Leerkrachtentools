import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@google-cloud/discoveryengine/build/src/v1/search_service_client", () => ({
  SearchServiceClient: class {
    search = mocks.search;
    projectLocationCollectionDataStoreServingConfigPath() { return "synthetic-config"; }
  },
}));
import { searchDiscoveryEngine } from "./discoveryEngine";
afterEach(() => { vi.unstubAllEnvs(); mocks.search.mockReset(); });
function configure(limit: string) {
  for (const name of ["GOOGLE_PROJECT_ID", "GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_DATA_STORE_ID"]) vi.stubEnv(name, "synthetic");
  vi.stubEnv("DISCOVERY_DAILY_CALL_LIMIT", limit);
}

it("bounds distinct upstream searches while cached and coalesced calls remain free", async () => {
  configure("1");
  mocks.search.mockResolvedValue([[], null, {}]);
  const results = await Promise.all([searchDiscoveryEngine({ query: "same" }), searchDiscoveryEngine({ query: "same" })]);
  expect(results[0].failed).not.toBe(true);
  await searchDiscoveryEngine({ query: "same" });
  expect((await searchDiscoveryEngine({ query: "different" })).failed).toBe(true);
  expect(mocks.search).toHaveBeenCalledTimes(1);
  expect(mocks.search.mock.calls[0][0].contentSearchSpec.summarySpec).toBeUndefined();
  expect(mocks.search.mock.calls[0][1]).toMatchObject({ autoPaginate: false, retry: null, timeout: 6000 });
});

it("does not call the provider when explicitly disabled", async () => {
  configure("0");
  expect((await searchDiscoveryEngine({ query: "disabled" })).failed).toBe(true);
  expect(mocks.search).not.toHaveBeenCalled();
});
