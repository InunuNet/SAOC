#!/usr/bin/env node
// F17-A6 (F12-audit P2 #2): on /national-show/sponsors the "Become a sponsor" panel's OUTER edge sits on the R71 axis (the NOS header container edge),
// not 32px inside it. The panel is the white [data-nos-empty-state="sponsors"] card. It fills the axis column (left AND right edge on the axis), no ancestor
// between the section wrap and the card insets it (padding-inline 0), the heading and the sentence and the "Talk to us about sponsorship" action are still in it,
// the "To be confirmed by the show committee" marker still precedes it, and nothing overflows. Widths 2056, 1920, 1280, 390.
// The panel renders only while the live sponsor list is empty (true today); with sponsors listed there is nothing to measure and the check says so (NOTE).
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3662 node --import tsx/esm contracts/checks/launch-weekend/f17/check-f-sponsors.mjs
import { main, openPage, withBrowser, T, near } from './_lib.mjs';

const WIDTHS = [[2056, 1100], [1920, 1080], [1280, 800], [390, 844]];

function measure(sel) {
  const rc = (e) => e.getBoundingClientRect();
  const cs = (e) => getComputedStyle(e);
  const t = (e) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const bar = document.querySelector('#nh .nh-bar');
  if (!bar) return { error: 'no .nh-bar' };
  const axisLeft = rc(bar).left + parseFloat(cs(bar).paddingLeft);
  const axisRight = rc(bar).right - parseFloat(cs(bar).paddingRight);
  const panel = document.querySelector(sel);
  const out = { vw: innerWidth, axisLeft, axisRight, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  if (!panel) return { ...out, none: true };
  const wrap = panel.closest('[data-nos-wrap]');
  const insets = [];
  for (let e = panel.parentElement; e && e !== wrap; e = e.parentElement) {
    const s = cs(e);
    if (parseFloat(s.paddingLeft) > 0.5 || parseFloat(s.paddingRight) > 0.5 || parseFloat(s.marginLeft) > 0.5 || parseFloat(s.marginRight) > 0.5) insets.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} pad ${s.paddingLeft}/${s.paddingRight} margin ${s.marginLeft}/${s.marginRight}`);
  }
  const marker = document.querySelector('[data-confirmation-badge]');
  const pos = marker ? marker.compareDocumentPosition(panel) : 0;
  return {
    ...out,
    left: rc(panel).left, right: rc(panel).right, width: rc(panel).width, insets,
    heading: t(panel.querySelector('h2')), hasSentence: t(panel).length > 40, action: [...panel.querySelectorAll('a')].map(t),
    markerText: marker ? t(marker) : null, markerBefore: Boolean(pos & Node.DOCUMENT_POSITION_FOLLOWING),
  };
}

await main('F17-A6 sponsors panel axis', async (r) => {
  await withBrowser(async (browser) => {
    const { ctx, page, status } = await openPage(browser, { width: 1280, height: 800 }, T.sponsors.route);
    if (status !== 200) { r.fail(`${T.sponsors.route}: HTTP ${status}`); await ctx.close(); return; }
    let seen = 0;
    for (const [w, h] of WIDTHS) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(150);
      const m = await page.evaluate(measure, T.sponsors.panelSelector);
      const tag = `${T.sponsors.route} @${w}`;
      if (m.error) { r.fail(`${tag}: ${m.error}`); continue; }
      if (m.overflowX > 1) r.fail(`${tag}: horizontal overflow ${m.overflowX}px`);
      if (m.none) continue;
      seen += 1;
      const tol = T.sponsors.axisTolerancePx;
      if (!near(m.left, m.axisLeft, tol)) r.fail(`${tag}: the panel's outer left edge is ${m.left.toFixed(1)}px, the axis is ${m.axisLeft.toFixed(1)}px (${(m.left - m.axisLeft).toFixed(1)}px inside)`);
      if (!near(m.right, m.axisRight, tol)) r.fail(`${tag}: the panel's outer right edge is ${m.right.toFixed(1)}px, the axis column ends at ${m.axisRight.toFixed(1)}px`);
      if (m.insets.length) r.fail(`${tag}: ancestor inset(s) between the section wrap and the panel: ${m.insets.join('; ')}`);
      if (m.heading !== T.sponsors.headingText) r.fail(`${tag}: panel heading "${m.heading}", want "${T.sponsors.headingText}"`);
      if (!m.hasSentence) r.fail(`${tag}: the panel lost its sentence`);
      if (!m.action.some((a) => a === 'Talk to us about sponsorship')) r.fail(`${tag}: the "Talk to us about sponsorship" action is gone (${JSON.stringify(m.action)})`);
      if (!(m.markerText ?? '').includes('To be confirmed by the show committee') || !m.markerBefore) r.fail(`${tag}: the "To be confirmed by the show committee" marker must still precede the panel (got ${JSON.stringify(m.markerText)}, before=${m.markerBefore})`);
    }
    if (!seen) console.log('NOTE: the sponsor list is not empty, so the "Become a sponsor" panel does not render and nothing was measured (axis behaviour of the listing grid is covered by F12-A15)');
    await ctx.close();
  });
});
