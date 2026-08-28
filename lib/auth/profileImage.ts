import "server-only";

import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export function profileImageDirectory() {
  const directory = path.join(process.cwd(), "data", "avatars");
  mkdirSync(directory, { recursive: true });
  return directory;
}

export function profileImageExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isSupportedProfileImage(fileName: string, mimeType?: string) {
  const extension = profileImageExtension(fileName);
  if (!ALLOWED_EXTENSIONS.has(extension)) return false;

  if (!mimeType) return true;

  const expected = MIME_BY_EXTENSION[extension];
  return !expected || mimeType === expected || mimeType === "image/jpg";
}

export function mimeTypeForProfileImage(relativePath: string) {
  const extension = profileImageExtension(relativePath);
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

export function profileImageAbsolutePath(relativePath: string) {
  return path.join(profileImageDirectory(), relativePath);
}

export function profileImageFileName(userId: string, fileName: string) {
  const extension = profileImageExtension(fileName);
  return `${userId}.${extension === "jpeg" ? "jpg" : extension}`;
}

export function saveProfileImageFile(
  userId: string,
  fileName: string,
  buffer: Buffer,
) {
  if (!isSupportedProfileImage(fileName)) {
    throw new Error("Ondersteunde formaten: JPG, PNG, WEBP en GIF.");
  }

  if (buffer.byteLength > PROFILE_IMAGE_MAX_BYTES) {
    throw new Error("De profielfoto mag maximaal 2 MB zijn.");
  }

  const nextFileName = profileImageFileName(userId, fileName);
  const directory = profileImageDirectory();

  for (const extension of ALLOWED_EXTENSIONS) {
    const candidate = path.join(directory, `${userId}.${extension}`);
    try {
      unlinkSync(candidate);
    } catch {
      // Bestand bestaat niet — negeren.
    }
  }

  writeFileSync(path.join(directory, nextFileName), buffer);
  return nextFileName;
}

export function deleteProfileImageFile(relativePath: string | null | undefined) {
  if (!relativePath) return;

  try {
    unlinkSync(profileImageAbsolutePath(relativePath));
  } catch {
    // Bestand ontbreekt al — negeren.
  }
}

export function profileImageUrl(updatedAt: number) {
  return `/api/account/avatar?t=${updatedAt}`;
}
