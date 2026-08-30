import sharp from "sharp";

await sharp("docs/assets/banner-wordmark.svg", { density: 144 })
  .resize(1200)
  .png({ compressionLevel: 9 })
  .toFile("docs/assets/banner-wordmark.png");

console.log("Wrote docs/assets/banner-wordmark.png");
