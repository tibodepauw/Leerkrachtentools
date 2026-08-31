import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const baseHost = process.env.WORDMARK_EXPORT_URL ?? "http://127.0.0.1:43123";
const framesDir = path.join("/tmp", "wordmark-gather-frames");
const pngOutput = path.join("docs", "assets", "banner-wordmark.png");
const gifOutput = path.join("docs", "assets", "banner-wordmark-gather.gif");

/** Last letter: 16×55ms stagger + 1450ms duration ≈ 2.33s */
const ANIMATION_MS = 2600;
const SETTLE_MS = 500;
const CAPTURE_INTERVAL_MS = 40;
const HOLD_SECONDS = 10;
const OUTPUT_FPS = 20;
const DEVICE_SCALE = 2;
/** Display radius 16px → 32px at 2× capture before GIF downscale */
const CORNER_RADIUS = 16 * DEVICE_SCALE;

rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1200, height: 360 },
  deviceScaleFactor: DEVICE_SCALE,
  reducedMotion: "no-preference",
});
const page = await context.newPage();

await page.addStyleTag({
  content: `
    nextjs-portal,
    [data-nextjs-badge-root],
    [data-nextjs-toast],
    [data-nextjs-dev-tools-button],
    #__next-build-watcher {
      display: none !important;
    }
  `,
});

async function waitForFonts() {
  await page.waitForFunction(() => document.fonts.ready);
  await page.waitForTimeout(150);
}

async function screenshotCanvas(targetPath) {
  await page.locator("#wordmark-export").screenshot({ path: targetPath });
  const { width, height } = await sharp(targetPath).metadata();
  if (width !== 1200 * DEVICE_SCALE || height !== 360 * DEVICE_SCALE) {
    throw new Error(
      `Unexpected screenshot size ${width}x${height} at ${targetPath} (expected ${1200 * DEVICE_SCALE}x${360 * DEVICE_SCALE})`,
    );
  }
}

// --- Static PNG ---
await page.goto(`${baseHost}/dev/wordmark-export?mode=static`, {
  waitUntil: "networkidle",
});
await waitForFonts();
await screenshotCanvas(pngOutput);
await applyRoundedCorners(pngOutput);
const pngTemp = `${pngOutput}.tmp`;
await sharp(pngOutput).resize(1200, 360).png().toFile(pngTemp);
renameSync(pngTemp, pngOutput);
console.log(`Wrote ${pngOutput} (${CORNER_RADIUS / DEVICE_SCALE}px rounded corners)`);

// --- Animated GIF ---
await page.goto(`${baseHost}/dev/wordmark-export?mode=gather&fresh=${Date.now()}`, {
  waitUntil: "networkidle",
});
await waitForFonts();
await page.waitForTimeout(80);

const animationFrameCount = Math.ceil(ANIMATION_MS / CAPTURE_INTERVAL_MS);
let frameIndex = 0;

for (let step = 0; step < animationFrameCount; step += 1) {
  await screenshotCanvas(path.join(framesDir, frameName(frameIndex)));
  frameIndex += 1;
  await page.waitForTimeout(CAPTURE_INTERVAL_MS);
}

await page.waitForTimeout(SETTLE_MS);
const finalFramePath = path.join(framesDir, "final.png");
await screenshotCanvas(finalFramePath);

const holdFrameCount = HOLD_SECONDS * OUTPUT_FPS;
for (let hold = 0; hold < holdFrameCount; hold += 1) {
  copyFileSync(finalFramePath, path.join(framesDir, frameName(frameIndex)));
  frameIndex += 1;
}

await browser.close();

console.log(`Applying ${CORNER_RADIUS}px rounded corners to ${frameIndex} frames…`);
for (let i = 0; i < frameIndex; i += 1) {
  await applyRoundedCorners(path.join(framesDir, frameName(i)));
}

execFileSync(
  "ffmpeg",
  [
    "-y",
    "-framerate",
    String(OUTPUT_FPS),
    "-i",
    path.join(framesDir, "frame-%05d.png"),
    "-frames:v",
    String(frameIndex),
    "-loop",
    "0",
    "-vf",
    [
      "scale=1200:360:flags=lanczos",
      "format=rgba",
      "split[s0][s1]",
      "[s0]palettegen=max_colors=255:reserve_transparent=1:stats_mode=full[p]",
      "[s1][p]paletteuse=dither=sierra2_4a:alpha_threshold=128",
    ].join(","),
    gifOutput,
  ],
  { stdio: "inherit" },
);

console.log(
  `Wrote ${gifOutput} (${animationFrameCount} anim + ${holdFrameCount} hold @ ${OUTPUT_FPS}fps)`,
);

function frameName(index) {
  return `frame-${String(index).padStart(5, "0")}.png`;
}

async function applyRoundedCorners(filePath) {
  const image = sharp(filePath);
  const { width, height } = await image.metadata();
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" rx="${CORNER_RADIUS}" ry="${CORNER_RADIUS}" fill="white"/></svg>`,
  );
  const rounded = await image
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  await sharp(rounded).toFile(filePath);
}
