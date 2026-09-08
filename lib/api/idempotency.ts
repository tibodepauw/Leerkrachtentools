import { createHash } from "node:crypto";

export const API_IDEMPOTENCY_KEY_MAX = 128;
export const API_IDEMPOTENCY_BODY_MAX_BYTES = 512_000;
export const API_IDEMPOTENCY_ORG_STORAGE_MAX_BYTES = 8 * 1024 * 1024;

export type ParsedIdempotencyKey =
  | { ok: true; key: string | undefined }
  | { ok: false; reason: "idempotency-invalid" };

export function parseIdempotencyKey(
  value: string | null | undefined,
): ParsedIdempotencyKey {
  if (value == null) return { ok: true, key: undefined };
  const key = value.trim();
  if (!key) return { ok: true, key: undefined };
  if (key.length > API_IDEMPOTENCY_KEY_MAX) {
    return { ok: false, reason: "idempotency-invalid" };
  }
  return { ok: true, key };
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function requestFingerprint({
  method,
  endpoint,
  body,
}: {
  method: string;
  endpoint: string;
  body: unknown;
}) {
  return createHash("sha256")
    .update(method.toUpperCase())
    .update("\0")
    .update(endpoint)
    .update("\0")
    .update(canonicalJson(body))
    .digest("hex");
}

export function utf8ByteLength(value: string) {
  return Buffer.byteLength(value, "utf8");
}
