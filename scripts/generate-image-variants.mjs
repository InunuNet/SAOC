#!/usr/bin/env node
// Pre-generates the WebP srcset candidates lib/image-loader.ts points at. Runs before
// `next build` (see the build script); output lands in public/images/_opt (gitignored).
// Fails the build on any error: a missing variant would 404 a hero image.
import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE_ROOT = 'public/images';
const OUTPUT_ROOT = path.join(SOURCE_ROOT, '_opt');
const RASTER_EXTENSION = /\.(jpe?g|png)$/i;
const WEBP_QUALITY = 75;
// The home hero's static fallback (lib/data/heroImages.ts) also gets a q88 set, which the loader serves for quality={88} (rHB).
const HERO_WEBP_QUALITY = 88;
const HERO_SOURCES = new Set(['orchid-violet.jpg', 'orchid-pink.jpg', 'orchid-dark.jpg'].map((name) => path.join(SOURCE_ROOT, name)));

const { deviceSizes, imageSizes } = JSON.parse(await readFile('lib/image-widths.json', 'utf8'));
const WIDTHS = [...new Set([...deviceSizes, ...imageSizes])].sort((a, b) => a - b);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (full === OUTPUT_ROOT) continue;
    if (entry.isDirectory()) yield* walk(full);
    else if (RASTER_EXTENSION.test(entry.name)) yield full;
  }
}

async function isFresh(output, sourceMtimeMs) {
  try {
    return (await stat(output)).mtimeMs >= sourceMtimeMs;
  } catch {
    return false;
  }
}

const claimed = new Map();
let generated = 0;
let skipped = 0;
for await (const source of walk(SOURCE_ROOT)) {
  // Source extension stays in the output name so a.jpg and a.png never collide.
  const relative = path
    .relative(SOURCE_ROOT, source)
    .replace(/\.[^.]+$/, (ext) => ext.toLowerCase());
  const { mtimeMs } = await stat(source);
  await mkdir(path.dirname(path.join(OUTPUT_ROOT, relative)), { recursive: true });
  const encodings = [['', { quality: WEBP_QUALITY }]];
  if (HERO_SOURCES.has(source)) encodings.push([`-q${HERO_WEBP_QUALITY}`, { quality: HERO_WEBP_QUALITY, smartSubsample: true }]);
  for (const width of WIDTHS) for (const [suffix, webp] of encodings) {
    const output = path.join(OUTPUT_ROOT, `${relative}-${width}${suffix}.webp`);
    const key = output.toLowerCase();
    if (claimed.has(key)) {
      throw new Error(`image variant collision: ${source} and ${claimed.get(key)} -> ${output}`);
    }
    claimed.set(key, source);
    if (await isFresh(output, mtimeMs)) {
      skipped += 1;
      continue;
    }
    await sharp(source)
      .resize({ width, withoutEnlargement: true })
      .webp(webp)
      .toFile(output);
    generated += 1;
  }
}
console.log(`image variants: ${generated} generated, ${skipped} up to date`);
