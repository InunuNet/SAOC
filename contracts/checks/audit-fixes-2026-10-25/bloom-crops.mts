// 1:1 bloom crop artifact at 2056@2 for every hero, for NOS Design to inspect for banding or blocking.
//   write   regenerate .agent/memory/project/specs/audit-fixes-2026-10-25/artifacts/bloom-crops/<name>-2056x2.png
//   check   each artifact exists, is 800x800, equals a fresh crop of the file now served at 2056@2 (a stale
//           artifact fails), and stays within PSNR_FLOOR dB of the same crop encoded at the old q88.
// The crop is 800x800 device pixels (1:1 at DPR 2) centred on the photograph's focal point, taken from
// components/nos/hero-photos.ts objectPosition (first route that uses the photo), else the centre.
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import { HERO_PHOTOS } from '../../../components/nos/hero-photos.ts';
import { HERO_NAMES, VIEWPORTS, candidateWidth, filePathOf, heroSrc, pixelWidthOf, servedUrl } from './_hero.mts';

const MODE = process.argv[2];
const OUT_DIR = '.agent/memory/project/specs/audit-fixes-2026-10-25/artifacts/bloom-crops';
const CROP = 800;
// Measured when this contract was written (center crops, 4112px, new q75/q80 against old q88):
// purple 33.1/34.7, dark 34.8/36.0, violet 37.7/38.8, pink 40.9/41.8, yellow 43.0/43.9. Below 32 dB is
// visibly worse than any of those.
const PSNR_FLOOR = 32;
const VP = VIEWPORTS[0];

function focal(name: string): [number, number] {
  const entry = Object.values(HERO_PHOTOS).find((p) => p.src === heroSrc(name));
  const [x, y] = (entry?.objectPosition ?? '50% 50%').split(' ').map((v) => parseFloat(v));
  return [x, y];
}

async function crop(input: Buffer | string, name: string): Promise<{ png: Buffer; raw: Buffer }> {
  const meta = await sharp(input).metadata();
  const [x, y] = focal(name);
  const region = {
    left: Math.round(((meta.width ?? CROP) - CROP) * (x / 100)),
    top: Math.round(((meta.height ?? CROP) - CROP) * (y / 100)),
    width: CROP,
    height: CROP,
  };
  const base = sharp(input).extract(region).removeAlpha();
  return { png: await base.clone().png().toBuffer(), raw: await base.raw().toBuffer() };
}

function psnr(a: Buffer, b: Buffer): number {
  let se = 0;
  for (let i = 0; i < a.length; i += 1) se += (a[i] - b[i]) ** 2;
  return 10 * Math.log10((255 * 255) / (se / a.length || 1e-9));
}

const problems: string[] = [];
mkdirSync(OUT_DIR, { recursive: true });

for (const name of HERO_NAMES) {
  const url = servedUrl(name, candidateWidth(VP.width * VP.dpr));
  const served = await crop(filePathOf(url), name);
  const reference = await crop(
    await sharp(path.join('public', heroSrc(name))).resize({ width: await pixelWidthOf(url), withoutEnlargement: true })
      .webp({ quality: 88, smartSubsample: true }).toBuffer(),
    name,
  );
  const artifact = path.join(OUT_DIR, `${name}-2056x2.png`);
  if (MODE === 'write') {
    await sharp(served.png).toFile(artifact);
    console.log(`wrote ${artifact} (from ${url})`);
    continue;
  }
  if (!existsSync(artifact)) { problems.push(`${artifact}: missing (run bloom-crops.mts write)`); continue; }
  const onDisk = sharp(artifact);
  const meta = await onDisk.metadata();
  if (meta.width !== CROP || meta.height !== CROP) problems.push(`${artifact}: ${meta.width}x${meta.height}, want ${CROP}x${CROP}`);
  const diskRaw = await onDisk.removeAlpha().raw().toBuffer();
  if (!diskRaw.equals(served.raw)) problems.push(`${artifact}: stale, differs from the file now served at 2056@2 (${url})`);
  const db = psnr(reference.raw, served.raw);
  console.log(`${name}: PSNR vs q88 reference ${db.toFixed(1)} dB`);
  if (db < PSNR_FLOOR) problems.push(`${name}: PSNR ${db.toFixed(1)} dB below ${PSNR_FLOOR}`);
}

if (!['write', 'check'].includes(MODE ?? '')) problems.push('usage: bloom-crops.mts write|check');
if (problems.length) {
  console.error('FAIL\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`ok: bloom crops ${MODE}`);
