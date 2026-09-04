import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock(
  "@google-cloud/discoveryengine/build/src/v1/search_service_client",
  () => {
    class FakeClient {
      id = Math.random();
    }
    return { SearchServiceClient: FakeClient };
  },
);

describe("Discovery SearchServiceClient singleton", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hergebruikt dezelfde client via globalThis", async () => {
    vi.stubEnv("GOOGLE_CLIENT_EMAIL", "svc@example.com");
    vi.stubEnv(
      "GOOGLE_PRIVATE_KEY",
      "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
    );

    const { getDiscoverySearchClient } = await import(
      "@/lib/rag/discoveryEngine"
    );
    const first = getDiscoverySearchClient();
    const second = getDiscoverySearchClient();
    expect(first).toBe(second);
  });
});
