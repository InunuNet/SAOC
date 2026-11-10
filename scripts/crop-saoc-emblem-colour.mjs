/**
 * Derives the tight-cropped full-colour SAOC emblem for the NOS footer lockup.
 *
 * Source (read-only): public/images/Eulophia-speciosa-emblem.png, the approved Eulophia speciosa
 * emblem, a 1254x1254 square with transparent margin. Output: public/images/saoc-emblem-footer-colour.png,
 * the same pixels cropped to the opaque bounding box (alpha > ALPHA_FLOOR). Nothing is recoloured,
 * resampled or hand-edited, so the emblem fills the lockup box exactly as the greyscale one did.
 *
 * Run with: node scripts/crop-saoc-emblem-colour.mjs
 */

import sharp from 'sharp';

const SOURCE = 'public/images/Eulophia-speciosa-emblem.png';
const OUTPUT = 'public/images/saoc-emblem-footer-colour.png';
const ALPHA_FLOOR = 8;
const CHANNELS = 4;
const ALPHA_OFFSET = 3;

async function main() {
  const { data, info } = await sharp(SOURCE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * CHANNELS + ALPHA_OFFSET] > ALPHA_FLOOR) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left || bottom < top) {
    throw new Error(`${SOURCE} has no opaque pixels`);
  }

  const width = right - left + 1;
  const height = bottom - top + 1;
  await sharp(SOURCE)
    .extract({ left, top, width, height })
    .png({ compressionLevel: 9 })
    .toFile(OUTPUT);
  console.log(`${OUTPUT}: ${width}x${height} (from offset ${left},${top})`);
}

main().catch((err) => {
  console.error('Emblem crop failed:', err);
  process.exit(1);
});
