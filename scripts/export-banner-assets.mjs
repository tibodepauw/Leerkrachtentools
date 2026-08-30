import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

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

rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1200, height: 360 },
  deviceScaleFactor: 2,
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
}

// --- Static PNG ---
await page.goto(`${baseHost}/dev/wordmark-export?mode=static`, {
  waitUntil: "networkidle",
});
await waitForFonts();
await screenshotCanvas(pngOutput);
console.log(`Wrote ${pngOutput}`);

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
      "split[s0][s1]",
      "[s0]palettegen=max_colors=256:stats_mode=full[p]",
      "[s1][p]paletteuse=dither=sierra2_4a:bayer_scale=3",
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
