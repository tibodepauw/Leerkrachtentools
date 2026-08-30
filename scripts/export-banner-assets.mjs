import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseHost = process.env.WORDMARK_EXPORT_URL ?? "http://127.0.0.1:3000";
const framesDir = path.join("/tmp", "wordmark-gather-frames");
const pngOutput = path.join("docs", "assets", "banner-wordmark.png");
const gifOutput = path.join("docs", "assets", "banner-wordmark-gather.gif");

/** Gather: 1.45s duration + up to 16×55ms stagger ≈ 2.33s until settled. */
const ANIMATION_MS = 2500;
const CAPTURE_INTERVAL_MS = 25;
const HOLD_SECONDS = 10;
const OUTPUT_FPS = 40;

rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 360 },
  deviceScaleFactor: 2,
});

async function waitForFonts() {
  await page.waitForFunction(() => document.fonts.ready);
  await page.waitForTimeout(100);
}

async function screenshotCanvas(targetPath) {
  await page.locator("#wordmark-export").screenshot({ path: targetPath });
}

// --- Static PNG (Rubik via browser, not sharp-on-SVG) ---
await page.goto(`${baseHost}/dev/wordmark-export?mode=static`, {
  waitUntil: "networkidle",
});
await waitForFonts();
await screenshotCanvas(pngOutput);
console.log(`Wrote ${pngOutput}`);

// --- Animated GIF: gather + 10s hold on final frame ---
await page.goto(`${baseHost}/dev/wordmark-export?mode=gather&fresh=${Date.now()}`, {
  waitUntil: "networkidle",
});
await waitForFonts();

const animationFrameCount = Math.ceil(ANIMATION_MS / CAPTURE_INTERVAL_MS);
let frameIndex = 0;

for (let step = 0; step < animationFrameCount; step += 1) {
  await screenshotCanvas(path.join(framesDir, frameName(frameIndex)));
  frameIndex += 1;
  await page.waitForTimeout(CAPTURE_INTERVAL_MS);
}

await page.waitForTimeout(350);
const finalFramePath = path.join(framesDir, "final.png");
await screenshotCanvas(finalFramePath);

const holdFrameCount = HOLD_SECONDS * OUTPUT_FPS;
for (let hold = 0; hold < holdFrameCount; hold += 1) {
  copyFileSync(finalFramePath, path.join(framesDir, frameName(frameIndex)));
  frameIndex += 1;
}

await browser.close();

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
    "-vf",
    [
      "scale=1200:360:flags=lanczos",
      "split[s0][s1]",
      "[s0]palettegen=max_colors=256:stats_mode=full[p]",
      "[s1][p]paletteuse=dither=sierra2_4a:bayer_scale=3",
    ].join(","),
    gifOutput,
  ],
  { stdio: "inherit" },
);

console.log(
  `Wrote ${gifOutput} (${animationFrameCount} anim frames + ${holdFrameCount} hold frames @ ${OUTPUT_FPS}fps)`,
);

function frameName(index) {
  return `frame-${String(index).padStart(5, "0")}.png`;
}
