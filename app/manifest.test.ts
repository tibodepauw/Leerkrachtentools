import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import manifest from "@/app/manifest";

describe("web app manifest", () => {
  it("beschrijft een installbare standalone app", () => {
    const data = manifest();
    expect(data.name).toBe("Leerkrachtentools");
    expect(data.short_name).toBe("Lk-tools");
    expect(data.start_url).toBe("/");
    expect(data.display).toBe("standalone");
    expect(data.background_color).toBe("#000000");
    expect(data.theme_color).toBe("#000000");
    expect(data.lang).toBe("nl");
    expect(data.icons?.some((icon) => icon.purpose === "any")).toBe(true);
    expect(data.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("heeft PNG-iconen in de vereiste maten", async () => {
    expect(existsSync("public/icons/icon.svg")).toBe(true);
    const icon192 = await sharp("public/icons/icon-192.png").metadata();
    const icon512 = await sharp("public/icons/icon-512.png").metadata();
    const maskable = await sharp("public/icons/icon-512-maskable.png").metadata();
    const apple = await sharp("public/apple-touch-icon.png").metadata();
    expect(icon192.width).toBe(192);
    expect(icon192.height).toBe(192);
    expect(icon512.width).toBe(512);
    expect(icon512.height).toBe(512);
    expect(maskable.width).toBe(512);
    expect(apple.width).toBe(180);
    expect(readFileSync("public/icons/icon-192.png")[0]).toBe(0x89);
  });
});
