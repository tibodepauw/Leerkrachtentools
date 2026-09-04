import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const ENVELOPE_VERSION = "v2";
const KEY_SALT = "leerkrachtentools-api-keys-v2";

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "test") {
    return "local-development-secret-change-before-production";
  }
  throw new Error("AUTH_SECRET moet minstens 32 tekens bevatten.");
}

function encryptionSecret() {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "test") return authSecret();
  throw new Error(
    "API_KEY_ENCRYPTION_SECRET moet minstens 32 tekens bevatten.",
  );
}

function previousEncryptionSecrets() {
  return (process.env.API_KEY_ENCRYPTION_PREVIOUS_SECRETS ?? "")
    .split(",")
    .map((secret) => secret.trim())
    .filter((secret) => secret.length >= 32);
}

function deriveKey(secret: string, salt = KEY_SALT) {
  return scryptSync(secret, salt, 32);
}

function decodeEnvelope(ciphertext: string) {
  const [version, ivValue, tagValue, encryptedValue, extra] =
    ciphertext.split(".");
  if (
    version !== ENVELOPE_VERSION ||
    !ivValue ||
    !tagValue ||
    !encryptedValue ||
    extra
  ) {
    throw new Error("Ongeldig versleuteld geheim.");
  }
  return {
    iv: Buffer.from(ivValue, "base64url"),
    tag: Buffer.from(tagValue, "base64url"),
    encrypted: Buffer.from(encryptedValue, "base64url"),
  };
}

export function encryptSecret(plaintext: string, context = "") {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    deriveKey(encryptionSecret()),
    iv,
  );
  cipher.setAAD(Buffer.from(context, "utf8"));
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptEnvelope(
  ciphertext: string,
  context: string,
  secret: string,
) {
  const { iv, tag, encrypted } = decodeEnvelope(ciphertext);
  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error("Ongeldig versleuteld geheim.");
  }
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), iv);
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

function decryptLegacySecret(ciphertext: string) {
  const buffer = Buffer.from(ciphertext, "base64");
  if (buffer.length < 29) {
    throw new Error("Ongeldig versleuteld geheim.");
  }
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(authSecret(), "leerkrachtentools-api-keys-v1"),
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

export function decryptSecret(ciphertext: string, context = "") {
  if (!ciphertext.startsWith(`${ENVELOPE_VERSION}.`)) {
    return decryptLegacySecret(ciphertext);
  }

  let lastError: unknown;
  for (const secret of [
    encryptionSecret(),
    ...previousEncryptionSecrets(),
  ]) {
    try {
      return decryptEnvelope(ciphertext, context, secret);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Versleuteld geheim kon niet worden ontsleuteld.");
}

export function maskSecret(value: string) {
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}
