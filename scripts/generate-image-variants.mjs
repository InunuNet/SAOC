#!/usr/bin/env node
// Pre-generates the WebP (and, for hero sources, AVIF) srcset candidates lib/image-loader.ts points at. Runs before
// `next build` (see the build script); output lands in public/images/_opt (gitignored).
// Fails the build on any error: a missing variant would 404 a hero image.
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE_ROOT = 'public/images';
const OUTPUT_ROOT = path.join(SOURCE_ROOT, '_opt');
const RASTER_EXTENSION = /\.(jpe?g|png)$/i;
const WEBP_QUALITY = 75;
// The home hero's static fallback (lib/data/heroImages.ts) also gets a q88 set, which the loader serves for quality={88} (rHB).
const HERO_VARIANT_NAME_QUALITY = 88;
// The hero WebP encoding quality (goldens/lcp-measure.md call 3: WebP 72 for the hero set). The files keep the -q88
// name above: it is the hero set's key (the loader and the call sites ask for quality 88), not the encoding quality.
const HERO_WEBP_QUALITY = 72;
// Hero variants wider than STANDARD_MAX_WIDTH keep the q88 file name (the loader and the call sites ask for
// quality 88) but are encoded at this lower quality: at 2.5k-7k px the q88 files weighed 1-5 MB. Dimensions are
// untouched (a hero is never served narrower than box x device pixel ratio), only bytes drop.
const HERO_LARGE_WEBP_QUALITY = 78;
const HERO_SOURCES = new Set(['orchid-violet.jpg', 'orchid-pink.jpg', 'orchid-dark.jpg', 'orchid-purple.jpg', 'orchid-yellow.jpg', 'nos-hero-S3a.jpg', 'nos-hero-S3b.jpg', 'nos-hero-S2a.jpg', 'nos-hero-S2c.jpg', 'nos-hero-S1b.jpg', 'nos-hero-H4a.jpg', 'nos-hero-H4b.jpg', 'nos-hero-D1.jpg', 'nos-hero-PK1.jpg', 'nos-hero-PK3.jpg', 'nos-hero-Y1.jpg'].map((name) => path.join(SOURCE_ROOT, name)));
// Hero sources also get an AVIF set (same widths, same -q88 name, .avif extension), served first by
// components/ui/HeroPicture.tsx with the WebP set as fallback. AVIF q55 is far smaller than the hero WebP.
const HERO_AVIF_QUALITY = 55;
// Every image keeps this cap (lib/image-loader.ts). Only the full-bleed hero photographs in
// lib/hero-source-widths.json go above it, under the -q88 name (encoded at q78), up to their own native width and never beyond.
const STANDARD_MAX_WIDTH = 2048;

const { deviceSizes, imageSizes } = JSON.parse(await readFile('lib/image-widths.json', 'utf8'));
const ALL_WIDTHS = [...new Set([...deviceSizes, ...imageSizes])].sort((a, b) => a - b);
const WIDTHS = ALL_WIDTHS.filter((width) => width <= STANDARD_MAX_WIDTH);
const NATIVE_WIDTHS = JSON.parse(await readFile('lib/hero-source-widths.json', 'utf8'));
// Hero cuts and flips (lib/hero-derived-sources.json): each entry is a rect of an original, optionally mirrored with
// `.flop()`, emitted as variants of /images/<name>.jpg. No cut JPEG is committed and no CSS transform flips anything.
const DERIVED_MANIFEST = 'lib/hero-derived-sources.json';
const DERIVED_SOURCES = JSON.parse(await readFile(DERIVED_MANIFEST, 'utf8'));

/** The widths a source gets: the standard set, plus the large set and its native width for a full-bleed hero source. */
function widthsFor(source) {
  const native = NATIVE_WIDTHS[source.slice('public'.length)];
  if (native === undefined) return WIDTHS.map((width) => [width, false]);
  const large = [...new Set([...ALL_WIDTHS.filter((width) => width <= native), native])];
  return [...WIDTHS.map((width) => [width, false]), ...large.filter((width) => width > STANDARD_MAX_WIDTH).map((width) => [width, true])];
}

/** Variants for one width: q75 up to the cap, plus the -q88 name for a hero source (encoded at q78 above the cap). */
function encodingsFor(isHero, isLarge) {
  const encodings = [];
  if (!isLarge) encodings.push(['', 'webp', { quality: WEBP_QUALITY }]);
  if (isHero) {
    const quality = isLarge ? HERO_LARGE_WEBP_QUALITY : HERO_WEBP_QUALITY;
    encodings.push([`-q${HERO_VARIANT_NAME_QUALITY}`, 'webp', { quality, smartSubsample: true }]);
    encodings.push([`-q${HERO_VARIANT_NAME_QUALITY}`, 'avif', { quality: HERO_AVIF_QUALITY }]);
  }
  return encodings;
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (full === OUTPUT_ROOT) continue;
    if (entry.isDirectory()) yield* walk(full);
    else if (RASTER_EXTENSION.test(entry.name)) yield full;
  }
}

// An output is fresh only if it is newer than its source AND was written with the encode options in force now. The
// options are recorded per output in this manifest: the -q88 name is a key, not a quality, so a quality change must
// invalidate by options, never by the name or the mtime alone. A file with no manifest entry counts as stale.
const OPTIONS_MANIFEST = path.join(OUTPUT_ROOT, '.encode-options.json');

async function readOptionsManifest() {
  try {
    return JSON.parse(await readFile(OPTIONS_MANIFEST, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

const previousOptions = await readOptionsManifest();
const currentOptions = {};

function optionsHash(format, options) {
  return createHash('sha256').update(JSON.stringify([format, options])).digest('hex').slice(0, 16);
}

async function isFresh(output, sourceMtimeMs, hash) {
  if (previousOptions[output] !== hash) return false;
  try {
    return (await stat(output)).mtimeMs >= sourceMtimeMs;
  } catch {
    return false;
  }
}

const claimed = new Map();
let generated = 0;
let skipped = 0;

/** Writes (or skips as fresh) every variant of one image; `pipeline(width)` returns the sharp pipeline sized to that width. */
async function emitVariants(source, relative, isHero, mtimeMs, pipeline) {
  await mkdir(path.dirname(path.join(OUTPUT_ROOT, relative)), { recursive: true });
  for (const [width, isLarge] of widthsFor(source)) for (const [suffix, format, options] of encodingsFor(isHero, isLarge)) {
    const output = path.join(OUTPUT_ROOT, `${relative}-${width}${suffix}.${format}`);
    const key = output.toLowerCase();
    if (claimed.has(key)) {
      throw new Error(`image variant collision: ${source} and ${claimed.get(key)} -> ${output}`);
    }
    claimed.set(key, source);
    const hash = optionsHash(format, options);
    currentOptions[output] = hash;
    if (await isFresh(output, mtimeMs, hash)) {
      skipped += 1;
      continue;
    }
    await (await pipeline(width))[format](options).toFile(output);
    generated += 1;
  }
}

for await (const source of walk(SOURCE_ROOT)) {
  // Source extension stays in the output name so a.jpg and a.png never collide.
  const relative = path
    .relative(SOURCE_ROOT, source)
    .replace(/\.[^.]+$/, (ext) => ext.toLowerCase());
  const { mtimeMs } = await stat(source);
  await emitVariants(source, relative, HERO_SOURCES.has(source), mtimeMs, (width) =>
    sharp(source).resize({ width, withoutEnlargement: true }));
}

/** The rect (and flip) of one manifest entry as raw pixels, decoded once and resized per width. */
async function cutOf(entry) {
  const { x0, y0, x1, y1 } = entry.rect;
  const { width: sourceWidth, height: sourceHeight } = await sharp(entry.from).metadata();
  if (!(x0 >= 0 && y0 >= 0 && x1 > x0 && y1 > y0 && x1 <= sourceWidth && y1 <= sourceHeight)) {
    throw new Error(`${entry.name}: rect ${x0},${y0}-${x1},${y1} is outside ${entry.from} (${sourceWidth}x${sourceHeight})`);
  }
  let cut = sharp(entry.from).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 });
  if (entry.flip) cut = cut.flop();
  return cut.raw().toBuffer({ resolveWithObject: true });
}

const manifestMtimeMs = (await stat(DERIVED_MANIFEST)).mtimeMs;
for (const entry of DERIVED_SOURCES) {
  const relative = `${entry.name}.jpg`;
  const width = entry.rect.x1 - entry.rect.x0;
  if (NATIVE_WIDTHS[`/images/${relative}`] !== width) {
    throw new Error(`${entry.name}: lib/hero-source-widths.json must list /images/${relative} at ${width}`);
  }
  const mtimeMs = Math.max(manifestMtimeMs, (await stat(entry.from)).mtimeMs);
  let cut = null;
  await emitVariants(path.join(SOURCE_ROOT, relative), relative, true, mtimeMs, async (outputWidth) => {
    cut ??= await cutOf(entry);
    return sharp(cut.data, { raw: cut.info }).resize({ width: outputWidth, withoutEnlargement: true });
  });
}
await writeFile(OPTIONS_MANIFEST, `${JSON.stringify(currentOptions)}\n`);
console.log(`image variants: ${generated} generated, ${skipped} up to date`);
