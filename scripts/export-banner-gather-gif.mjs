import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const framesDir = path.join("/tmp", "wordmark-gather-frames");
const outputGif = path.join("docs", "assets", "banner-wordmark-gather.gif");
const baseUrl = process.env.WORDMARK_EXPORT_URL ?? "http://127.0.0.1:3000/dev/wordmark-export";

rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 420 },
  deviceScaleFactor: 2,
});

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.waitForTimeout(150);

const exportCanvas = page.locator("#wordmark-export");
await exportCanvas.waitFor({ state: "visible" });

for (let frame = 0; frame < 40; frame += 1) {
  await page.waitForTimeout(45);
  await exportCanvas.screenshot({
    path: path.join(framesDir, `frame-${String(frame).padStart(3, "0")}.png`),
  });
}

await browser.close();

execFileSync(
  "ffmpeg",
  [
    "-y",
    "-framerate",
    "20",
    "-i",
    path.join(framesDir, "frame-%03d.png"),
    "-vf",
    "fps=14,scale=1200:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer",
    outputGif,
  ],
  { stdio: "inherit" },
);

console.log(`Wrote ${outputGif}`);
