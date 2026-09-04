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

function hasValidImageSignature(extension: string, buffer: Buffer) {
  switch (extension) {
    case "jpg":
    case "jpeg":
      return (
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    case "png":
      return buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    case "gif":
      return ["GIF87a", "GIF89a"].includes(
        buffer.subarray(0, 6).toString("ascii"),
      );
    case "webp":
      return (
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    default:
      return false;
  }
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
  if (!hasValidImageSignature(profileImageExtension(fileName), buffer)) {
    throw new Error(
      "De bestandsinhoud komt niet overeen met een ondersteunde afbeelding.",
    );
  }

  const nextFileName = profileImageFileName(userId, fileName);
  const directory = profileImageDirectory();

  for (const extension of ALLOWED_EXTENSIONS) {
    const candidate = path.join(directory, `${userId}.${extension}`);
    try {
      unlinkSync(candidate);
    } catch {
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
  }
}

export function profileImageUrl(updatedAt: number) {
  return `/api/account/avatar?t=${updatedAt}`;
}
