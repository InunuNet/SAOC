// HM-6 and HM-7 deliverable (NOS Design 2026-10-26): candidate sheets for NOS Design's pick. Nothing is implemented in f2; this check
// verifies the evidence exists and the candidates obey the ruled constraints (goldens/f2.json sheets). Usage: node f2-check-sheets.mjs
// The manifest (.tmp/sandbox/heroes2-sheets/manifest.json) lists per candidate: id, route, kind, and for photo candidates source, flip, rect
// {x0,y0,x1,y1} in source pixels, objectPosition, plus `sheet` (the in-situ 1440@2 capture: scrim, h1, chip) and `crop` (the 1:1 left-44%
// crop at 1440@2) as file names inside the sheets dir.
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { F2 } from './f2-lib.mjs';

const require = createRequire(`${process.cwd()}/package.json`);
const sharp = require('sharp');
const S = F2.sheets;
const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };

const iou = (a, b) => {
  const w = Math.min(a.x1, b[3]) - Math.max(a.x0, b[1]); const h = Math.min(a.y1, b[4]) - Math.max(a.y0, b[2]);
  if (w <= 0 || h <= 0) return 0;
  const inter = w * h; const area = (x0, y0, x1, y1) => (x1 - x0) * (y1 - y0);
  return inter / (area(a.x0, a.y0, a.x1, a.y1) + area(b[1], b[2], b[3], b[4]) - inter);
};

check(`manifest ${S.manifest} exists`, existsSync(S.manifest));
const manifest = existsSync(S.manifest) ? JSON.parse(readFileSync(S.manifest, 'utf8')) : { candidates: [] };
for (const spec of S.candidates) {
  const m = manifest.candidates.find((c) => c.id === spec.id);
  check(`candidate ${spec.id} is in the manifest`, Boolean(m));
  if (!m) continue;
  check(`${spec.id} is for ${spec.route}`, m.route === spec.route);
  check(`${spec.id} kind is ${spec.kind}`, m.kind === spec.kind);
  for (const [key, want] of [['sheet', S.inSituWidthPx], ['crop', S.cropWidthPx]]) {
    const file = m[key] ? `${S.dir}/${m[key]}` : '';
    const ok = file && existsSync(file);
    check(`${spec.id} ${key} file exists`, ok, file);
    if (!ok) continue;
    const meta = await sharp(file).metadata();
    const tol = key === 'crop' ? S.cropWidthTolerancePx : 0;
    check(`${spec.id} ${key} is ${want}px wide at 1440@2 (${meta.width})`, Math.abs(meta.width - want) <= tol);
  }
  if (spec.kind !== 'photo') { check(`${spec.id} typographic candidate carries no photograph`, !m.source && !m.rect); continue; }
  const sources = spec.sources ?? [spec.source];
  check(`${spec.id} source ${m.source} is one of ${sources.join(', ')} (pink and yellow stay retired)`, sources.includes(m.source));
  const dims = S.sourceDims[m.source];
  const r = m.rect;
  check(`${spec.id} has a source rect`, Boolean(r));
  if (!dims || !r) continue;
  check(`${spec.id} rect is inside ${dims.join('x')}`, r.x0 >= 0 && r.y0 >= 0 && r.x1 <= dims[0] && r.y1 <= dims[1] && r.x1 > r.x0 && r.y1 > r.y0);
  const w = r.x1 - r.x0; const h = r.y1 - r.y0;
  const required = Math.ceil(Math.max(1440, 480 * (w / h)) * 2);
  check(`${spec.id} served width ${w} >= box x DPR ${required} at 1440@2`, w >= required);
  if (spec.minRectWidth) check(`${spec.id} window ${w} >= ${spec.minRectWidth} wide`, w >= spec.minRectWidth);
  if (spec.flip !== undefined) check(`${spec.id} flip is ${spec.flip}`, m.flip === spec.flip);
  for (const [name, ex] of Object.entries(S.existingRects)) {
    const guarded = (spec.mustNotUse ?? []).includes(name) || (spec.mustDifferFrom ?? []).includes(name);
    if (!guarded || ex[0] !== m.source) continue;
    const v = iou(r, ex);
    check(`${spec.id} differs from ${name}: IoU ${v.toFixed(2)} <= ${S.maxIoUWithExisting}`, v <= S.maxIoUWithExisting);
  }
  if (spec.id === 'societies-slug-a') {
    // "the violet top-right bloom": the window's centre sits in the source's top-right quadrant (this contract's reading; spec-f2.md).
    check(`${spec.id} window centre (${((r.x0 + r.x1) / 2) | 0},${((r.y0 + r.y1) / 2) | 0}) is in the top-right quadrant of ${dims.join('x')}`, (r.x0 + r.x1) / 2 > dims[0] / 2 && (r.y0 + r.y1) / 2 < dims[1] / 2);
  }
}

if (failures.length) { console.error(`f2-check-sheets FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('f2-check-sheets pass');
