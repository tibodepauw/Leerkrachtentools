import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSupportedProfileImage,
  profileImageAbsolutePath,
  profileImageDirectory,
  mimeTypeForProfileImage,
  profileImageFileName,
} from "@/lib/auth/profileImage";

describe("profileImage", () => {
  it("accepteert gangbare afbeeldingsformaten", () => {
    expect(isSupportedProfileImage("foto.jpg", "image/jpeg")).toBe(true);
    expect(isSupportedProfileImage("foto.png", "image/png")).toBe(true);
    expect(isSupportedProfileImage("foto.webp", "image/webp")).toBe(true);
    expect(isSupportedProfileImage("foto.pdf", "application/pdf")).toBe(false);
    expect(isSupportedProfileImage("foto.png", "text/html")).toBe(false);
  });

  it("maakt een stabiele bestandsnaam per gebruiker", () => {
    expect(profileImageFileName("user-1", "avatar.JPEG")).toBe("user-1.jpg");
  });

  it("koppelt mime type aan extensie", () => {
    expect(mimeTypeForProfileImage("user-1.webp")).toBe("image/webp");
  });

  it("houdt profielfotopaden binnen de avatardirectory", () => {
    const absolutePath = profileImageAbsolutePath("user-1.webp");
    expect(path.dirname(absolutePath)).toBe(
      path.resolve(profileImageDirectory()),
    );

    expect(() => profileImageAbsolutePath("../secrets.jpg")).toThrow(
      "Ongeldig profielfotopad",
    );
    expect(() =>
      profileImageAbsolutePath("/tmp/other-user.jpg"),
    ).toThrow("Ongeldig profielfotopad");
  });
});
