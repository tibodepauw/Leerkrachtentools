import { describe, expect, it } from "vitest";
import {
  documentDatabaseName,
  lessonStoreStorageKey,
} from "@/lib/storage/userStorageScope";

describe("userStorageScope", () => {
  it("maakt per account unieke opslagsleutels", () => {
    const userA = "11111111-1111-4111-8111-111111111111";
    const userB = "22222222-2222-4222-8222-222222222222";

    expect(lessonStoreStorageKey(userA)).toBe(
      "leerkrachtentools-active-lesson:11111111-1111-4111-8111-111111111111",
    );
    expect(lessonStoreStorageKey(userB)).toBe(
      "leerkrachtentools-active-lesson:22222222-2222-4222-8222-222222222222",
    );
    expect(documentDatabaseName(userA)).toBe(
      "leerkrachtentools-documents:11111111-1111-4111-8111-111111111111",
    );
    expect(lessonStoreStorageKey(userA)).not.toBe(lessonStoreStorageKey(userB));
  });
});
