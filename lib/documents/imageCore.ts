import sharp from "sharp";
const PROFILE_IMAGE_MAX_PIXELS = 16_000_000;
export async function canonicalProfileImage(buffer: Buffer) {
  const image = sharp(buffer, { limitInputPixels: PROFILE_IMAGE_MAX_PIXELS, failOn: "warning", animated: false });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.width > 8192 || metadata.height > 8192 || (metadata.pages ?? 1) > 1) {
    throw new Error("Kies een niet-geanimeerde afbeelding van maximaal 8192 pixels per zijde.");
  }
  // Sharp strips EXIF/XMP by default. Decode fully and never serve original bytes.
  return image.rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).timeout({ seconds: 5 }).toBuffer();
}
