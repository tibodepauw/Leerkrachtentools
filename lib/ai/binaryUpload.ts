import { z } from "zod";

export const MAX_DECODED_UPLOAD_BYTES = 6 * 1024 * 1024;

const URL_PROTOCOL = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;
const HAS_SCHEME = /[a-z][a-z0-9+.-]*:\/\//i;
const BASE64_CHARS = /^[A-Za-z0-9+/=\s]+$/;

export class BinaryUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BinaryUploadError";
  }
}

export function looksLikeUrlString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (URL_PROTOCOL.test(trimmed) || HAS_SCHEME.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function decodeBoundedBase64(
  value: string,
  maxBytes = MAX_DECODED_UPLOAD_BYTES,
): Uint8Array {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BinaryUploadError("Het bestand ontbreekt.");
  }
  if (looksLikeUrlString(trimmed)) {
    throw new BinaryUploadError(
      "Bestanden moeten als base64 worden gestuurd, geen URL.",
    );
  }
  if (!BASE64_CHARS.test(trimmed)) {
    throw new BinaryUploadError("Het bestand is geen geldige base64-inhoud.");
  }
  const compact = trimmed.replace(/\s+/g, "");
  let decoded: Buffer;
  try {
    decoded = Buffer.from(compact, "base64");
  } catch {
    throw new BinaryUploadError("Het bestand is geen geldige base64-inhoud.");
  }
  if (!decoded.length) {
    throw new BinaryUploadError("Het bestand is geen geldige base64-inhoud.");
  }
  const roundTrip = decoded.toString("base64").replace(/=+$/, "");
  const compactTrimmed = compact.replace(/=+$/, "");
  if (roundTrip !== compactTrimmed) {
    throw new BinaryUploadError("Het bestand is geen geldige base64-inhoud.");
  }
  if (decoded.length > maxBytes) {
    throw new BinaryUploadError("Het bestand is te groot.");
  }
  return new Uint8Array(decoded);
}

export const binaryUploadString = z
  .string()
  .max(8_000_000)
  .superRefine((value, ctx) => {
    if (!value.trim()) return;
    try {
      decodeBoundedBase64(value);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          error instanceof BinaryUploadError
            ? error.message
            : "Het bestand is ongeldig.",
      });
    }
  });
