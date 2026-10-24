// Measured hero image checks, run after scripts/generate-image-variants.mjs.
//   budget     every srcset candidate exists and is <= 2 MiB; the file served at each of the four
//              viewports is within its byte ceiling; the generator never encodes below quality 75.
//   viewports  NOS Design's served-width gate: the file served at 2056@2, 1440@2, 1280@2 and 390@3 is at
//              least min(box x DPR, the photograph's native width) real pixels wide (read from the file).
import { readFileSync } from 'node:fs';

import {
  DEVICE_SIZES, VIEWPORTS, HERO_NAMES, bytesOf, candidateWidth, nativeWidthOf, pixelWidthOf, servedUrl,
} from './_hero.mts';

const MODE = process.argv[2];
const MAX_CANDIDATE_BYTES = 2 * 1024 * 1024;
const MIN_QUALITY = 75; // NOS Design guard: cut bytes through format and quality, about q75-82, not dimensions
const mib = (bytes: number) => `${(bytes / 1048576).toFixed(2)} MiB`;
const problems: string[] = [];

if (MODE === 'budget') {
  for (const name of HERO_NAMES) {
    for (const width of DEVICE_SIZES) {
      const url = servedUrl(name, width);
      try {
        if (bytesOf(url) > MAX_CANDIDATE_BYTES) problems.push(`${url}: ${mib(bytesOf(url))} (candidate ceiling ${mib(MAX_CANDIDATE_BYTES)})`);
      } catch {
        problems.push(`${url}: served by the loader but not generated`);
      }
    }
    for (const vp of VIEWPORTS) {
      const url = servedUrl(name, candidateWidth(vp.width * vp.dpr));
      try {
        if (bytesOf(url) > vp.maxBytes) problems.push(`${name} @ ${vp.label}: ${url} is ${mib(bytesOf(url))} (ceiling ${mib(vp.maxBytes)})`);
      } catch { /* already reported above as not generated */ }
    }
  }
  const generator = readFileSync('scripts/generate-image-variants.mjs', 'utf8');
  const qualities = [...generator.matchAll(/quality\s*[:=]\s*(\d+)|QUALITY\w*\s*=\s*(\d+)/g)].map((m) => Number(m[1] ?? m[2]));
  for (const q of qualities) if (q < MIN_QUALITY) problems.push(`generate-image-variants.mjs encodes at quality ${q} (floor ${MIN_QUALITY})`);
} else if (MODE === 'viewports') {
  for (const name of HERO_NAMES) {
    const native = await nativeWidthOf(name);
    for (const vp of VIEWPORTS) {
      const needed = Math.min(vp.width * vp.dpr, native);
      const url = servedUrl(name, candidateWidth(vp.width * vp.dpr));
      try {
        const served = await pixelWidthOf(url);
        console.log(`${name} @ ${vp.label}: needs ${needed}px, serves ${served}px (${url})`);
        if (served < needed) problems.push(`${name} @ ${vp.label}: serves ${served}px, needs ${needed}px`);
      } catch {
        problems.push(`${name} @ ${vp.label}: ${url} not generated`);
      }
    }
  }
} else {
  problems.push('usage: check-hero-bytes.mts budget|viewports');
}

if (problems.length) {
  console.error('FAIL\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`ok: hero ${MODE}`);
