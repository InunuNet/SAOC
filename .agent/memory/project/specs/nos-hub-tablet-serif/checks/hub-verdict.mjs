// Pure verdict functions for the hub geometry gate, so the gate's logic is itself testable without a browser (selftest below).
// A measurement is { hero, media, copy, h1, vw, vh, natural, dpr, boxW, css: { position, aspectRatio, order, mask, scrim }, h1Size } with
// page-coordinate rects { top, bottom, left, right, width, height }.
import { VALUES } from './_lib.mjs';

const near = (a, b, tol) => Math.abs(a - b) <= tol;

/** NOS Design served-width ruling: required device px = ceil(max(boxW, boxH x srcW/srcH) x DPR). object-fit: cover paints the larger of the two. */
export function coverRequired(boxW, boxH, aspect, dpr) {
  return Math.ceil(Math.max(boxW, boxH * aspect) * dpr);
}

/** 768-1023: photo first as a 2/1 band, then the copy. Returns an array of failure strings. */
export function bandVerdict(m) {
  const v = VALUES.hub.band;
  const out = [];
  if (!(m.media.bottom <= m.copy.top + 0.5)) out.push(`photo is not above the copy (photo bottom ${m.media.bottom}, copy top ${m.copy.top})`);
  if (!(m.media.bottom <= m.h1.top + 0.5)) out.push(`photo is not above the h1 (photo bottom ${m.media.bottom}, h1 top ${m.h1.top})`);
  if (!near(m.media.top, m.hero.top, v.mediaFlushToHeroTop)) out.push(`photo does not start at the hero top (${m.media.top} vs ${m.hero.top})`);
  if (!near(m.media.width, m.hero.width, v.mediaFullWidthTolerance)) out.push(`photo is not full width (${m.media.width} vs ${m.hero.width})`);
  const ratio = m.media.width / m.media.height;
  if (Math.abs(ratio - v.mediaAspect) / v.mediaAspect > v.mediaAspectTolerance) out.push(`photo aspect ${ratio.toFixed(4)} is not 2:1 within ${v.mediaAspectTolerance * 100}%`);
  if (m.css.scrim !== 'none') out.push(`scrim is ${m.css.scrim}, expected none`);
  if (m.css.mask !== 'none') out.push(`mask is ${m.css.mask}, expected none`);
  if (m.natural < Math.ceil(m.boxW * m.dpr)) out.push(`served width ${m.natural} < ${Math.ceil(m.boxW * m.dpr)} device px (box ${m.boxW} x ${m.dpr})`);
  return out;
}

/** First-screen rule (NOS Design H-a cap ruling (c)): the last facts row, and the primary CTA if it sits below the facts, end by viewport height - 16. Page coordinates, header included. The hub's facts row is expected (Dates, Venue) in both modes, so it being absent fails; the CTA is never a stand-in. */
export function firstScreenVerdict(m) {
  const v = VALUES.hub.band.firstScreen;
  const limit = m.vh - v.marginPx;
  const out = [];
  // NOS Design countdown-wrap ruling: the rule is only met by a measurement taken after hydration with the countdown value shown, so an unhydrated countdown (a shorter row) can never make it pass.
  if (m.countdownShown !== true) out.push('the countdown is not hydrated and showing a value, so the measurement is not a valid first-screen measurement');
  if (!Number.isFinite(m.factsBottom) || !(m.factsRows >= v.factsRow.minRows)) out.push(`the hub facts row is absent or short (${m.factsRows ?? 0} rows, expected at least ${v.factsRow.minRows}: ${v.factsRow.labels.join(', ')}), so the first-screen rule cannot be satisfied`);
  else if (v.factsRow.labels.some((l) => !(m.factsLabels ?? []).includes(l))) out.push(`the hub facts row lacks ${v.factsRow.labels.filter((l) => !(m.factsLabels ?? []).includes(l)).join(', ')} (has ${(m.factsLabels ?? []).join(', ')})`);
  if (!Number.isFinite(m.ctaBottom)) out.push('the hub primary CTA is not rendered');
  const marks = [['facts row', m.factsBottom], ['primary CTA', m.ctaBottom]].filter(([, b]) => Number.isFinite(b));
  if (marks.length) {
    const [name, bottom] = marks.reduce((a, b) => (b[1] > a[1] ? b : a));
    if (bottom > limit) out.push(`${name} bottom ${Math.round(bottom)} is below the first screen limit ${limit} (viewport ${m.vh} - ${v.marginPx}) by ${Math.round(bottom - limit)}px`);
  }
  return out;
}

/** Below 768 (unchanged by this PR): the photo leads, fixed 300px, full width. */
export function phoneVerdict(m) {
  const v = VALUES.hub.phone;
  const out = [];
  if (!(m.media.bottom <= m.h1.top + 0.5)) out.push(`photo is not above the h1 (photo bottom ${m.media.bottom}, h1 top ${m.h1.top})`);
  if (!near(m.media.top, m.hero.top, 1)) out.push(`photo does not start at the hero top (${m.media.top} vs ${m.hero.top})`);
  if (!near(m.media.height, v.mediaHeight, v.mediaHeightTolerance)) out.push(`photo height ${m.media.height} is not ${v.mediaHeight}`);
  if (!near(m.media.width, m.hero.width, 1)) out.push(`photo is not full width (${m.media.width} vs ${m.hero.width})`);
  if (m.natural < Math.ceil(m.boxW * m.dpr)) out.push(`served width ${m.natural} < ${Math.ceil(m.boxW * m.dpr)} device px`);
  return out;
}

/** 1024 and up (unchanged by this PR): full-bleed hero, photo absolute at a 22% inset, masked, with its scrim. */
export function desktopVerdict(m, vp) {
  const v = VALUES.hub.desktop;
  const out = [];
  if (m.css.position !== 'absolute') out.push(`media position ${m.css.position}, expected absolute`);
  if (m.css.aspectRatio !== 'auto') out.push(`media aspect-ratio ${m.css.aspectRatio}, expected auto`);
  if (m.css.order !== '0') out.push(`media order ${m.css.order}, expected 0`);
  if (!/linear-gradient/.test(m.css.mask)) out.push(`media mask ${m.css.mask}, expected the linear-gradient mask`);
  if (m.css.scrim === 'none') out.push('scrim is not rendered');
  const leftShare = (m.media.left - m.hero.left) / m.hero.width;
  if (!near(leftShare, v.mediaLeftShare, v.mediaLeftShareTolerance)) out.push(`media left share ${leftShare.toFixed(3)} is not ${v.mediaLeftShare}`);
  if (!near(m.media.right, m.hero.right, 1)) out.push('media is not flush right');
  if (!near(m.media.height, m.hero.height, 1)) out.push(`media height ${m.media.height} is not the hero height ${m.hero.height}`);
  const min = Math.min(v.heroMinHeight.ceilPx, Math.max(v.heroMinHeight.floorPx, m.vh - v.heroMinHeight.headerPx));
  if (m.hero.height < min - 1) out.push(`hero height ${m.hero.height} is under its min-height ${min}`);
  if (!near(m.h1Size, vp.h1Px, v.h1TolerancePx)) out.push(`h1 size ${m.h1Size} is not ${vp.h1Px} (the #76-head measurement)`);
  return out;
}

const rect = (top, height, width = 768, left = 0) => ({ top, bottom: top + height, left, right: left + width, width, height });
const base = { vw: 768, vh: 1024, dpr: 2, boxW: 768, natural: 5000, h1Size: 62.72 };

/** Negative controls: the verdicts must fail the pre-change layout and pass the intended one. */
export function selftest() {
  const bad = [];
  const expect = (name, got, want) => { if (got !== want) bad.push(`${name}: expected ${want ? 'pass' : 'fail'}`); };
  const css0 = { position: 'relative', aspectRatio: 'auto', order: '0', mask: 'none', scrim: 'none' };
  const copyFirst = { ...base, hero: rect(97, 1190), copy: rect(97, 625), h1: rect(137, 180), media: rect(722, 576), css: css0 };
  expect('copy-first 4:3 layout (the pre-change tablet hub) is rejected', bandVerdict(copyFirst).length === 0, false);
  const photoFirst = { ...base, hero: rect(97, 1009), copy: rect(481, 625), h1: rect(521, 180), media: rect(97, 384), css: css0 };
  expect('photo-first 2:1 layout is accepted', bandVerdict(photoFirst).length === 0, true);
  const tallButFine = { ...photoFirst, hero: rect(97, 1150) };
  expect('the fixed hero cap is retired: a 1150px hero is no longer rejected by the band verdict', bandVerdict(tallButFine).length === 0, true);
  const fs = { vh: 1024, countdownShown: true, copy: rect(481, 625), factsBottom: 1008, ctaBottom: 900, factsRows: 2, factsLabels: ['Dates', 'Venue'] };
  expect('first screen: facts ending at vh - 16 (1008 of 1024) pass', firstScreenVerdict(fs).length === 0, true);
  expect('first screen: facts ending at 1009 of 1024 fail', firstScreenVerdict({ ...fs, factsBottom: 1009 }).length === 0, false);
  expect('first screen: a CTA below the facts is the measured edge (CTA 1030, facts 900 fail)', firstScreenVerdict({ ...fs, factsBottom: 900, ctaBottom: 1030 }).length === 0, false);
  expect('first screen: a CTA above the facts does not mask them (facts 1100, CTA 900 fail)', firstScreenVerdict({ ...fs, factsBottom: 1100, ctaBottom: 900 }).length === 0, false);
  expect('first screen: an absent facts row fails even when the CTA fits (the NaN hollow pass)', firstScreenVerdict({ ...fs, factsBottom: NaN, factsRows: 0 }).length === 0, false);
  expect('first screen: a one-row facts row fails', firstScreenVerdict({ ...fs, factsRows: 1 }).length === 0, false);
  expect('first screen: a facts row without Venue fails', firstScreenVerdict({ ...fs, factsLabels: ['Dates', 'Host'] }).length === 0, false);
  expect('first screen: an unhydrated countdown fails even when everything fits', firstScreenVerdict({ ...fs, countdownShown: false }).length === 0, false);
  expect('first screen: a measurement that never recorded the countdown state fails', firstScreenVerdict({ ...fs, countdownShown: undefined }).length === 0, false);
  expect('first screen: a missing CTA fails', firstScreenVerdict({ ...fs, ctaBottom: NaN }).length === 0, false);
  expect('first screen: nothing to measure fails', firstScreenVerdict({ ...fs, factsBottom: NaN, ctaBottom: NaN, factsRows: 0 }).length === 0, false);
  const fourThree = { ...photoFirst, media: rect(97, 576), copy: rect(673, 625), h1: rect(713, 180) };
  expect('photo-first at 4:3 is rejected', bandVerdict(fourThree).length === 0, false);
  const soft = { ...photoFirst, natural: 1000 };
  expect('an under-resolved served image is rejected', bandVerdict(soft).length === 0, false);
  const phoneOk = { ...base, vw: 390, boxW: 390, dpr: 3, hero: rect(97, 900, 390), media: rect(97, 300, 390), copy: rect(397, 600, 390), h1: rect(437, 150, 390), css: css0 };
  expect('300px photo-first phone layout is accepted', phoneVerdict(phoneOk).length === 0, true);
  expect('a 2:1 photo at 390 (195px) is rejected as a regression', phoneVerdict({ ...phoneOk, media: rect(97, 195, 390) }).length === 0, false);
  const wide = { vw: 1280, vh: 800, dpr: 1, h1Size: 62.72, hero: rect(97, 703, 1280), media: rect(97, 703, 998.4, 281.6), copy: rect(97, 703, 1280), h1: rect(300, 90, 700), css: { position: 'absolute', aspectRatio: 'auto', order: '0', mask: 'linear-gradient(90deg, transparent 0px, rgb(0, 0, 0) 16%)', scrim: 'block' } };
  expect('the 1280 full-bleed hub is accepted', desktopVerdict(wide, { h1Px: 62.72 }).length === 0, true);
  expect('a 1280 hub whose h1 moved off its #76 size is rejected', desktopVerdict({ ...wide, h1Size: 83.2 }, { h1Px: 62.72 }).length === 0, false);
  expect('a 1280 hub that went static/stacked is rejected', desktopVerdict({ ...wide, css: { ...wide.css, position: 'relative', order: '-1' } }, { h1Px: 62.72 }).length === 0, false);
  expect('1023x511.5 at 2x on a 3:2 source needs 2046 (width-driven band)', coverRequired(1023, 511.5, 1.5, 2) === 2046, true);
  expect('390x300 at 2x on a 3:2 source needs 900 (height-driven phone band)', coverRequired(390, 300, 1.5, 2) === 900, true);
  expect('390x300 at 3x on a 3:2 source needs 1350, so the 1200 served before HB-3 fails', coverRequired(390, 300, 1.5, 3) === 1350 && 1200 < coverRequired(390, 300, 1.5, 3), true);
  expect('the old box-only formula (390 x 3 = 1170) would have passed 1200, the cover formula does not', 1200 >= 390 * 3 && 1200 < coverRequired(390, 300, 1.5, 3), true);
  expect('a 1024x1366@2 viewport (820px tall media, 799 wide) needs 2460, so sizes 100vw (2048 at 1024) is short', coverRequired(799, 820, 1.5, 2) === 2460 && 2048 < 2460, true);
  expect('the pre-H-a 4:3 tablet box 1023x767 at 2x needs about 2302 (the #76 dev measured 2306), so the 2048 served on #76 a6c252e2 fails', coverRequired(1023, 767.25, 1.5, 2) === 2302 && 2048 < 2302, true);
  return bad;
}
