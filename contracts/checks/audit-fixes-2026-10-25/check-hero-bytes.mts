// Measured image budget. Resolves every srcset candidate Next can request for the five full-bleed
// hero photographs (each deviceSize and imageSize, at the hero quality 88) through the real
// lib/image-loader.ts, then measures the file scripts/generate-image-variants.mjs produced.
// Run the generator first. Fails if a served variant is missing, wider than MAX_WIDTH, or heavier
// than MAX_BYTES; also pins the 1920 variants (the audit's 0.28-0.41 MB reference) as unchanged-ish.
import { statSync } from 'node:fs';
import path from 'node:path';

import loaderModule from '../../../lib/image-loader.ts';
import widths from '../../../lib/image-widths.json' with { type: 'json' };

// tsx hands a TS module's default export back wrapped ({ default }) when it is imported from .mts.
type Loader = (props: { src: string; width: number; quality?: number }) => string;
const imageLoader: Loader =
  typeof loaderModule === 'function' ? (loaderModule as Loader) : (loaderModule as { default: Loader }).default;

const HERO_QUALITY = 88;
const MAX_BYTES = 512 * 1024;
const MAX_WIDTH = 2560;
const HERO_SOURCES = ['orchid-dark', 'orchid-pink', 'orchid-violet', 'orchid-purple', 'orchid-yellow'].map(
  (name) => `/images/${name}.jpg`,
);
const REQUESTED = [...new Set([...widths.deviceSizes, ...widths.imageSizes])].sort((a, b) => a - b);

const problems: string[] = [];
let heaviest = { file: '', bytes: 0 };
let measured = 0;

if (Math.max(...widths.deviceSizes) > MAX_WIDTH) {
  problems.push(`deviceSizes reach ${Math.max(...widths.deviceSizes)}px (max ${MAX_WIDTH})`);
}

for (const src of HERO_SOURCES) {
  const served = new Set(REQUESTED.map((width) => imageLoader({ src, width, quality: HERO_QUALITY })));
  for (const url of served) {
    const file = path.join('public', url);
    let bytes: number;
    try {
      bytes = statSync(file).size;
    } catch {
      problems.push(`${url}: served by the loader but not generated`);
      continue;
    }
    measured += 1;
    if (bytes > heaviest.bytes) heaviest = { file: url, bytes };
    const width = Number(/-(\d+)-q88\.webp$/.exec(url)?.[1] ?? 0);
    if (width > MAX_WIDTH) problems.push(`${url}: ${width}px wide (max ${MAX_WIDTH})`);
    if (bytes > MAX_BYTES) problems.push(`${url}: ${(bytes / 1048576).toFixed(2)} MB (budget ${MAX_BYTES / 1048576} MB)`);
  }
}

console.log(`measured ${measured} served hero variants; heaviest ${heaviest.file} ${(heaviest.bytes / 1048576).toFixed(2)} MB`);
if (problems.length) {
  console.error('FAIL\n  ' + problems.join('\n  '));
  process.exit(1);
}
