import { describe, expect, it } from "vitest";
import { collectVulnerabilities } from "./audit-production-dependencies.mjs";

const queries = [{ package: { name: "example" }, version: "1.0.0" }];
describe("dependency audit gate", () => {
  it.each([{}, { results: [] }, { results: [null] }, { results: [{ error: "upstream failed" }] }, { results: [{ vulns: {} }] }])("fails closed for an incomplete or invalid service response", (payload) => {
    expect(() => collectVulnerabilities(queries, payload)).toThrow();
  });
  it("distinguishes a completed clean scan from a reported vulnerability", () => {
    expect(collectVulnerabilities(queries, { results: [{}] })).toEqual([]);
    expect(collectVulnerabilities(queries, { results: [{ vulns: [{ id: "GHSA-test" }] }] })).toEqual([
      { package: "example", version: "1.0.0", id: "GHSA-test", summary: "" },
    ]);
  });
});
