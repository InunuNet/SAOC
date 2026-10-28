// Pure verdicts for the NOS Design 768 cut (H-a 768 cut (a), 2026-10-27): the single-row header from 768 up, the unchanged-header proof below 768, the
// unchanged band/crop/spacing values and the P1 countdown label rule. Used by gate-hub-header.mjs, gate-hub-countdown.mjs and selftest.mjs.
import { VALUES } from './_lib.mjs';

const H = VALUES.hub.header;
const U = VALUES.hub.unchanged;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const midY = (r) => (r.top + r.bottom) / 2;

// m: { barDisplay, brand, cta, burger (rects), heroTop, lockup: { w, h } }; ref: the same measurement at the reference width (820), same mode, same run.
export function oneRowVerdict(m, ref) {
  const out = [];
  if (m.barDisplay !== 'flex') out.push(`header bar is display ${m.barDisplay}, expected flex (the 820 row)`);
  if (!near(midY(m.brand), midY(m.cta), H.oneRowCentreTolerancePx)) out.push(`Tickets is not on the lockup's row (centres ${midY(m.cta).toFixed(1)} vs ${midY(m.brand).toFixed(1)})`);
  if (!near(midY(m.brand), midY(m.burger), H.oneRowCentreTolerancePx)) out.push(`Menu is not on the lockup's row (centres ${midY(m.burger).toFixed(1)} vs ${midY(m.brand).toFixed(1)})`);
  if (!near(m.heroTop, ref.heroTop, H.heroTopTolerancePx)) out.push(`hero top ${m.heroTop.toFixed(1)} is not the 820 value ${ref.heroTop.toFixed(1)} +-${H.heroTopTolerancePx}`);
  if (!near(m.heroTop, H.heroTopAt820Px, H.heroTopTolerancePx)) out.push(`hero top ${m.heroTop.toFixed(1)} is not the measured 820 golden ${H.heroTopAt820Px} +-${H.heroTopTolerancePx}`);
  if (!near(m.lockup.w, ref.lockup.w, H.lockupTolerancePx) || !near(m.lockup.h, ref.lockup.h, H.lockupTolerancePx)) out.push(`lockup box ${m.lockup.w.toFixed(1)}x${m.lockup.h.toFixed(1)} is not the 820 box ${ref.lockup.w.toFixed(1)}x${ref.lockup.h.toFixed(1)} +-${H.lockupTolerancePx}`);
  return out;
}

// Below 768 the header stays the two-row grid: lockup on its own first row, Tickets and Menu under it.
export function twoRowVerdict(m) {
  const out = [];
  if (m.barDisplay !== 'grid') out.push(`header bar is display ${m.barDisplay}, expected the unchanged grid`);
  if (!(m.cta.top >= m.brand.bottom - 1)) out.push(`Tickets (top ${m.cta.top.toFixed(1)}) is not below the lockup (bottom ${m.brand.bottom.toFixed(1)}): the <768 header changed`);
  return out;
}

// Band, crop and spacing are exactly what the approved H-a measurement holds (64221fb0): nothing was cut to make room.
export function unchangedVerdict(m) {
  const out = [];
  if (m.fit !== U.cropFit) out.push(`object-fit ${m.fit}, expected ${U.cropFit}`);
  if (m.pos !== U.cropPosition) out.push(`object-position ${m.pos}, expected ${U.cropPosition}`);
  for (const [key, want] of Object.entries(U.spacingPx)) if (m.spacing[key] !== want) out.push(`${key} is ${m.spacing[key]}px, expected ${want}px (no spacing or padding change)`);
  return out;
}

// Exact RGBA comparison of two decoded PNGs ({ width, height, data }); tolerance is a count of differing pixels.
export function pixelDiff(a, b) {
  if (a.width !== b.width || a.height !== b.height) return { ok: false, detail: `size ${a.width}x${a.height} vs ${b.width}x${b.height}`, diff: -1 };
  let diff = 0; let minX = a.width; let minY = a.height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      const i = (y * a.width + x) << 2;
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) { diff += 1; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
  }
  const bbox = diff ? { minX, minY, maxX, maxY } : null;
  const total = a.width * a.height;
  return { ok: diff <= H.pixelTolerance, detail: `${diff} differing pixel(s) of ${total}${bbox ? `, bbox x${minX}-${maxX} y${minY}-${maxY}` : ''}`, diff, bbox };
}

// P1: the label never shows without its value. states: every sampled state { label: bool (rendered, visible), value: bool (a visible, non-empty value in the same block) }.
export function labelWithoutValue(states) {
  return states.filter((s) => s.label && !s.value);
}

const rect = (top, h) => ({ top, bottom: top + h });
const goodRow = { barDisplay: 'flex', brand: rect(14, 70), cta: rect(27, 44), burger: rect(27, 44), heroTop: 97, lockup: { w: 405, h: 70 } };
export function selftest() {
  const bad = [];
  const expect = (name, got, want) => { if (got !== want) bad.push(`${name}: expected ${want ? 'pass' : 'fail'}`); };
  expect('the 820 row is accepted against itself', oneRowVerdict(goodRow, goodRow).length === 0, true);
  expect('the two-row 768 header (grid, hero top 155) is rejected as a one-row header', oneRowVerdict({ ...goodRow, barDisplay: 'grid', cta: rect(100, 44), burger: rect(100, 44), heroTop: 155 }, goodRow).length === 0, false);
  expect('a hero top 2px off the 820 value is rejected', oneRowVerdict({ ...goodRow, heroTop: 99 }, goodRow).length === 0, false);
  expect('a hero top 1px off is accepted', oneRowVerdict({ ...goodRow, heroTop: 98 }, goodRow).length === 0, true);
  expect('a lockup box 3px wider than the 820 box is rejected', oneRowVerdict({ ...goodRow, lockup: { w: 408, h: 70 } }, goodRow).length === 0, false);
  expect('Menu on a second row is rejected', oneRowVerdict({ ...goodRow, burger: rect(100, 44) }, goodRow).length === 0, false);
  const two = { barDisplay: 'grid', brand: rect(16, 70), cta: rect(94, 44), burger: rect(94, 44) };
  expect('the unchanged two-row header below 768 is accepted', twoRowVerdict(two).length === 0, true);
  expect('a one-row header below 768 is rejected as a changed <768 header', twoRowVerdict({ ...two, barDisplay: 'flex', cta: rect(27, 44) }).length === 0, false);
  const unc = { fit: 'cover', pos: '68% 50%', spacing: { ...U.spacingPx } };
  expect('the approved band, crop and spacing are accepted', unchangedVerdict(unc).length === 0, true);
  expect('a 36px copy padding (a cut) is rejected', unchangedVerdict({ ...unc, spacing: { ...U.spacingPx, copyPaddingTopPx: 36 } }).length === 0, false);
  expect('a moved crop (50% 50%) is rejected', unchangedVerdict({ ...unc, pos: '50% 50%' }).length === 0, false);
  const img = (v) => ({ width: 2, height: 1, data: Buffer.from([v, 0, 0, 255, 0, 0, 0, 255]) });
  expect('identical captures diff 0 and pass', pixelDiff(img(5), img(5)).ok, true);
  expect('a one-pixel colour change fails the exact diff', pixelDiff(img(5), img(6)).ok, false);
  expect('a differing pixel reports its bounding box', pixelDiff(img(5), img(6)).bbox.maxX === 0, true);
  expect('a size change fails the diff', pixelDiff(img(5), { width: 3, height: 1, data: Buffer.alloc(12) }).ok, false);
  expect('a state with the label and no value is reported', labelWithoutValue([{ label: true, value: false }]).length === 0, false);
  expect('label with value, and neither label nor value, are accepted', labelWithoutValue([{ label: true, value: true }, { label: false, value: false }]).length === 0, true);
  return bad;
}
