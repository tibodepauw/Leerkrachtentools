import { z } from "zod";
import { MANUAL_SCANNER_MAX_BYTES } from "@/lib/documents/supportedFormats";

export const MAX_DECODED_UPLOAD_BYTES = MANUAL_SCANNER_MAX_BYTES;
export const MAX_ENCODED_UPLOAD_CHARS = 4 * Math.ceil(MAX_DECODED_UPLOAD_BYTES / 3);

const BASE64_CHARS = /^[A-Za-z0-9+/=\s]+$/;
const MAX_URL_PARSE_CHARS = 2_048;

export class BinaryUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BinaryUploadError";
  }
}

/**
 * Lineair: alleen vaste zoektermen. Een patroon als /[a-z][a-z0-9+.-]*:\/\//
 * zonder anker scant vanaf elke letter opnieuw en is kwadratisch op megabytes
 * base64. Geldige base64 bevat nooit ':' en begint nooit met '//'.
 */
export function looksLikeUrlString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("//") || trimmed.includes("://")) return true;
  if (trimmed.length > MAX_URL_PARSE_CHARS) return false;
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
  if (compact.length > 4 * Math.ceil(maxBytes / 3)) {
    throw new BinaryUploadError("Het bestand is te groot.");
  }
  const paddingAt = compact.indexOf("=");
  if (paddingAt !== -1) {
    const padding = compact.length - paddingAt;
    if (padding > 2 || compact.length % 4 !== 0 || !compact.endsWith("=".repeat(padding))) {
      throw new BinaryUploadError("Het bestand is geen geldige base64-inhoud.");
    }
  }
  let decoded: Buffer;
  try {
    decoded = Buffer.from(compact, "base64");
  } catch {
    throw new BinaryUploadError("Het bestand is geen geldige base64-inhoud.");
  }
  if (!decoded.length) {
    throw new BinaryUploadError("Het bestand is geen geldige base64-inhoud.");
  }
  const roundTrip = decoded.toString("base64");
  const roundTripPadding = roundTrip.indexOf("=");
  const canonical = roundTripPadding === -1 ? roundTrip : roundTrip.slice(0, roundTripPadding);
  const compactUnpadded = paddingAt === -1 ? compact : compact.slice(0, paddingAt);
  if (canonical !== compactUnpadded) {
    throw new BinaryUploadError("Het bestand is geen geldige base64-inhoud.");
  }
  if (decoded.length > maxBytes) {
    throw new BinaryUploadError("Het bestand is te groot.");
  }
  return new Uint8Array(decoded);
}

export const binaryUploadString = z
  .string()
  .max(MAX_ENCODED_UPLOAD_CHARS, "Het bestand is te groot.")
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
