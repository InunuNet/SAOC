#!/usr/bin/env node
// Cuts the 4:5 card photographs listed in lib/card-crops.json out of their existing sources.
// The outputs (public/images/cards/*.jpg) are committed; rerun after editing a rect. Fails on a
// window narrower than minWindowWidth, a non-4:5 window, or a window that touches an exclude region.
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC_ROOT = 'public';
const MAX_OUTPUT_WIDTH = 2048;
const JPEG_QUALITY = 88;
const ASPECT = 4 / 5;
const ASPECT_TOLERANCE = 0.002;

const { minWindowWidth, crops } = JSON.parse(await readFile('lib/card-crops.json', 'utf8'));

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

for (const [dest, { source, rect, exclude = [] }] of Object.entries(crops)) {
  if (rect.w < minWindowWidth) throw new Error(`${dest}: window ${rect.w}px is under ${minWindowWidth}px`);
  if (Math.abs(rect.w / rect.h - ASPECT) > ASPECT_TOLERANCE) throw new Error(`${dest}: window is not 4:5`);
  for (const region of exclude) {
    if (overlaps(rect, region)) throw new Error(`${dest}: window overlaps ${region.name}`);
  }
  const output = path.join(PUBLIC_ROOT, dest);
  await mkdir(path.dirname(output), { recursive: true });
  await sharp(path.join(PUBLIC_ROOT, source))
    .extract({ left: rect.x, top: rect.y, width: rect.w, height: rect.h })
    .resize({ width: MAX_OUTPUT_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(output);
  console.log(`${dest} <- ${source} ${rect.w}x${rect.h}`);
}
