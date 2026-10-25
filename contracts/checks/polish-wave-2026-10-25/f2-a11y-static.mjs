// F2 static (vendor forms a11y). Sources: WCAG 2.5.8 target size (>=24px control, label row >=44px
// by site convention, see VendorCheckboxGroupField's existing min-h-11 row), WCAG 1.4.11 focus
// indicator >=3:1. The focus colour is the existing chrome ring (focus-visible:ring-primary, e.g.
// components/chrome/Header.tsx:94, MobileMenu.tsx:105); no new colour, no new token.
//   1. checkbox and radio controls are >=24px (size-6 / h-6 w-6 or larger / size-[Npx>=24])
//   2. every file that owns a checkbox/radio keeps a >=44px label row (min-h-11)
//   3. `ring-ink/40` (the 12 weak focus rings) appears nowhere under components/vendors
//   4. `ring-primary` is used at least as often as the 12 sites it replaces, and its colour
//      clears 3:1 against ivory, bone and parchment (computed from app/globals.css)
// Run as: node contracts/checks/polish-wave-2026-10-25/f2-a11y-static.mjs   (POLISH_ROOT optional)
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { contrast, finish, parseHex, read, repoRoot } from './_lib.mjs';

const failures = [];
const CONTROL_FILES = [
  'components/vendors/VendorCheckboxField.tsx',
  'components/vendors/VendorCheckboxGroupField.tsx',
  'components/vendors/VendorRadioGroupField.tsx',
  'components/vendors/VendorBooleanRadioField.tsx',
];

function controlPx(cls) {
  const size = cls.match(/\bsize-(\d+(?:\.\d+)?)\b/);
  if (size) return Number(size[1]) * 4;
  const px = cls.match(/\bsize-\[(\d+)px\]/);
  if (px) return Number(px[1]);
  const h = cls.match(/\bh-(\d+(?:\.\d+)?)\b/);
  const w = cls.match(/\bw-(\d+(?:\.\d+)?)\b/);
  if (h && w) return Math.min(Number(h[1]), Number(w[1])) * 4;
  return 0;
}

for (const rel of CONTROL_FILES) {
  const src = read(rel);
  const m = src.match(/const checkboxClass =\s*['`]([^'`]+)['`]|const radioClass =\s*['`]([^'`]+)['`]|const (?:\w*[cC]ontrol\w*|inputClass) =\s*['`]([^'`]+)['`]/);
  const cls = m ? (m[1] ?? m[2] ?? m[3]) : '';
  if (!cls) { failures.push(`${rel}: could not find the control class constant (checkboxClass / radioClass)`); continue; }
  const px = controlPx(cls);
  if (px < 24) failures.push(`${rel}: control is ${px}px, want >=24px (${cls.slice(0, 60)}...)`);
  if (!/\bmin-h-11\b|\bmin-h-\[44px\]/.test(src)) failures.push(`${rel}: no min-h-11 label row (>=44px hit area)`);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)]));
}
let weak = 0;
let strong = 0;
for (const file of walk(resolve(repoRoot, 'components/vendors')).filter((f) => /\.(tsx|ts)$/.test(f))) {
  const src = read(file.slice(repoRoot.length + 1));
  weak += (src.match(/ring-ink\/40/g) ?? []).length;
  strong += (src.match(/focus(?:-visible)?:ring-primary\b/g) ?? []).length;
}
if (weak > 0) failures.push(`ring-ink/40 still appears ${weak} time(s) under components/vendors`);
if (strong < 12) failures.push(`focus ring-primary appears ${strong} time(s) under components/vendors, want >=12 (the sites ring-ink/40 held)`);

const css = read('app/globals.css');
const tok = (name) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
const primary = tok('primary');
if (!primary) failures.push('--primary not found in app/globals.css');
else {
  for (const ground of ['ivory', 'bone', 'parchment']) {
    const g = tok(ground);
    if (!g) { failures.push(`--${ground} not found in app/globals.css`); continue; }
    const c = contrast(parseHex(primary), parseHex(g));
    if (c < 3) failures.push(`primary ${primary} on ${ground} ${g} is ${c.toFixed(2)}:1, want >=3:1`);
  }
}
finish('f2-a11y-static', failures);
