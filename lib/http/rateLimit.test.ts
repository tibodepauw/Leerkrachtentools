import { afterEach, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/auth/database";
import {
  assertRequestRateLimit,
  RequestRateLimitError,
  withRequestConcurrency,
} from "@/lib/http/rateLimit";

describe("request rate limits", () => {
  const subject = "rate-limit-test";

  afterEach(() => {
    getDatabase()
      .prepare("DELETE FROM request_rate_events WHERE subject = ?")
      .run(subject);
  });

  it("blokkeert zodra het venster vol is", () => {
    assertRequestRateLimit({
      scope: "test",
      subject,
      limit: 1,
      windowMs: 60_000,
    });

    expect(() =>
      assertRequestRateLimit({
        scope: "test",
        subject,
        limit: 1,
        windowMs: 60_000,
      }),
    ).toThrow(RequestRateLimitError);
  });

  it("begrenst gelijktijdige zware aanvragen", async () => {
    let releaseFirst!: () => void;
    const first = withRequestConcurrency({
      scope: "test",
      subject,
      limit: 1,
      task: () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        }),
    });

    await expect(
      withRequestConcurrency({
        scope: "test",
        subject,
        limit: 1,
        task: async () => undefined,
      }),
    ).rejects.toThrow(RequestRateLimitError);

    releaseFirst();
    await first;
  });
});
