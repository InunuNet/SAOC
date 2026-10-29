// F1c A16 (NOS Design LG-RF, comms.md 2026-10-25/26/27; ruling "holds" 2026-10-28): the legal pages /privacy, /terms and /refunds keep the DS-1 legal shell. A regression gate, at 390, 1440 and 2056:
//  - no eyebrow in the hero and no max-w-[720px] anywhere in main (LegalHero forwards no eyebrow);
//  - the draft notice, where the page has one, has no box (border 0 on the top, left and right, transparent fill);
//  - the draft notice on /refunds and /members (one shared DraftNotice) is 15px with a 1px solid rule below;
//  - index = h2: the section index links are exactly the page's h2s, in order, and the counts are 11 (/privacy), 19 (/terms), 9 (/refunds);
//  - h2 gaps 56: every h2 that follows running prose sits 56px (+-1) below the previous sibling, and every h2 has margin-top 56 (the SAOC host measures 56 at the first h2 too; the first-h2-0 rule is NOS-host only).
// /judging, /members and /404 keep their eyebrows (out of scope here); /members is visited only for its draft notice.
import { withSite, openPage, check, finish } from './lib.mjs';
const COUNTS = { '/privacy': 11, '/terms': 19, '/refunds': 9 };
const PROBE = `() => { const main = document.querySelector('main'); const px = (v) => parseFloat(v);
  const prose = main.querySelector('.doc-prose'); const h2s = prose ? [...prose.querySelectorAll(':scope > h2')] : [];
  const links = [...main.querySelectorAll('[data-doc-index-link]')];
  const notice = main.querySelector('p[data-placeholder="true"]') || (prose && prose.firstElementChild && prose.firstElementChild.matches('p') && prose.firstElementChild.firstElementChild && prose.firstElementChild.firstElementChild.matches('strong') && /draft|not yet available/i.test(prose.firstElementChild.textContent) ? prose.firstElementChild : null);
  let n = null; if (notice) { const c = getComputedStyle(notice); n = { top: px(c.borderTopWidth), left: px(c.borderLeftWidth), right: px(c.borderRightWidth), bottom: px(c.borderBottomWidth), bottomStyle: c.borderBottomStyle, bg: c.backgroundColor, size: px(c.fontSize) }; }
  const gaps = h2s.map((h, i) => { const prev = h.previousElementSibling; const cs = getComputedStyle(h); return { id: h.id, margin: px(cs.marginTop), prevTag: prev ? prev.tagName : null, gap: prev ? h.getBoundingClientRect().top - prev.getBoundingClientRect().bottom : null, first: i === 0 }; });
  return { eyebrow: Boolean(document.querySelector('[data-page-hero-eyebrow]')), max720: [...main.querySelectorAll('[class]')].filter((e) => typeof e.className === 'string' && e.className.includes('max-w-[720px]')).length,
    notice: n, h2: h2s.map((h) => h.id), links: links.map((a) => (a.getAttribute('href') || '').slice(1)), gaps }; }`;
const transparent = (c) => /rgba\(0, 0, 0, 0\)|^transparent$/.test(c) || /\/ 0\)$|, 0\)$/.test(c);
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [390, 1440, 2056]) for (const path of ['/privacy', '/terms', '/refunds', '/members']) {
    const { page, ctx, status } = await openPage(browser, ctxOpts, base, path, width); const w = `${path}@${width}`; check(status === 200, `${w} status ${status}`);
    const r = await page.evaluate(`(${PROBE})()`);
    const ruled = path !== '/members'; // /members: the draft notice only
    if (ruled) {
      check(!r.eyebrow, `${w}: the hero carries an eyebrow, want none (LG-RF)`);
      check(r.max720 === 0, `${w}: ${r.max720} element(s) carry max-w-[720px] in main (LG-RF)`);
      check(r.h2.length === COUNTS[path], `${w}: ${r.h2.length} h2s, want ${COUNTS[path]}`);
      check(r.links.length === r.h2.length && r.links.every((id, i) => id === r.h2[i]), `${w}: the index is not the h2 list (index ${r.links.length}, h2 ${r.h2.length}; first mismatch ${r.links.findIndex((id, i) => id !== r.h2[i])})`);
      for (const g of r.gaps) {
        check(g.margin === 56, `${w}: h2 #${g.id} margin-top is ${g.margin}, want 56`);
        if (/^(P|UL|OL)$/.test(g.prevTag)) check(Math.abs(g.gap - 56) <= 1, `${w}: h2 #${g.id} sits ${g.gap === null ? 'n/a' : g.gap.toFixed(1)}px (margin ${g.margin}) below the prose above, want 56`);
      }
    }
    if (path === '/refunds' || path === '/members') check(r.notice !== null, `${w}: no draft notice found`);
    if (r.notice) {
      check(r.notice.top === 0 && r.notice.left === 0 && r.notice.right === 0, `${w}: the draft notice has a box border (top ${r.notice.top}, left ${r.notice.left}, right ${r.notice.right}), want 0`);
      check(transparent(r.notice.bg), `${w}: the draft notice fill is ${r.notice.bg}, want transparent`);
      if (path === '/refunds' || path === '/members') {
        check(r.notice.size === 15, `${w}: the draft notice is ${r.notice.size}px, want 15`);
        check(r.notice.bottom === 1 && r.notice.bottomStyle === 'solid', `${w}: the draft notice rule below is ${r.notice.bottom}px ${r.notice.bottomStyle}, want 1px solid`);
      }
    }
    await ctx.close();
  }
});
finish('legal-lg-rf');
