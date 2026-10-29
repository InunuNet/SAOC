// Derives the site favicon set from the supplied emblem PNG (F1e lever 4). Crops and scales only,
// never redraws. Usage (from the project root): node scripts/generate-favicon.mjs [source.png] [renderDir]
//   source   '-' or omitted, default: the path recorded in goldens/favicon-source.json (swap the emblem by editing that file)
//   renderDir  optional: also writes favicon-16/32/48/180.png review renders there
// Outputs: app/favicon.ico (16+32+48), app/icon.png (32), app/icon1.png (48), app/apple-icon.png (180).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SPEC = '.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/goldens/favicon-source.json';
const APPLE_SIZE = 180;
const APPLE_BG = '#F4F3EC';
const APPLE_FLOWER_SHARE = 0.76;
const TRIM_THRESHOLD = 25;
const PNG_OPTS = { palette: true, quality: 90, effort: 10, compressionLevel: 9 };

const src = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : JSON.parse(readFileSync(SPEC, 'utf8')).path;
const renderDir = process.argv[3];

// The artwork's own bounds (a crop of the supplied file), flattened-white background trimmed.
async function flowerCrop() {
  const flat = await sharp(src).flatten({ background: '#ffffff' }).png().toBuffer();
  const { info } = await sharp(flat).trim({ background: '#ffffff', threshold: TRIM_THRESHOLD }).toBuffer({ resolveWithObject: true });
  const left = -(info.trimOffsetLeft ?? 0);
  const top = -(info.trimOffsetTop ?? 0);
  return sharp(src).extract({ left, top, width: info.width, height: info.height }).png().toBuffer();
}

// Fit the cropped flower into a transparent square with a 1px margin.
async function tabIcon(crop, size) {
  const inner = size - 2;
  const fitted = await sharp(crop).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'centre' }]).png(PNG_OPTS).toBuffer();
}

// iOS turns transparency black: an opaque square, flower at ~76% of the cell.
async function appleIcon(crop) {
  const inner = Math.round(APPLE_SIZE * APPLE_FLOWER_SHARE);
  const fitted = await sharp(crop).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' }).png().toBuffer();
  return sharp({ create: { width: APPLE_SIZE, height: APPLE_SIZE, channels: 3, background: APPLE_BG } })
    .composite([{ input: fitted, gravity: 'centre' }]).png(PNG_OPTS).toBuffer();
}

// ICO container holding PNG-compressed images.
function buildIco(entries) {
  const head = Buffer.alloc(6 + 16 * entries.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(entries.length, 4);
  let offset = head.length;
  entries.forEach(({ size, png }, i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(size, o);
    head.writeUInt8(size, o + 1);
    head.writeUInt16LE(1, o + 4);
    head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(png.length, o + 8);
    head.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...entries.map((e) => e.png)]);
}

const crop = await flowerCrop();
const [p16, p32, p48, p180] = [await tabIcon(crop, 16), await tabIcon(crop, 32), await tabIcon(crop, 48), await appleIcon(crop)];
writeFileSync('app/favicon.ico', buildIco([{ size: 16, png: p16 }, { size: 32, png: p32 }, { size: 48, png: p48 }]));
writeFileSync('app/icon.png', p32);
writeFileSync('app/icon1.png', p48);
writeFileSync('app/apple-icon.png', p180);
if (renderDir) {
  mkdirSync(renderDir, { recursive: true });
  for (const [n, b] of [[16, p16], [32, p32], [48, p48], [180, p180]]) writeFileSync(join(renderDir, `favicon-${n}.png`), b);
}
console.log('favicon set written', { ico: 'app/favicon.ico', icon: p32.length, icon1: p48.length, apple: p180.length });
