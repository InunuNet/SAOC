// Pure verdicts for the countdown-wrap ruling (NOS Design H-a countdown wrap, (a) + (b), 2026-10-27). Each returns a list of failure strings (empty = pass).
// A rect is { left, top, right, bottom, width, height } in viewport coordinates at scroll 0.

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const BAND_MIN = 768;
const BAND_MAX = 1023;

// (b): the CTA-to-countdown column gap is 32 from 768 to 1023 and 48 everywhere else; the row gap never changes (48).
export function expectedColumnGap(vw) { return vw >= BAND_MIN && vw <= BAND_MAX ? 32 : 48; }
// NOS Design countdown gap, revised: component-level in ShowCountdown.tsx, on / and /tickets, the gap between the four units is 16 below 1024 and 24 from 1024 (gap-4 lg:gap-6).
const LG = 1024;
export function expectedUnitGap(vw) { return vw < LG ? 16 : 24; }
export function unitGapVerdict(vw, unitGapPx) { return near(unitGapPx ?? NaN, expectedUnitGap(vw), 0.01) ? [] : [`gap between the countdown units ${unitGapPx}px at ${vw}px, expected ${expectedUnitGap(vw)}`]; }
export function gapVerdict(vw, columnGapPx, rowGapPx, unitGapPx) {
  const f = [];
  if (!near(columnGapPx, expectedColumnGap(vw), 0.01)) f.push(`column gap ${columnGapPx}px at ${vw}px, expected ${expectedColumnGap(vw)}`);
  f.push(...unitGapVerdict(vw, unitGapPx));
  if (!near(rowGapPx, 48, 0.01)) f.push(`row gap ${rowGapPx}px at ${vw}px, expected 48 (only the column gap changes)`);
  return f;
}

// Worst-case fit: the countdown sits in the same row as the CTA group (beside it, vertically overlapping, never wrapped under it) with at least minSlackPx to spare.
// m = { row: { contentWidth }, cta: rect, cd: rect, columnGap }. slack = contentWidth - cta.width - columnGap - cd.width.
export function fitVerdict(m, { minSlackPx = 8, topTolerancePx = 1, bottomTolerancePx = 1 } = {}) {
  const f = [];
  if (!m || !m.row || !m.cta || !m.cd) return ['row, CTA group or countdown not measurable'];
  const overlap = m.cd.top < m.cta.bottom - topTolerancePx && m.cd.bottom > m.cta.top + topTolerancePx;
  if (!overlap) f.push(`countdown is not in the CTA row (countdown y${m.cd.top.toFixed(1)}-${m.cd.bottom.toFixed(1)}, CTA y${m.cta.top.toFixed(1)}-${m.cta.bottom.toFixed(1)}): it wrapped`);
  // flex-end is the designed alignment: the countdown and CTA group share a bottom edge.
  if (Math.abs(m.cd.bottom - m.cta.bottom) > bottomTolerancePx) f.push(`countdown bottom ${m.cd.bottom.toFixed(1)} is not the CTA group bottom ${m.cta.bottom.toFixed(1)} (tolerance ${bottomTolerancePx}px)`);
  if (m.cd.left < m.cta.right + m.columnGap - 0.5) f.push(`countdown starts at x${m.cd.left.toFixed(1)}, inside the CTA group's right edge ${m.cta.right.toFixed(1)} plus the ${m.columnGap}px gap`);
  const slack = m.row.contentWidth - m.cta.width - m.columnGap - m.cd.width;
  if (!(slack >= minSlackPx)) f.push(`row slack ${Number.isFinite(slack) ? slack.toFixed(1) : 'NaN'}px, at least ${minSlackPx}px required`);
  return f;
}

// Below 768 the countdown deterministically stacks under the CTA group (NOS Design, option A): never beside it, whatever the strings.
export function stackedVerdict(m) {
  if (!m || !m.cta || !m.cd) return ['row, CTA group or countdown not measurable'];
  const f = [];
  if (m.cd.top < m.cta.bottom - 1) f.push(`the countdown is not stacked under the CTA group (countdown top ${m.cd.top.toFixed(1)}, CTA bottom ${m.cta.bottom.toFixed(1)}): below 768 it must always stack`);
  return f;
}

// NOS Design's GO is conditional on the final-form numbers reproducing exactly: any number that moves goes back to NOS Design.
// FINAL = { blockWidthBelow1024, blockWidthFrom1024, widthTolerancePx, slackAt768, slackTolerancePx, factsBottomAt768Max }.
export function pinnedVerdict(m, vw, FINAL) {
  const f = [];
  if (!m || !m.cd) return ['countdown not measurable'];
  const want = vw < 1024 ? FINAL.blockWidthBelow1024 : FINAL.blockWidthFrom1024;
  // The units wrapper is stretched to its container on phones, so the pinned width is the span of the four unit columns, not the wrapper box.
  const width = Number.isFinite(m.unitsSpan) ? m.unitsSpan : m.cd.width;
  if (!near(width, want, FINAL.widthTolerancePx)) f.push(`block ${width.toFixed(2)}px, the ruled final form is ${want} +-${FINAL.widthTolerancePx}: this goes back to NOS Design`);
  if (vw === 768) {
    if (m.row && m.cta) {
      const slack = m.row.contentWidth - m.cta.width - m.columnGap - m.cd.width;
      if (!near(slack, FINAL.slackAt768, FINAL.slackTolerancePx)) f.push(`slack at 768 ${slack.toFixed(2)}px, the ruled final form is ${FINAL.slackAt768} +-${FINAL.slackTolerancePx}: this goes back to NOS Design`);
    } else f.push('row or CTA group not measurable at 768');
    if (!Number.isFinite(m.factsBottom) || m.factsBottom > FINAL.factsBottomAt768Max) f.push(`facts bottom at 768 is ${Number.isFinite(m.factsBottom) ? m.factsBottom.toFixed(1) : 'NaN'}, the ruled final form is 1005 and the cap ${FINAL.factsBottomAt768Max}: this goes back to NOS Design`);
  }
  return f;
}

// No horizontal overflow: the page is no wider than the viewport and the countdown block sits inside it.
export function overflowVerdict(m) {
  const f = [];
  if (!m) return ['countdown not measurable'];
  if (m.scrollWidth > m.vw + 0.5) f.push(`the page scrolls horizontally (scrollWidth ${m.scrollWidth} against ${m.vw})`);
  if (Number.isFinite(m.unitsSpan) && m.unitsSpan > m.cd.width + 0.5) f.push(`the four units (${m.unitsSpan.toFixed(1)}px) overflow their wrapper (${m.cd.width.toFixed(1)}px)`);
  if (Number.isFinite(m.parentWidth) && m.cd.width > m.parentWidth + 0.5) f.push(`the countdown block (${m.cd.width.toFixed(1)}px) is wider than its container (${m.parentWidth.toFixed(1)}px)`);
  if (m.cd.right > m.vw + 0.5 || m.cd.left < -0.5) f.push(`the countdown block (x${m.cd.left.toFixed(1)}-${m.cd.right.toFixed(1)}) leaves the viewport (0-${m.vw})`);
  return f;
}

// Ticking: the countdown block width never changes between ticks and the row never wraps. samples = [{ width, wrapped, seconds, figures: [widths] }].
export function tickVerdict(samples, { minTicks = 60, tolerancePx = 0.5, centreTolerancePx = 0.5 } = {}) {
  const f = [];
  if (!samples || samples.length === 0) return ['no samples'];
  const distinct = new Set(samples.map((s) => s.seconds)).size;
  let changes = 0;
  for (let i = 1; i < samples.length; i += 1) if (samples[i].seconds !== samples[i - 1].seconds) changes += 1;
  if (changes < minTicks) f.push(`only ${changes} tick(s) observed (${distinct} distinct seconds values), ${minTicks} required: the test did not exercise the countdown`);
  const w0 = samples[0].width;
  const worst = Math.max(...samples.map((s) => Math.abs(s.width - w0)));
  if (!(worst <= tolerancePx)) f.push(`countdown width moved ${worst.toFixed(2)}px between ticks (${Math.min(...samples.map((s) => s.width)).toFixed(2)}-${Math.max(...samples.map((s) => s.width)).toFixed(2)}), tolerance ${tolerancePx}`);
  const nFig = samples[0].figures.length;
  for (let i = 0; i < nFig; i += 1) {
    const ws = samples.map((s) => s.figures[i]);
    const d = Math.max(...ws.map((w) => Math.abs(w - ws[0])));
    if (!(d <= tolerancePx)) f.push(`figure ${i} width moved ${d.toFixed(2)}px between ticks`);
  }
  const off = samples.flatMap((s) => (s.centreOffsets ?? [NaN]));
  const worstOff = Math.max(...off.map((o) => Math.abs(o)));
  if (!(worstOff <= centreTolerancePx)) f.push(`a figure's text centre is ${Number.isFinite(worstOff) ? worstOff.toFixed(2) : 'unmeasured'}px from its label's centre, tolerance ${centreTolerancePx}`);
  const wrapped = samples.filter((s) => s.wrapped).length;
  if (wrapped) f.push(`the row wrapped in ${wrapped} of ${samples.length} samples`);
  return f;
}

// (a), branch ch-min-width: each figure's computed min-width (px) is at least digits x the widest measured digit advance (3 for days, 2 for the others).
// figures = [{ unit, minWidthPx, fvn }], widestAdvancePx from the measured face.
export function minWidthVerdict(figures, widestAdvancePx, branch) {
  const f = [];
  for (const g of figures) {
    if (!/tabular-nums/.test(g.fvn ?? '')) f.push(`${g.unit}: font-variant-numeric is "${g.fvn}", tabular-nums is required on every width`);
    if (branch === 'ch-min-width') {
      if (g.textAlign !== 'center') f.push(`${g.unit}: text-align is "${g.textAlign}", the ch fallback centres each figure (NOS Design)`);
      const need = (g.unit === 'days' ? 3 : 2) * widestAdvancePx;
      if (!(g.minWidthPx >= need - 0.05)) f.push(`${g.unit}: min-width ${g.minWidthPx}px is below ${need.toFixed(2)}px (${g.unit === 'days' ? 3 : 2} x the widest digit advance ${widestAdvancePx.toFixed(2)}px)`);
    }
  }
  return f;
}

export function widestDigit(widths) { return Object.entries(widths).sort((a, b) => b[1] - a[1])[0]; }

// Parity with main at 390 and >= 1024 (and 640-767, and the tickets pages). The ONLY tolerated difference is the width of the .nos-figure boxes, and what that width
// moves inside the countdown block. m = { cta: { boxes: [rect...] } | null, outside: [rect...], block: rect, columns: [rect...], figures: [rect...], labels: [rect...], styles: [string...] }.
//   1. every box outside the countdown block (the row, the CTA group and all its descendants on the hub; every other box in the same section on the tickets pages) is equal in x, y, width and height within tol.
//   2. the countdown block: top and height equal within tol; one horizontal edge (left or right, whichever the layout anchors) equal within tol.
//   3. each .nos-figure: top and height equal; width may only grow (>= -tol).
//   4. each unit column: width grows by the figure's growth or not at all (a wider label wins); top and height equal.
//   5. the block's width grows by exactly the sum of its column growths (+- tol).
//   6. each unit label's text (a Range, not the block element, which is as wide as its column): top, height and width equal; only x may follow its column.
//   7. every computed style listed in the probe is identical (the min-width of a figure is not in the list).
// A computed-style entry is `name|value|value|...`. Values are compared exactly, except that two rgb()/rgba() colours may differ by one in a colour channel (and 0.01 in alpha):
// a colour caught mid-transition or rounded differently is not a layout change. The tolerance is for colour values only; every other property is exact.
const RGB = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/;
export function styleEntryEqual(a, b) {
  if (a === b) return true;
  const x = a.split('|'), y = b.split('|');
  if (x.length !== y.length) return false;
  return x.every((fa, i) => {
    if (fa === y[i]) return true;
    const ma = RGB.exec(fa), mb = RGB.exec(y[i]);
    if (!ma || !mb) return false;
    return [1, 2, 3].every((k) => Math.abs(Number(ma[k]) - Number(mb[k])) <= 1) && Math.abs(Number(ma[4] ?? 1) - Number(mb[4] ?? 1)) <= 0.01;
  });
}
export function parityVerdict(main, branch, tol = 0.5) {
  // The one other tolerated difference: the gap between the units (16 below 1024 on the branch, 24 on main). It moves the columns and shrinks the block by 3 x the delta.
  const dGap = (branch?.unitGap ?? 0) - (main?.unitGap ?? 0);
  const f = [];
  const cmp = (a, b, keys, what) => { for (const k of keys) if (!near(a[k], b[k], tol)) f.push(`${what}: ${k} ${b[k].toFixed(2)} vs main ${a[k].toFixed(2)}`); };
  if (!main || !branch) return ['page not measurable on one side'];
  if (main.outside.length !== branch.outside.length) f.push(`box count outside the countdown differs: ${branch.outside.length} vs main ${main.outside.length}`);
  else main.outside.forEach((r, i) => cmp(r, branch.outside[i], ['left', 'top', 'width', 'height'], `outside box ${i} (${main.outsideNames?.[i] ?? ''})`));
  cmp(main.block, branch.block, ['top', 'height'], 'countdown block');
  if (!near(main.block.left, branch.block.left, tol) && !near(main.block.right, branch.block.right, tol)) f.push(`countdown block moved at both edges: left ${branch.block.left.toFixed(2)} vs ${main.block.left.toFixed(2)}, right ${branch.block.right.toFixed(2)} vs ${main.block.right.toFixed(2)}`);
  if (main.figures.length !== branch.figures.length || main.columns.length !== branch.columns.length) { f.push('figure or column count differs'); return f; }
  let growth = 0;
  main.figures.forEach((r, i) => {
    cmp(r, branch.figures[i], ['top', 'height'], `figure ${i}`);
    const dFig = branch.figures[i].width - r.width;
    if (dFig < -tol) f.push(`figure ${i} got narrower by ${(-dFig).toFixed(2)}px`);
    const dCol = branch.columns[i].width - main.columns[i].width;
    cmp(main.columns[i], branch.columns[i], ['top', 'height'], `column ${i}`);
    if (!(near(dCol, 0, tol) || near(dCol, dFig, tol))) f.push(`column ${i} grew ${dCol.toFixed(2)}px but its figure grew ${dFig.toFixed(2)}px`);
    growth += dCol;
    cmp(main.labels[i], branch.labels[i], ['top', 'height', 'width'], `label ${i} text`);
    // NOS Design: label BOX growth is accepted; the label text stays centred on its column exactly as on main.
    const off = (m) => m.labels[i].left + m.labels[i].width / 2 - (m.columns[i].left + m.columns[i].width / 2);
    if (!near(off(main), off(branch), tol)) f.push(`label ${i} text centre moved ${(off(branch) - off(main)).toFixed(2)}px relative to its column`);
  });
  // The block can be stretched by its layout (stacked below 640 it is as wide as the row), so the sum rule is read on the span of the unit columns, not on the block box.
  const span = (m) => m.columns[m.columns.length - 1].right - m.columns[0].left;
  const dSpan = span(branch) - span(main);
  const expectSpan = growth + (main.columns.length - 1) * dGap;
  if (!near(dSpan, expectSpan, tol)) f.push(`the unit columns' span changed ${dSpan.toFixed(2)}px but the columns grew ${growth.toFixed(2)}px and the unit gap changed ${dGap}px x ${main.columns.length - 1}`);
  if (main.styles.length !== branch.styles.length) f.push('computed-style list length differs');
  else main.styles.forEach((s, i) => { if (!styleEntryEqual(s, branch.styles[i])) f.push(`computed style differs at entry ${i}: ${branch.styles[i]} vs main ${s}`); });
  return f;
}

export function selftest() {
  const bad = [];
  const rect = (l, t, w, h) => ({ left: l, top: t, right: l + w, bottom: t + h, width: w, height: h });
  const expect = (name, got, want) => { if ((got.length === 0) !== want) bad.push(`${name}: ${want ? 'should pass' : 'should fail'} (${got.join(' | ') || 'no failure'})`); };
  expect('gap 32 at 768', gapVerdict(768, 32, 48, 16), true);
  expect('gap 32 at 1023', gapVerdict(1023, 32, 48, 16), true);
  expect('gap 48 at 768 fails', gapVerdict(768, 48, 48, 16), false);
  expect('gap 32 at 1024 fails', gapVerdict(1024, 32, 48, 24), false);
  expect('gap 32 at 767 fails', gapVerdict(767, 32, 48, 24), false);
  expect('shorthand gap 32 (row gap moved) fails', gapVerdict(820, 32, 32, 16), false);
  expect('unit gap 16 below 1024 and 24 from 1024', [...gapVerdict(390, 48, 48, 16), ...gapVerdict(767, 48, 48, 16), ...gapVerdict(768, 32, 48, 16), ...gapVerdict(1023, 32, 48, 16), ...gapVerdict(1024, 48, 48, 24), ...gapVerdict(1280, 48, 48, 24)], true);
  expect('unit gap 24 at 820 fails', gapVerdict(820, 32, 48, 24), false);
  expect('unit gap 24 at 390 fails', gapVerdict(390, 48, 48, 24), false);
  expect('unit gap 16 at 1024 fails', gapVerdict(1024, 48, 48, 16), false);
  expect('an unmeasured unit gap fails', gapVerdict(820, 32, 48, undefined), false);
  expect('unit gap on /tickets: 16 at 820 passes, 24 at 820 fails', [...unitGapVerdict(820, 16)].length === 0 && unitGapVerdict(820, 24).length === 1 ? [] : ['unitGapVerdict wrong'], true);
  const FIN = { blockWidthBelow1024: 278.89, blockWidthFrom1024: 302.89, widthTolerancePx: 1, slackAt768: 9.4, slackTolerancePx: 0.5, factsBottomAt768Max: 1005.5 };
  const pin = { row: { contentWidth: 640 }, cta: rect(0, 100, 319.7, 140), columnGap: 32, cd: rect(361.1, 160, 278.89, 80), factsBottom: 1005 };
  expect('pinned: the ruled numbers at 768 pass', pinnedVerdict(pin, 768, FIN), true);
  expect('pinned: a stretched wrapper (288) whose columns span 278.89 passes', pinnedVerdict({ ...pin, cd: rect(16, 160, 288, 80), unitsSpan: 278.89 }, 390, FIN), true);
  expect('pinned: a stretched wrapper whose columns span 298 fails', pinnedVerdict({ ...pin, cd: rect(16, 160, 288, 80), unitsSpan: 298 }, 390, FIN), false);
  expect('pinned: a block 1px wider fails', pinnedVerdict({ ...pin, cd: rect(365.4, 160, 274.6, 80) }, 768, FIN), false);
  expect('pinned: slack 13.5 at 768 fails', pinnedVerdict({ ...pin, cd: rect(360, 160, 278.89, 80), columnGap: 33.3 }, 768, FIN), false);
  expect('pinned: facts bottom 1006 at 768 fails', pinnedVerdict({ ...pin, factsBottom: 1006 }, 768, FIN), false);
  expect('pinned: facts bottom 1000 at 768 passes (lower is not a regression)', pinnedVerdict({ ...pin, factsBottom: 1000 }, 768, FIN), true);
  expect('pinned: 302.89 at 1100 passes, 278.89 at 1100 fails', [...pinnedVerdict({ ...pin, cd: rect(0, 160, 302.89, 80) }, 1100, FIN)], true);
  expect('pinned: 278.89 at 1100 fails', pinnedVerdict(pin, 1100, FIN), false);
  expect('pinned: 302.89 at 820 fails', pinnedVerdict({ ...pin, cd: rect(0, 160, 302.89, 80) }, 820, FIN), false);
  expect('stacked: a countdown under the CTA group passes', stackedVerdict({ cta: rect(0, 100, 319.7, 140), cd: rect(0, 300, 278.89, 80) }), true);
  expect('stacked: a countdown beside the CTA group fails', stackedVerdict({ cta: rect(0, 100, 319.7, 140), cd: rect(366, 160, 278.89, 80) }), false);
  expect('stacked: unmeasurable fails', stackedVerdict({ cta: null, cd: rect(0, 300, 278.89, 80) }), false);
  const ov = { vw: 320, scrollWidth: 320, parentWidth: 272, cd: { left: 24, right: 296, width: 272 } };
  expect('no overflow passes', overflowVerdict(ov), true);
  expect('a page wider than the viewport fails', overflowVerdict({ ...ov, scrollWidth: 340 }), false);
  expect('a countdown past the right edge fails', overflowVerdict({ ...ov, cd: { left: 24, right: 330, width: 306 } }), false);
  expect('a block wider than its container fails even inside the viewport', overflowVerdict({ ...ov, parentWidth: 250 }), false);
  const row = { contentWidth: 640 };
  expect('fit with 10px slack', fitVerdict({ row, cta: rect(0, 100, 319.7, 140), cd: rect(352, 160, 278, 80), columnGap: 32 }), true);
  expect('fit with 7px slack fails', fitVerdict({ row, cta: rect(0, 100, 319.7, 140), cd: rect(352, 160, 281.3, 80), columnGap: 32 }), false);
  expect('knife edge 641.1 in 640 fails', fitVerdict({ row, cta: rect(0, 100, 319.7, 140), cd: rect(0, 300, 273.4, 80), columnGap: 48 }), false);
  expect('wrapped under the CTA fails', fitVerdict({ row, cta: rect(0, 100, 319.7, 140), cd: rect(0, 300, 200, 80), columnGap: 32 }), false);
  expect('unmeasurable fails', fitVerdict(null), false);
  expect('countdown 5px above the CTA bottom fails', fitVerdict({ row, cta: rect(0, 100, 319.7, 140), cd: rect(352, 155, 278, 80), columnGap: 32 }), false);
  expect('countdown 1px off the CTA bottom passes', fitVerdict({ row, cta: rect(0, 100, 319.7, 140), cd: rect(352, 161, 278, 80), columnGap: 32 }), true);
  const tick = (w, sec, fig = [60, 44, 44, 44]) => ({ width: w, wrapped: false, seconds: sec, figures: fig, centreOffsets: [0, 0.1, -0.2, 0] });
  const good = Array.from({ length: 70 }, (_, i) => tick(270, i % 60));
  expect('constant width over 70 ticks', tickVerdict(good), true);
  expect('width drift 1px fails', tickVerdict(good.map((s, i) => (i === 30 ? { ...s, width: 271 } : s))), false);
  expect('a figure drifting fails', tickVerdict(good.map((s, i) => (i === 30 ? { ...s, figures: [60, 44, 44, 41] } : s))), false);
  expect('too few ticks fails', tickVerdict(good.slice(0, 20)), false);
  expect('a frozen countdown fails', tickVerdict(Array.from({ length: 70 }, () => tick(270, 5))), false);
  expect('a figure 1px off its label centre fails', tickVerdict(good.map((s, i) => (i === 9 ? { ...s, centreOffsets: [0, 1, 0, 0] } : s))), false);
  expect('unmeasured centres fail', tickVerdict(good.map((s) => ({ ...s, centreOffsets: undefined }))), false);
  expect('a wrapped sample fails', tickVerdict(good.map((s, i) => (i === 5 ? { ...s, wrapped: true } : s))), false);
  const figs = (d, o) => [{ unit: 'days', minWidthPx: d, fvn: 'lining-nums tabular-nums', textAlign: 'center' }, { unit: 'hours', minWidthPx: o, fvn: 'lining-nums tabular-nums', textAlign: 'center' }];
  expect('min-width 3ch and 2ch', minWidthVerdict(figs(75.3, 50.2), 25.1, 'ch-min-width'), true);
  expect('left-aligned figures fail on the ch branch', minWidthVerdict(figs(75.3, 50.2).map((g) => ({ ...g, textAlign: 'start' })), 25.1, 'ch-min-width'), false);
  expect('min-width too small fails', minWidthVerdict(figs(60, 50.2), 25.1, 'ch-min-width'), false);
  expect('no min-width fails', minWidthVerdict(figs(0, 0), 25.1, 'ch-min-width'), false);
  expect('tnum branch needs no min-width', minWidthVerdict(figs(0, 0), 25.1, 'tnum'), true);
  expect('missing tabular-nums fails', minWidthVerdict([{ unit: 'days', minWidthPx: 80, fvn: 'normal' }], 25.1, 'ch-min-width'), false);
  const lay = (colW, gap) => { let x = 0; return colW.map((w) => { const r0 = { x, w }; x += w + gap; return r0; }); };
  const side = (figW, colW, blockW, gap = 24) => ({
    outside: [rect(0, 0, 640, 300), rect(0, 100, 320, 140)], block: rect(640 - blockW, 160, blockW, 80),
    columns: lay(colW, gap).map((c) => rect(c.x, 160, c.w, 80)), figures: lay(colW, gap).map((c, i) => rect(c.x, 160, figW[i], 42)), labels: lay(colW, gap).map((c) => rect(c.x + (c.w - 40) / 2, 210, 40, 14)), styles: ['a', 'b'], unitGap: gap,
  });
  const main = side([66, 44, 44, 44], [66, 44, 44, 44], 198 + 72);
  const gapSide = side([75, 50, 50, 50], [75, 50, 50, 50], 225 + 72 - 24, 16); const mainG = { ...main };
  expect('parity: unit gap 24 to 16 with the floors passes', parityVerdict(mainG, gapSide), true);
  expect('parity: a unit gap that says 16 but whose columns did not move closer fails', parityVerdict(mainG, { ...side([75, 50, 50, 50], [75, 50, 50, 50], 297, 24), unitGap: 16 }), false);
  const stretched = (m) => ({ ...m, block: rect(0, 160, 288, 80) });
  expect('parity: a stretched (stacked) block whose box did not grow passes when the columns grew', parityVerdict(stretched(main), stretched(side([75, 50, 50, 50], [75, 50, 50, 50], 297))), true);
  expect('parity: glyph advance only', parityVerdict(main, side([75, 50, 50, 50], [75, 50, 50, 50], 225 + 72)), true);
  expect('parity: columns spaced wider than the unit gap says fails', parityVerdict(main, { ...side([75, 50, 50, 50], [75, 50, 50, 50], 297, 32), unitGap: 24 }), false);
  expect('parity: a figure shrinking fails', parityVerdict(main, side([60, 44, 44, 44], [60, 44, 44, 44], 192 + 72)), false);
  const moved = side([75, 50, 50, 50], [75, 50, 50, 50], 225 + 72); moved.outside[1] = rect(0, 100, 320, 148);
  expect('parity: the CTA group growing fails', parityVerdict(main, moved), false);
  const sty = side([75, 50, 50, 50], [75, 50, 50, 50], 225 + 72); sty.styles = ['a', 'c'];
  expect('parity: a computed style difference fails', parityVerdict(main, sty), false);
  const labelOff = side([75, 50, 50, 50], [75, 50, 50, 50], 225 + 72); labelOff.labels[0] = rect(3, 210, 40, 14);
  expect('parity: a label text not centred on its grown column fails', parityVerdict(main, labelOff), false);
  const labelMoved = side([75, 50, 50, 50], [75, 50, 50, 50], 225 + 72); labelMoved.labels[0] = rect(17.5, 216, 40, 14);
  expect('parity: a label moving down fails', parityVerdict(main, labelMoved), false);
  const colour = (c) => ({ ...main, styles: [`button|flex|${c}|16px`] });
  expect('parity: a colour one channel off (rgb 33,26,87 vs 88) passes', parityVerdict(colour('rgb(33, 26, 88)'), colour('rgb(33, 26, 87)')), true);
  expect('parity: a colour two channels off fails', parityVerdict(colour('rgb(33, 26, 88)'), colour('rgb(33, 26, 90)')), false);
  expect('parity: a one-channel tolerance does not cover another property (16px vs 17px)', parityVerdict(colour('rgb(33, 26, 88)'), { ...main, styles: ['button|flex|rgb(33, 26, 88)|17px'] }), false);
  expect('parity: a name or display difference fails even with equal colours', parityVerdict(colour('rgb(33, 26, 88)'), { ...main, styles: ['a|flex|rgb(33, 26, 88)|16px'] }), false);
  expect('parity: unmeasurable fails', parityVerdict(null, main), false);
  return bad;
}

// ---- static css verdict (A23) ----
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
// Every `selector { declarations }` rule that holds no further braces, each tagged with the innermost enclosing @media prelude ('' at top level).
export function cssRules(css) {
  const src = stripComments(css);
  const rules = [];
  const stack = [];
  let buf = '';
  for (const ch of src) {
    if (ch === '{') { stack.push({ head: buf.trim(), decls: '', kids: false }); if (stack.length > 1) stack[stack.length - 2].kids = true; buf = ''; }
    else if (ch === '}') {
      const top = stack.pop();
      if (!top) { buf = ''; continue; }
      top.decls += buf;
      if (!top.kids && !top.head.startsWith('@')) {
        const media = [...stack].reverse().find((s) => /^@media/.test(s.head));
        rules.push({ selector: top.head, decls: top.decls, media: media ? media.head : '' });
      }
      buf = '';
    } else buf += ch;
  }
  return rules;
}
const decl = (decls, prop) => { const m = new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`).exec(decls); return m ? m[1].trim() : null; };
const BAND_MEDIA = /^@media\s*\(\s*min-width\s*:\s*768px\s*\)\s*and\s*\(\s*max-width\s*:\s*1023px\s*\)$|^@media\s*\(\s*width\s*>=\s*768px\s*\)\s*and\s*\(\s*width\s*<=\s*1023px\s*\)$/;
export function cssFailures(css, branch) {
  const f = [];
  const rules = cssRules(css);
  const rowRules = rules.filter((r) => /\.nos-hero-row\s*$/.test(r.selector.split(',').pop().trim()) && !/>/.test(r.selector));
  const base = rowRules.filter((r) => r.media === '');
  if (!base.some((r) => decl(r.decls, 'gap') === '48px')) f.push('the base .nos-hero-row rule must keep gap: 48px');
  const band = rowRules.filter((r) => BAND_MEDIA.test(r.media));
  if (!band.some((r) => decl(r.decls, 'column-gap') === '32px')) f.push('no (min-width: 768px) and (max-width: 1023px) rule sets .nos-hero-row column-gap: 32px');
  if (band.some((r) => decl(r.decls, 'row-gap') !== null || decl(r.decls, 'gap') !== null)) f.push('the 768-1023 rule must set column-gap only: the row gap stays 48');
  if (rowRules.some((r) => r.media !== '' && !BAND_MEDIA.test(r.media) && (decl(r.decls, 'column-gap') !== null || decl(r.decls, 'gap') !== null))) f.push('another media block changes the .nos-hero-row gap: (b) applies at 768-1023 only');
  // The unit gap is component-level now (ShowCountdown.tsx, tsxGapFailures); nos-theme.css must not override it under .nos-hero-row.
  const unitRules = rules.filter((r) => /\.nos-hero-row\b/.test(r.selector) && !rowRules.includes(r));
  if (unitRules.some((r) => (decl(r.decls, 'column-gap') ?? decl(r.decls, 'gap')) !== null)) f.push('nos-theme.css overrides a gap under .nos-hero-row: the unit gap lives in ShowCountdown.tsx (gap-4 lg:gap-6)');
  const fig = rules.filter((r) => /\.nos-figure\b/.test(r.selector));
  if (!fig.some((r) => /tabular-nums/.test(decl(r.decls, 'font-variant-numeric') ?? ''))) f.push('.nos-figure no longer declares tabular-nums');
  if (branch === 'ch-min-width') {
    const mw = (n) => fig.some((r) => decl(r.decls, 'min-width') === `${n}ch`);
    if (!mw(3)) f.push('no .nos-figure rule sets min-width: 3ch (days)');
    if (!mw(2)) f.push('no .nos-figure rule sets min-width: 2ch (hours, minutes, seconds)');
    if (!fig.some((r) => decl(r.decls, 'text-align') === 'center')) f.push('no .nos-figure rule sets text-align: center (the ch fallback centres each figure box)');
  }
  return f;
}
export function cssSelftest() {
  const bad = [];
  const ok = `.nos-theme .nos-hero-row { display: flex; gap: 48px; }
@media (min-width: 768px) and (max-width: 1023px) { .nos-theme .nos-hero-row { column-gap: 32px; } }
.nos-theme .nos-figure.font-serif { font-variant-numeric: lining-nums tabular-nums; min-width: 2ch; text-align: center; }
.nos-theme .nos-figure[data-nos-hero-text="countdown-days-value"] { min-width: 3ch; }`;
  const expect = (name, got, want) => { if ((got.length === 0) !== want) bad.push(`${name}: ${want ? 'should pass' : 'should fail'} (${got.join(' | ') || 'no failure'})`); };
  expect('css: the intended rules pass', cssFailures(ok, 'ch-min-width'), true);
  expect('css: the tnum branch needs no min-width', cssFailures(ok.replace(/min-width: \dch;/g, '').replace('; text-align: center', ''), 'tnum'), true);
  expect('css: no band rule fails', cssFailures(ok.replace('column-gap: 32px', 'color: red'), 'ch-min-width'), false);
  expect('css: a 48px band gap fails', cssFailures(ok.replace('column-gap: 32px', 'column-gap: 48px'), 'ch-min-width'), false);
  expect('css: the gap shorthand in the band (moves the row gap) fails', cssFailures(ok.replace('column-gap: 32px', 'gap: 32px'), 'ch-min-width'), false);
  expect('css: a band wider than 1023 fails', cssFailures(ok.replace('max-width: 1023px', 'max-width: 1100px'), 'ch-min-width'), false);
  expect('css: a changed base gap fails', cssFailures(ok.replace('gap: 48px', 'gap: 32px'), 'ch-min-width'), false);
  expect('css: dropping tabular-nums fails', cssFailures(ok.replace('lining-nums tabular-nums', 'lining-nums'), 'ch-min-width'), false);
  expect('css: a nos-theme unit-gap override under the hero row fails', cssFailures(`${ok}\n@media (min-width: 768px) and (max-width: 1023px) { .nos-theme .nos-hero-row [aria-label] { column-gap: 16px; } }`, 'ch-min-width'), false);
  expect('css: a missing text-align: center fails on the ch branch', cssFailures(ok.replace('; text-align: center', ''), 'ch-min-width'), false);
  expect('css: a missing 3ch fails on the ch branch', cssFailures(ok.replace('min-width: 3ch', 'min-width: 2ch'), 'ch-min-width'), false);
  expect('css: a missing 2ch fails on the ch branch', cssFailures(ok.replace('; min-width: 2ch', ''), 'ch-min-width'), false);
  expect('css: a <768 gap change fails', cssFailures(`${ok}\n@media (max-width: 767px) { .nos-theme .nos-hero-row { column-gap: 32px; } }`, 'ch-min-width'), false);
  return bad;
}

// ---- static tsx verdict (A23): the units wrapper's gap is component-level ----
export function tsxGapFailures(src) {
  const f = [];
  const tag = /<div\b[^>]*aria-label=\{ariaLabel\}[^>]*>/s.exec(src) ?? /<div\b[^>]*className="[^"]*"[^>]*aria-label=\{ariaLabel\}/s.exec(src);
  if (!tag) return ['the units wrapper (the div with aria-label={ariaLabel}) is not found in ShowCountdown.tsx'];
  const cls = /className="([^"]*)"/.exec(tag[0]);
  const tokens = cls ? cls[1].split(/\s+/) : [];
  if (!tokens.includes('gap-4')) f.push('the units wrapper does not carry gap-4 (16px below 1024)');
  if (!tokens.includes('lg:gap-6')) f.push('the units wrapper does not carry lg:gap-6 (24px from 1024)');
  if (tokens.includes('gap-6')) f.push('the units wrapper still carries the bare gap-6 (24px at every width)');
  if (tokens.some((t) => /^(gap-x-|md:gap|sm:gap|xl:gap)/.test(t))) f.push('the units wrapper carries another gap utility: only gap-4 and lg:gap-6');
  return f;
}
// lg is 1024 only if the project neither overrides --breakpoint-lg nor resets the breakpoint scale, and the root font size is the default 16px.
export function breakpointFailures(cssTexts) {
  return cssTexts.flatMap(([file, text]) => (/--breakpoint-(lg|\*)\s*:/.test(text) ? [`${file} overrides the Tailwind breakpoints: lg is no longer 1024px`] : []));
}
export function tsxSelftest() {
  const bad = [];
  const expect = (name, got, want) => { if ((got.length === 0) !== want) bad.push(`${name}: ${want ? 'should pass' : 'should fail'} (${got.join(' | ') || 'no failure'})`); };
  const ok = '<div className="flex gap-4 lg:gap-6" aria-label={ariaLabel}>';
  expect('tsx: gap-4 lg:gap-6 passes', tsxGapFailures(ok), true);
  expect('tsx: attribute order swapped passes', tsxGapFailures('<div aria-label={ariaLabel} className="flex lg:gap-6 gap-4">'), true);
  expect('tsx: the bare gap-6 fails', tsxGapFailures('<div className="flex gap-6" aria-label={ariaLabel}>'), false);
  expect('tsx: gap-4 without lg:gap-6 fails', tsxGapFailures('<div className="flex gap-4" aria-label={ariaLabel}>'), false);
  expect('tsx: gap-4 lg:gap-6 plus gap-6 fails', tsxGapFailures('<div className="flex gap-4 lg:gap-6 gap-6" aria-label={ariaLabel}>'), false);
  expect('tsx: a md: gap fails', tsxGapFailures('<div className="flex gap-4 md:gap-5 lg:gap-6" aria-label={ariaLabel}>'), false);
  expect('tsx: no wrapper fails', tsxGapFailures('<div className="flex gap-4 lg:gap-6">'), false);
  expect('breakpoints: a plain css file passes', breakpointFailures([['a.css', '@theme { --color-x: red; }']]), true);
  expect('breakpoints: an lg override fails', breakpointFailures([['a.css', '@theme { --breakpoint-lg: 70rem; }']]), false);
  expect('breakpoints: a scale reset fails', breakpointFailures([['a.css', '@theme { --breakpoint-*: initial; }']]), false);
  return bad;
}
