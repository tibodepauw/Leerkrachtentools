import { describe, expect, it, vi } from "vitest";
import { withUploadCapacity } from "./uploadCapacity";
import { RequestRateLimitError } from "./rateLimit";

describe("upload admission before buffering", () => {
  it("rejects excess bodies before reading them and returns slots after success or failure", async () => {
    const releases: Array<() => void> = [];
    const running = Array.from({ length: 4 }, (_, n) => withUploadCapacity(`user-${n}`, () => new Promise<void>((resolve) => releases.push(resolve))));
    const readBody = vi.fn(async () => undefined);
    try {
      await expect(withUploadCapacity("user-0", readBody)).rejects.toThrow(RequestRateLimitError);
      await expect(withUploadCapacity("user-5", readBody)).rejects.toThrow(RequestRateLimitError);
      expect(readBody).not.toHaveBeenCalled();
    } finally { releases.forEach((release) => release()); await Promise.all(running); }
    await expect(withUploadCapacity("user-0", async () => { throw new Error("decode failed"); })).rejects.toThrow("decode failed");
    await withUploadCapacity("user-0", readBody);
    expect(readBody).toHaveBeenCalledTimes(1);
  });
});
