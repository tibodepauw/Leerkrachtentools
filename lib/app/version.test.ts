import { afterEach, describe, expect, it } from "vitest";
import { getAppVersionInfo } from "@/lib/app/version";

describe("app version", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    delete process.env.NEXT_PUBLIC_APP_COMMIT;
    delete process.env.NEXT_PUBLIC_GITHUB_REPO;
  });

  it("leest versie uit env vars wanneer beschikbaar", () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "1.2.3";
    process.env.NEXT_PUBLIC_APP_COMMIT = "abc1234";
    process.env.NEXT_PUBLIC_GITHUB_REPO =
      "https://github.com/tibodepauw/Leerkrachtentools";

    expect(getAppVersionInfo()).toEqual({
      version: "1.2.3",
      commit: "abc1234",
      githubRepo: "https://github.com/tibodepauw/Leerkrachtentools",
    });
  });
});
