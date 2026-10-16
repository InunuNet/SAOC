#!/usr/bin/env node
// F17-A4 (R74-2, R74-4). Runtime on the hub.
//  R74-2  /national-show renders no ShowSectionNav ("More on the National Show", nav[aria-label="National Show section"]); the grouped index
//         (nav[aria-label="Explore the show pages"], F12 R69) is NO LONGER on the hub (F18 amendment: it stays on the 16 inner routes, asserted by check-m-index); inner pages still carry their "<group> pages" sub-nav.
//  R74-4  On the hub, where two ADJACENT <section>s share a ground (same computed background-color, gold+gold and royal+royal on today's hub) the
//         gap between the last content of the first and the first content of the second is ONE section rhythm unit (clamp(72px, 9vw, 120px)), not two.
//         Every other adjacent pair on the hub keeps two units, and no other NOS route changes (every pair there keeps two units).
//         Measured at 1920, 1280, 768, 390 against the real section rhythm formula.
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3662 node --import tsx/esm contracts/checks/launch-weekend/f17/check-d-hub.mjs
import { main, openPage, withBrowser, VP, T, HUB, NOS_ROUTES, sectionPadOf, near } from './_lib.mjs';

const WIDTHS = [[1920, 1080], [1280, 800], [768, 1024], [390, 844]];

function measure(tokens) {
  const rc = (e) => e.getBoundingClientRect();
  const hero = document.querySelector('[data-nos-hero]');
  const root = hero?.parentElement;
  if (!root) return { error: 'no hero' };
  const secs = [...root.children].filter((e) => e !== hero && e.tagName === 'SECTION' && rc(e).height > 0);
  const bg = (e) => { const c = getComputedStyle(e); return `${c.backgroundColor}|${c.backgroundImage}`; };
  const pairs = [];
  for (let i = 0; i + 1 < secs.length; i += 1) {
    const a = secs[i], b = secs[i + 1];
    if (a.nextElementSibling !== b) continue; // only DOM-adjacent sections
    const wa = a.querySelector(':scope > [data-nos-wrap]'), wb = b.querySelector(':scope > [data-nos-wrap]');
    if (!wa || !wb) continue;
    const kidsA = [...wa.children].filter((e) => rc(e).height > 0), kidsB = [...wb.children].filter((e) => rc(e).height > 0);
    const lastBottom = Math.max(...kidsA.map((e) => rc(e).bottom));
    const firstTop = Math.min(...kidsB.map((e) => rc(e).top));
    pairs.push({ a: (a.getAttribute('aria-labelledby') || a.className).slice(0, 40), b: b.className.slice(0, 60), same: bg(a) === bg(b), gap: firstTop - lastBottom });
  }
  return {
    vw: document.documentElement.clientWidth,
    pairs,
    sectionNav: document.querySelectorAll(tokens.noSectionNavSelector).length,
    moreText: (document.body.textContent ?? '').includes(tokens.noSectionNavText),
    explore: document.querySelectorAll(tokens.exploreIndexSelector).length,
    subnav: [...document.querySelectorAll('nav')].filter((n) => / pages$/.test(n.getAttribute('aria-label') ?? '') && n.getAttribute('aria-label') !== 'Explore the show pages' && !n.closest('#nh, #nd, #nf')).length,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}

await main('F17-A4 hub', async (r) => {
  await withBrowser(async (browser) => {
    const tol = T.hub.gapTolerancePx;
    const { ctx, page, status } = await openPage(browser, VP.desktop, HUB);
    if (status !== 200) { r.fail(`${HUB}: HTTP ${status}`); await ctx.close(); return; }
    let joinedSeen = 0;
    for (const [w, h] of WIDTHS) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(150);
      const m = await page.evaluate(measure, T.hub);
      const tag = `${HUB} @${w}`;
      if (m.error) { r.fail(`${tag}: ${m.error}`); continue; }
      if (m.sectionNav !== 0) r.fail(`${tag}: ${m.sectionNav} ShowSectionNav landmark(s) rendered`);
      if (m.moreText) r.fail(`${tag}: the text "${T.hub.noSectionNavText}" renders`);
      if (m.explore !== 0) r.fail(`${tag}: ${m.explore} grouped index landmarks, want 0 (F18 R74 #2: the Explore index is on the 16 inner routes only; the hub has its own section links)`);
      if (m.subnav !== 0) r.fail(`${tag}: the hub carries a "<group> pages" sub-nav (F3: none on the hub)`);
      if (m.overflowX > 1) r.fail(`${tag}: horizontal overflow ${m.overflowX}px`);
      const pad = sectionPadOf(m.vw);
      if (!m.pairs.length) r.fail(`${tag}: no adjacent section pairs measured`);
      for (const p of m.pairs) {
        const want = p.same ? pad : 2 * pad;
        if (p.same) joinedSeen += 1;
        if (!near(p.gap, want, tol)) r.fail(`${tag}: ${p.same ? 'same-ground' : 'different-ground'} pair "${p.a}" -> "${p.b}" is ${p.gap.toFixed(1)}px apart, want ${want.toFixed(1)}px (${p.same ? 'ONE' : 'two'} rhythm unit${p.same ? '' : 's'}, unit ${pad.toFixed(1)}px)`);
      }
    }
    if (joinedSeen < WIDTHS.length) r.fail(`only ${joinedSeen} same-ground pair measurements across ${WIDTHS.length} widths: the hub is expected to hold at least one same-ground adjacent pair, the check would be vacuous`);
    await ctx.close();

    // No other route changes: every adjacent pair keeps two units, and inner pages keep their sub-nav.
    for (const route of NOS_ROUTES.filter((x) => x !== HUB)) {
      const { ctx: c2, page: p2, status: s2 } = await openPage(browser, VP.desktop, route);
      if (s2 !== 200) { r.fail(`${route}: HTTP ${s2}`); await c2.close(); continue; }
      const m = await p2.evaluate(measure, T.hub);
      const pad = sectionPadOf(m.vw);
      for (const p of m.pairs) if (!near(p.gap, 2 * pad, tol)) r.fail(`${route} @1280: pair "${p.a}" -> "${p.b}" is ${p.gap.toFixed(1)}px apart, want ${(2 * pad).toFixed(1)}px (the join is hub-only)`);
      if (m.sectionNav !== 0) r.fail(`${route}: a ShowSectionNav landmark renders`);
      if (route !== '/national-show/tickets' && m.subnav !== 1) r.fail(`${route}: ${m.subnav} "<group> pages" sub-navs, want 1 (inner pages keep it)`);
      await c2.close();
    }
  });
});
