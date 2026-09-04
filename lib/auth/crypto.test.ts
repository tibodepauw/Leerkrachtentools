import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/auth/crypto";

describe("auth crypto", () => {
  afterEach(() => {
    delete process.env.AUTH_SECRET;
    delete process.env.API_KEY_ENCRYPTION_SECRET;
    delete process.env.API_KEY_ENCRYPTION_PREVIOUS_SECRETS;
  });

  it("encrypts and decrypts secrets", () => {
    process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
    process.env.API_KEY_ENCRYPTION_SECRET =
      "test-encryption-secret-with-at-least-32-characters";
    const encrypted = encryptSecret("sk-test-1234567890", "user:1:provider:google");
    expect(encrypted).not.toContain("sk-test");
    expect(encrypted).toMatch(/^v2\./);
    expect(decryptSecret(encrypted, "user:1:provider:google")).toBe(
      "sk-test-1234567890",
    );
    expect(() =>
      decryptSecret(encrypted, "user:1:provider:groq"),
    ).toThrow();
  });

  it("kan tijdens sleutelrotatie met de vorige sleutel ontsleutelen", () => {
    process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
    process.env.API_KEY_ENCRYPTION_SECRET =
      "previous-encryption-secret-with-at-least-32-characters";
    const encrypted = encryptSecret("secret", "context");

    process.env.API_KEY_ENCRYPTION_SECRET =
      "current-encryption-secret-with-at-least-32-characters";
    process.env.API_KEY_ENCRYPTION_PREVIOUS_SECRETS =
      "previous-encryption-secret-with-at-least-32-characters";

    expect(decryptSecret(encrypted, "context")).toBe("secret");
  });

  it("masks secrets for display", () => {
    expect(maskSecret("abcdefgh")).toBe("••••efgh");
    expect(maskSecret("ab")).toBe("••••");
  });
});
