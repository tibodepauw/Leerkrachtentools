import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/auth/crypto";

describe("auth crypto", () => {
  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  it("encrypts and decrypts secrets", () => {
    process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
    const encrypted = encryptSecret("sk-test-1234567890");
    expect(encrypted).not.toContain("sk-test");
    expect(decryptSecret(encrypted)).toBe("sk-test-1234567890");
  });

  it("masks secrets for display", () => {
    expect(maskSecret("abcdefgh")).toBe("••••efgh");
    expect(maskSecret("ab")).toBe("••••");
  });
});
