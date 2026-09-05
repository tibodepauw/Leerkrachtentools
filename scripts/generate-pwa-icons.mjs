import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/**
 * Real Rubik Black outlines (unitsPerEm 1000). Outer terminals are already
 * rounded in the TTF. Gather tilt matches ProfileAvatar. Black field, dotted
 * grid and title gradient match docs/assets/banner-huisstijl.svg.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "public", "icons");

const CANVAS = 512;
const GAP = 24;
const PAD = 12;
const ROT_L = -12;
const ROT_T = 12;
const TRIAL = 1800;
const L_ORIGIN_X = 80;
const ORIGIN_Y = 1400;
const L_ADVANCE = 626;

function letterL() {
  return "M586 0L82 0Q71 0 63 -8Q55 -16 55 -27L55 -673Q55 -684 63 -692Q71 -700 82 -700L282 -700Q293 -700 301 -692Q309 -684 309 -673L309 -205L586 -205Q597 -205 605 -197Q613 -189 613 -178L613 -27Q613 -16 605 -8Q597 0 586 0Z";
}

function letterT() {
  return "M437 0L237 0Q226 0 218 -8Q210 -16 210 -27L210 -485L44 -485Q33 -485 25 -493Q17 -501 17 -512L17 -673Q17 -684 25 -692Q33 -700 44 -700L630 -700Q641 -700 649 -692Q657 -684 657 -673L657 -512Q657 -501 649 -493Q641 -485 630 -485L464 -485L464 -27Q464 -16 456 -8Q448 0 437 0Z";
}

function lettersGroup() {
  const lCx = (55 + 613) / 2;
  const lCy = -350;
  const tCx = (17 + 657) / 2;
  const tCy = -350;
  const lDy = -40;
  const tDy = 40;
  const tX = L_ORIGIN_X + L_ADVANCE + GAP;
  return `<g fill="url(#lt)">
    <g transform="translate(${L_ORIGIN_X} ${ORIGIN_Y}) translate(0 ${lDy}) rotate(${ROT_L} ${lCx} ${lCy})">
      <path d="${letterL()}"/>
    </g>
    <g transform="translate(${tX} ${ORIGIN_Y}) translate(0 ${tDy}) rotate(${ROT_T} ${tCx} ${tCy})">
      <path d="${letterT()}"/>
    </g>
  </g>`;
}

function brandChrome(width, height) {
  return `<defs>
    <pattern id="hsGrid" width="32" height="32" patternUnits="userSpaceOnUse">
      <circle cx="16" cy="16" r="1" fill="rgba(255,255,255,0.1)"/>
    </pattern>
    <radialGradient id="hsGridFade" cx="50%" cy="25%" rx="80%" ry="65%">
      <stop offset="60%" stop-color="white"/>
      <stop offset="100%" stop-color="black"/>
    </radialGradient>
    <mask id="hsGridMask">
      <rect width="${width}" height="${height}" fill="url(#hsGridFade)"/>
    </mask>
    <linearGradient id="lt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.3" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#71717a"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="#000000"/>
  <rect width="${width}" height="${height}" fill="url(#hsGrid)" mask="url(#hsGridMask)"/>`;
}

function svgMarkup(width, height, extraGroupTransform, includeChrome = true) {
  const chrome = includeChrome
    ? brandChrome(width, height)
    : `<rect width="${width}" height="${height}" fill="#000000"/>
  <defs>
    <linearGradient id="lt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.3" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#71717a"/>
    </linearGradient>
  </defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Leerkrachtentools">
  ${chrome}
  <g transform="${extraGroupTransform}">
    ${lettersGroup()}
  </g>
</svg>
`;
}

async function inkBox(svg, size) {
  const { data, info } = await sharp(Buffer.from(svg), { density: 72 })
    .resize(size, size)
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = size;
  let minY = size;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (data[(y * size + x) * info.channels] > 20) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

async function buildSvg() {
  const trial = svgMarkup(TRIAL, TRIAL, "", false);
  const box = await inkBox(trial, TRIAL);
  const scale = Math.min((CANVAS - PAD * 2) / box.w, (CANVAS - PAD * 2) / box.h);
  const ox = (CANVAS - box.w * scale) / 2 - box.minX * scale;
  const oy = (CANVAS - box.h * scale) / 2 - box.minY * scale;
  return svgMarkup(
    CANVAS,
    CANVAS,
    `translate(${ox.toFixed(3)} ${oy.toFixed(3)}) scale(${scale.toFixed(6)})`,
    true,
  );
}

function asciiFromRaw(data, width, height, channels, cols, rows) {
  const lum = (x, y) => data[(y * width + x) * channels];
  const lines = [];
  for (let r = 0; r < rows; r += 1) {
    let row = "";
    for (let c = 0; c < cols; c += 1) {
      const x = Math.min(width - 1, Math.floor((c * width) / cols));
      const y = Math.min(height - 1, Math.floor((r * height) / rows));
      const v = lum(x, y);
      row += v > 200 ? "#" : v > 80 ? "o" : v > 20 ? "." : " ";
    }
    lines.push(row);
  }
  return lines.join("\n");
}

function letterBBox(data, width, height, channels) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * channels] > 50) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function rowRuns(data, width, channels, y, threshold = 20) {
  const runs = [];
  let start = -1;
  for (let x = 0; x <= width; x += 1) {
    const on = x < width && data[(y * width + x) * channels] > threshold;
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      runs.push({ start, end: x - 1, len: x - start });
      start = -1;
    }
  }
  return runs;
}

async function assertReadableIcon(pngPath) {
  const { data, info } = await sharp(pngPath)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const art = asciiFromRaw(data, width, height, channels, 56, 28);
  const box = letterBBox(data, width, height, channels);
  const topY = box.minY + Math.round(box.h * 0.18);
  const midY = box.minY + Math.round(box.h * 0.48);
  const topRuns = rowRuns(data, width, channels, topY, 50).filter((run) => run.len > 16);
  const midRuns = rowRuns(data, width, channels, midY, 50).filter((run) => run.len > 16);
  const topWidth = topRuns.reduce((sum, run) => sum + run.len, 0);
  const midWidth = midRuns.reduce((sum, run) => sum + run.len, 0);

  console.log(
    `\n${pngPath} bbox ${box.w}x${box.h} pad L${box.minX} T${box.minY} R${width - 1 - box.maxX} B${height - 1 - box.maxY}`,
  );
  console.log(`top runs=${topRuns.length} mid runs=${midRuns.length}`);
  console.log(art);

  const problems = [];
  if (topRuns.length < 2) {
    problems.push("top of icon is one blob, LT is not readable");
  }
  if (topWidth < midWidth * 1.12) {
    problems.push("T bar is not wider than the stems");
  }
  if (problems.length) {
    throw new Error(`PWA icon failed visual checks:\n- ${problems.join("\n- ")}`);
  }
}

async function raster(svg, size, dest) {
  await sharp(Buffer.from(svg), { density: 512 }).resize(size, size).png().toFile(dest);
}

async function main() {
  const svg = await buildSvg();
  await fs.writeFile(path.join(iconsDir, "icon.svg"), svg);
  await raster(svg, 512, path.join(iconsDir, "icon-512.png"));
  await raster(svg, 192, path.join(iconsDir, "icon-192.png"));
  await raster(svg, 180, path.join(root, "public", "apple-touch-icon.png"));
  await raster(svg, 32, path.join(root, "public", "favicon-32.png"));

  const inner = await sharp(Buffer.from(svg), { density: 512 })
    .resize(400, 400)
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
    .composite([{ input: inner, left: 56, top: 56 }])
    .png()
    .toFile(path.join(iconsDir, "icon-512-maskable.png"));

  await assertReadableIcon(path.join(iconsDir, "icon-512.png"));
  await assertReadableIcon(path.join(iconsDir, "icon-192.png"));
}

await main();
