// F1c A12 (NOS Design beta check): /events/[slug] facts (factsAlign=start). "Western Cape" must not break mid-word.
// Ruled fix: overflow-wrap normal; cell min-width min-content; dd balanced, <=3 lines, breaks at spaces only; flex-wrap onto a second row starting at h1.left;
// F1c levers apply (column gap 24 at 768-1279). NOS Design ruling 3 (final): dropping overflow-wrap anywhere, min-width 0 and the >=1024 dd nowrap is ratified, BUT the event facts stay START-aligned (HM-7, not centred by default):
// every cell has dt.left = dd.left +-1 and the first cell's left = h1.left +-1; the row flex-wraps to a second row that also starts at h1.left; each word is one client rect; <=3 lines per cell; dd weight 300 at >=32px, 400 at 24-31.99px.
// (The centred variant keeps dd nowrap; the start variant must not.)
// Route: the 19th national show event if linked from /events, else the first /events/[slug] with a facts row. Events need live Sanity, so locally (fixture replay has no events) it FAILS loudly (zero facts rendered is never a pass);
// the failing-on-main proof is the phase-5 run against beta.
import { withSite, openPage, check, finish } from './lib.mjs';
const PROBE = `() => { const dl = document.querySelector('.hero-facts'); if (!dl) return null; const h1 = document.querySelector('h1'); const h1l = h1.getBoundingClientRect().left;
  const cells = [...dl.children]; const fb = dl.getBoundingClientRect(); const copy = dl.closest('[data-page-hero-copy]') || dl.parentElement; const cb = copy.getBoundingClientRect();
  const words = (el) => { let n = 0, broken = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let t; (t = w.nextNode());) { const re = /\\S+/g; for (let m; (m = re.exec(t.data));) { const r = document.createRange(); r.setStart(t, m.index); r.setEnd(t, m.index + m[0].length); n++; if (r.getClientRects().length > 1) broken.push(m[0]); } } return { n, broken }; };
  const lines = (e) => { const c = getComputedStyle(e); return e.getBoundingClientRect().height / (parseFloat(c.lineHeight) || parseFloat(c.fontSize) * 1.35); };
  const out = cells.map((c) => { const dt = c.querySelector('dt'), dd = c.querySelector('dd'); const cr = c.getBoundingClientRect(); const dcs = getComputedStyle(dd);
    return { top: cr.top, left: cr.left, ddLeft: dd.getBoundingClientRect().left, dtLeft: dt.getBoundingClientRect().left, over: c.scrollWidth - c.clientWidth, minW: getComputedStyle(c).minWidth, ow: dcs.overflowWrap, ddLines: lines(dd), ddSize: parseFloat(dcs.fontSize), ddWeight: parseInt(dcs.fontWeight, 10), ws: dcs.whiteSpace, ta: getComputedStyle(c).textAlign, wrap: dcs.textWrap, brokenDd: words(dd).broken, brokenDt: words(dt).broken, text: dd.textContent.trim() }; });
  return { h1l, align: dl.dataset.factsAlign, jc: getComputedStyle(dl).justifyContent, fw: getComputedStyle(dl).flexWrap, gap: getComputedStyle(dl).columnGap, factsRight: fb.right, copyRight: cb.right, factsOver: dl.scrollWidth - dl.clientWidth, cells: out }; }`;
await withSite(async ({ base, browser, ctxOpts, live }) => {
  let slug = null;
  { const { page, ctx, status } = await openPage(browser, ctxOpts, base, '/events', 1280);
    if (status === 200) { const hrefs = await page.$$eval('a[href^="/events/"]', (as) => as.map((a) => ({ h: a.getAttribute('href'), t: a.textContent || '' })).filter((x) => !/\.ics/.test(x.h) && x.h.split('/').length === 3));
      const nat = hrefs.find((x) => /19(th)?\b.*national|national.*19/i.test(x.h + ' ' + x.t)); slug = (nat || hrefs[0] || {}).h || null; }
    await ctx.close(); }
  if (!slug) { check(false, `no /events/[slug] link renders${live ? '' : ' (fixture replay has no events: A12 is a phase-5 check, run it with DC_BASE_URL=beta)'}; zero event facts rendered, so nothing is proven`); finish('event-facts'); return; }
  for (const width of [1024, 1200, 1280, 1440, 2056]) {
    const { page, ctx, status } = await openPage(browser, ctxOpts, base, slug, width); const w = `${slug}@${width}`; check(status === 200, `${w} status ${status}`);
    const r = await page.evaluate(`(${PROBE})()`);
    if (!r) { check(false, `${w} has no .hero-facts row, zero event facts rendered`); await ctx.close(); continue; }
    check(r.factsOver <= 0 && r.factsRight <= r.copyRight + 0.5, `${w}: facts overflow the copy column (scroll overflow ${r.factsOver}, right ${r.factsRight.toFixed(0)} vs ${r.copyRight.toFixed(0)})`);
    check(r.align === 'start' && /flex-start|start|normal/.test(r.jc), `${w}: facts are not start-aligned (data-facts-align ${r.align}, justify-content ${r.jc}), want start (HM-7)`);
    check(r.fw === 'wrap', `${w}: the facts row is flex-wrap ${r.fw}, want wrap (a second row)`);
    if (width < 1280) check(r.gap === '24px', `${w}: column gap is ${r.gap}, want 24px`);
    const first = Math.min(...r.cells.map((c) => c.top));
    for (const c of r.cells) {
      const t = c.text.slice(0, 30);
      check(c.brokenDd.length === 0, `${w}: dd "${t}" breaks mid-word: ${c.brokenDd.join(', ')}`);
      check(c.brokenDt.length === 0, `${w}: a dt in the "${t}" cell breaks mid-word: ${c.brokenDt.join(', ')}`);
      check(c.ow === 'normal', `${w}: dd "${t}" overflow-wrap is ${c.ow}, want normal`);
      check(/min-content/.test(c.minW), `${w}: cell "${t}" min-width is ${c.minW}, want min-content`);
      check(/balance/.test(c.wrap), `${w}: dd "${t}" text-wrap is ${c.wrap}, want balance`);
      check(c.ddLines <= 3.05, `${w}: dd "${t}" is ${c.ddLines.toFixed(1)} lines, want <=3`);
      check(c.over <= 0, `${w}: cell "${t}" overflows by ${c.over}px`);
      check(Math.abs(c.dtLeft - c.ddLeft) <= 1, `${w}: dt.left ${c.dtLeft.toFixed(1)} != dd.left ${c.ddLeft.toFixed(1)} in "${t}"`);
      check(c.ws !== 'nowrap', `${w}: dd "${t}" is white-space nowrap, want wrapping at spaces (nowrap is the centred variant only)`);
      if (c.top > first + 1) check(Math.abs(c.left - r.h1l) <= 1, `${w}: wrapped cell "${t}" starts at ${c.left.toFixed(1)}, want h1.left ${r.h1l.toFixed(1)}`);
      else if (c.left === Math.min(...r.cells.filter((x) => x.top <= first + 1).map((x) => x.left))) check(Math.abs(c.left - r.h1l) <= 1, `${w}: first cell "${t}" starts at ${c.left.toFixed(1)}, want h1.left ${r.h1l.toFixed(1)} (start-aligned, not centred)`);
      const wantWt = c.ddSize >= 32 ? 300 : c.ddSize >= 24 ? 400 : null;
      check(wantWt !== null && c.ddWeight === wantWt, `${w}: dd "${t}" is ${c.ddSize.toFixed(1)}px at weight ${c.ddWeight}, want ${wantWt ?? 'size >= 24'} (300 at >=32px, 400 at 24-31.99px)`);
    }
    await ctx.close();
  }
});
finish('event-facts');
