#!/usr/bin/env node
// A4/A5/A6 — the header/mobile raster is regenerated at W2 under a NEW
// filename (cache-safe), the old W0 raster is gone, Header + MobileMenu point
// at the new file with a non-distorting aspect ratio, the accessible names
// are unchanged, and the exporter is wired for WM:1 with an output-dir
// override. Run from the repo (worktree) root.
import { readFileSync, existsSync } from 'node:fs';

const NEW = 'public/images/saoc-lockup-horizontal-full-name.png';
const OLD = 'public/images/saoc-lockup-horizontal.png';
const fail = (m) => { console.error('FAIL: ' + m); process.exit(1); };

if (!existsSync(NEW)) fail(`${NEW} missing`);
if (existsSync(OLD)) fail(`${OLD} (W0 raster) still present`);

const buf = readFileSync(NEW);
if (buf.toString('latin1', 1, 4) !== 'PNG') fail('not a PNG');
const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
const aspect = w / h;
// W0 was 2715x493 = 5.507. W2 is ~1.5-1.7x wider text on the same stack height.
if (aspect < 6.8 || aspect > 9.5) fail(`aspect ${aspect.toFixed(3)} outside the W2 band 6.8-9.5 (W0 was 5.507)`);

const exporter = readFileSync('scripts/export-saoc-lockup.mjs', 'utf8');
if (!/saoc-lockup-horizontal-full-name\.png/.test(exporter)) fail('exporter does not write the new filename');
if (!/WM\s*:\s*1\b/.test(exporter)) fail('exporter does not pass WM:1 (W2) to the harness');
if (!/SAOC_LOCKUP_OUT_DIR/.test(exporter)) fail('exporter lacks SAOC_LOCKUP_OUT_DIR override');
const idx = readFileSync('scripts/lockup-export-harness/index.html', 'utf8');
if (!/params\.has\('WM'\)\s*\)\s*comp\.state\.WM\s*=\s*Number\(params\.get\('WM'\)\)/.test(idx)) fail('harness index.html does not read the WM query param');

for (const [file, label] of [['components/chrome/Header.tsx', 'Header'], ['components/chrome/MobileMenu.tsx', 'MobileMenu']]) {
  const src = readFileSync(file, 'utf8');
  if (/saoc-lockup-horizontal\.png/.test(src)) fail(`${label} still references the W0 raster`);
  if (!/saoc-lockup-horizontal-full-name\.png/.test(src)) fail(`${label} does not reference the new raster`);
  // every <Image ...> carrying the new raster: width/height props must match the PNG aspect within 1%
  const tags = src.match(/<Image[^>]*saoc-lockup-horizontal-full-name\.png[^>]*>/gs) ?? [];
  if (!tags.length) fail(`${label}: no <Image> tag for the new raster`);
  for (const t of tags) {
    const mw = t.match(/width=\{(\d+)\}/), mh = t.match(/height=\{(\d+)\}/);
    if (!mw || !mh) fail(`${label}: <Image> lacks numeric width/height`);
    const r = Number(mw[1]) / Number(mh[1]);
    if (Math.abs(r - aspect) / aspect > 0.01) fail(`${label}: width/height ${r.toFixed(3)} distorts the PNG (${aspect.toFixed(3)})`);
  }
}

// A6 — accessible label unchanged.
const header = readFileSync('components/chrome/Header.tsx', 'utf8');
if (!header.includes('aria-label="South African Orchid Council — Making a difference since 1968"')) fail('Header aria-label changed');
const mm = readFileSync('components/chrome/MobileMenu.tsx', 'utf8');
if (!/alt="South African Orchid Council"/.test(mm)) fail('MobileMenu alt changed');
if (!readFileSync('components/chrome/SaocLockup.tsx', 'utf8').includes('const ACCESSIBLE_LABEL = `South African Orchid Council — ${TAGLINE}`;')) fail('SaocLockup ACCESSIBLE_LABEL changed');

console.log(`OK: ${NEW} ${w}x${h} (aspect ${aspect.toFixed(3)}), old raster gone, Header/MobileMenu wired non-distorting, labels unchanged, exporter wired for WM:1`);
