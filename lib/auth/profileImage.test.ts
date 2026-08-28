import { describe, expect, it } from "vitest";
import {
  isSupportedProfileImage,
  mimeTypeForProfileImage,
  profileImageFileName,
} from "@/lib/auth/profileImage";

describe("profileImage", () => {
  it("accepteert gangbare afbeeldingsformaten", () => {
    expect(isSupportedProfileImage("foto.jpg", "image/jpeg")).toBe(true);
    expect(isSupportedProfileImage("foto.png", "image/png")).toBe(true);
    expect(isSupportedProfileImage("foto.webp", "image/webp")).toBe(true);
    expect(isSupportedProfileImage("foto.pdf", "application/pdf")).toBe(false);
  });

  it("maakt een stabiele bestandsnaam per gebruiker", () => {
    expect(profileImageFileName("user-1", "avatar.JPEG")).toBe("user-1.jpg");
  });

  it("koppelt mime type aan extensie", () => {
    expect(mimeTypeForProfileImage("user-1.webp")).toBe("image/webp");
  });
});
