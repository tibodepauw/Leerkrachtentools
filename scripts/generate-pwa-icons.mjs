import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "public", "icons");
const svgPath = path.join(iconsDir, "icon.svg");

async function raster(size, dest) {
  const svg = await fs.readFile(svgPath);
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(dest);
}

async function main() {
  await raster(192, path.join(iconsDir, "icon-192.png"));
  await raster(512, path.join(iconsDir, "icon-512.png"));
  await raster(180, path.join(root, "public", "apple-touch-icon.png"));
  await raster(32, path.join(root, "public", "favicon-32.png"));

  const inner = await sharp(await fs.readFile(svgPath))
    .resize(320, 320)
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: "#000000",
    },
  })
    .composite([{ input: inner, left: 96, top: 96 }])
    .png()
    .toFile(path.join(iconsDir, "icon-512-maskable.png"));
}

await main();
