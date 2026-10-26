// The derived hero sources (NOS Design's final crop picks, goldens/crop-map.json `derived`): rect cuts and horizontal flips emitted by the
// image-variant pipeline as build-time variants (never a CSS transform, never a committed JPEG). Needs the A7 build. For every entry with a
// ruled rect: the dev's manifest lib/hero-derived-sources.json matches the golden (name, rect, flip); the rect is inside the source; the
// source window of its feature (clip, stake, hardware) contributes no more than probeMaxPixels matching pixels (NOS Design: no clips, stakes
// or stem ends); lib/hero-source-widths.json lists /images/<name>.jpg at the rect width; and the largest built variant
// public/images/_opt/<name>.jpg-<W>-q88.webp is W x H and matches sharp's own cut (flipped when ruled) within mean abs diff and PSNR
// limits (webp noise); a flipped entry must match the flipped cut clearly better than the unflipped one, so a missing or doubled flip fails.
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { GOLDEN, T } from './_lib.mjs';

const require = createRequire(`${process.cwd()}/package.json`);
const sharp = require('sharp');
const fail = [];
const check = (name, ok, detail = '') => { if (!ok) fail.push(`${name}${detail ? `: ${detail}` : ''}`); };
const dev = existsSync('lib/hero-derived-sources.json') ? JSON.parse(readFileSync('lib/hero-derived-sources.json', 'utf8')) : null;
check('lib/hero-derived-sources.json exists (the generator reads it)', Array.isArray(dev));
const widths = existsSync('lib/hero-source-widths.json') ? JSON.parse(readFileSync('lib/hero-source-widths.json', 'utf8')) : {};

const PRED = { dark: (r, g, b) => r < 45 && g < 45 && b < 50, teal: (r, g, b) => g > r + 12 && b > r + 12 && g > 60 && g < 170 };
async function probeCount(entry, rect) {
  const pr = GOLDEN.probes[entry.probe];
  if (!pr) return 0;
  const [wx0, wx1, wy0, wy1] = pr.window;
  const x0 = Math.max(wx0, rect.x0), x1 = Math.min(wx1, rect.x1), y0 = Math.max(wy0, rect.y0), y1 = Math.min(wy1, rect.y1);
  if (x1 <= x0 || y1 <= y0) return 0;
  const { data, info } = await sharp(entry.from).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 0; i < data.length; i += info.channels * 2) if (PRED[pr.pixel](data[i], data[i + 1], data[i + 2])) n += 1;
  return n;
}
const stats = (a, b) => { let abs = 0; let sq = 0; for (let i = 0; i < a.length; i += 1) { const d = a[i] - b[i]; abs += Math.abs(d); sq += d * d; } const mse = sq / a.length; return { mad: abs / a.length, psnr: mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse) }; };

for (const entry of GOLDEN.derived) {
  const tag = `[${entry.name}]`;
  if (entry.rect === 'pending') { console.log(`${tag} rect pending NOS Design (A16 names it); minWidth ${entry.minWidth}, y1Max ${entry.y1Max}`); continue; }
  const { x0, y0, x1, y1 } = entry.rect;
  const w = x1 - x0, h = y1 - y0;
  const meta = await sharp(entry.from).metadata();
  check(`${tag} rect ${x0},${y0}-${x1},${y1} is inside ${meta.width}x${meta.height}`, x0 >= 0 && y0 >= 0 && x1 <= meta.width && y1 <= meta.height);
  if (entry.stub) check(`${tag} rect does not intersect the stem stub x${entry.stub.x0}-${entry.stub.x1} y${entry.stub.y0}-${entry.stub.y1}`, !(x0 < entry.stub.x1 && x1 > entry.stub.x0 && y0 < entry.stub.y1 && y1 > entry.stub.y0));
  if (entry.stub?.y1Max) check(`${tag} y1 ${y1} <= ${entry.stub.y1Max} (clears the stem stub by ${entry.stub.y0 - y1} native px)`, y1 <= entry.stub.y1Max);
  const n = await probeCount(entry, entry.rect);
  check(`${tag} no ${GOLDEN.probes[entry.probe]?.desc} in the rect: ${n} matching pixels <= ${T.probeMaxPixels}`, n <= T.probeMaxPixels);
  const m = dev?.find((e) => e.name === entry.name);
  check(`${tag} is in lib/hero-derived-sources.json with the ruled rect and flip`, Boolean(m) && JSON.stringify([m.rect.x0, m.rect.y0, m.rect.x1, m.rect.y1]) === JSON.stringify([x0, y0, x1, y1]) && Boolean(m.flip) === entry.flip && String(m.from).endsWith(entry.from.split('/').pop()), JSON.stringify(m));
  check(`${tag} hero-source-widths.json lists /images/${entry.name}.jpg at ${w}`, widths[`/images/${entry.name}.jpg`] === w, String(widths[`/images/${entry.name}.jpg`]));
  const file = `public/images/_opt/${entry.name}.jpg-${w}-q88.webp`;
  if (!existsSync(file)) { check(`${tag} built variant ${file} exists (run after the A7 build)`, false); continue; }
  const got = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  check(`${tag} built variant is ${w}x${h}`, got.info.width === w && got.info.height === h, `${got.info.width}x${got.info.height}`);
  if (got.info.width !== w || got.info.height !== h) continue;
  let cut = sharp(entry.from).extract({ left: x0, top: y0, width: w, height: h });
  const plain = await cut.clone().removeAlpha().raw().toBuffer();
  const want = entry.flip ? await cut.clone().flop().removeAlpha().raw().toBuffer() : plain;
  const s = stats(got.data, want);
  check(`${tag} built variant matches the ${entry.flip ? 'flipped ' : ''}cut: mean abs diff ${s.mad.toFixed(2)} <= ${T.derivedWebpMeanAbsDiffMax}, PSNR ${s.psnr.toFixed(1)} >= ${T.derivedWebpPsnrMin}`, s.mad <= T.derivedWebpMeanAbsDiffMax && s.psnr >= T.derivedWebpPsnrMin);
  if (entry.flip) { const u = stats(got.data, plain); check(`${tag} the flip is real: unflipped mean abs diff ${u.mad.toFixed(2)} is clearly worse than flipped ${s.mad.toFixed(2)}`, u.mad > s.mad + 2); }
  console.log(`${tag} ok-so-far: ${w}x${h}, mean abs diff ${s.mad.toFixed(2)}, PSNR ${s.psnr.toFixed(1)}, probe pixels ${n}`);
}
if (fail.length) { console.error(`check-derived FAILED:\n- ${fail.join('\n- ')}`); process.exit(1); }
console.log('check-derived pass');
