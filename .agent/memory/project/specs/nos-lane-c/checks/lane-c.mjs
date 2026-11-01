// Lane C gate. Usage: node lane-c.mjs <C1|C2|C3|C4|C5> (server on PORT, default 3094).
import { chromium } from 'playwright';
const item = process.argv[2], PORT = process.env.PORT || 3094;
const NOS = `http://nos.localhost:${PORT}`, SAOC = `http://localhost:${PORT}`;
let bad = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); if (!ok) bad++; };
const browser = await chromium.launch();
const open = async (url, width, height = 900) => {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  return page;
};
if (item === 'C1') for (const w of [320, 390, 768, 1024, 1440, 2056]) {
  const p = await open(NOS + '/', w);
  const m = await p.evaluate(() => ({ h: [...document.querySelectorAll('main h2.nos-hm-h2')].map((e) => { const c = getComputedStyle(e); return [parseFloat(c.fontSize), c.fontWeight]; }), over: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  check(`C1 ${w} six h2 at >=32px weight 300`, m.h.length === 6 && m.h.every(([s, t]) => s >= 32 && t === '300'), JSON.stringify(m.h[0]));
  if (w <= 390) check(`C1 ${w} exactly 32px`, m.h.every(([s]) => s === 32));
  check(`C1 ${w} no page overflow`, m.over <= 0, String(m.over));
  await p.context().close();
}
if (item === 'C2') for (const [r, s] of [['/', '[data-hm-visit-card]'], ['/what-to-expect', '.nos-we-card'], ['/sponsors', '.doc-aside']]) {
  const p = await open(NOS + r, 1440);
  const t = await p.evaluate((q) => { const e = document.querySelector(q); return e && [getComputedStyle(e).position, getComputedStyle(e).top]; }, s);
  check(`C2 ${r} sticky top 100`, t && t[0] === 'sticky' && t[1] === '100px', JSON.stringify(t));
  await p.context().close();
}
if (item === 'C3') for (const r of ['/faq', '/plan-your-visit', '/privacy', '/terms', '/refunds']) for (const w of [767, 768, 779, 780, 1023]) {
  const p = await open(NOS + r, w, 1024);
  await p.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight / 2, behavior: 'instant' }));
  await p.waitForTimeout(300);
  const m = await p.evaluate(() => { const a = document.querySelector('nav[data-doc-index]')?.closest('[data-doc-aside]'), h = document.querySelector('header'); return a && { css: getComputedStyle(a).top, top: a.getBoundingClientRect().top, hb: h.getBoundingClientRect().bottom, pos: getComputedStyle(h).position }; });
  const pinned = m && ['sticky', 'fixed'].includes(m.pos);
  check(`C3 ${r} ${w} scroller clear of header`, m && (pinned ? m.top >= m.hb - 1 && m.css === '97px' : m.css === '0px'), JSON.stringify(m));
  await p.context().close();
}
if (item === 'C4') {
  const first = await open(SAOC + '/events', 1440);
  const slug = await first.evaluate(() => [...document.querySelectorAll('main a[href^="/events/"]')].map((a) => a.getAttribute('href')).find((h) => h.split('/').length === 3));
  await first.context().close();
  for (const r of ['/about', '/events', '/sponsors', slug].filter(Boolean)) for (const w of [768, 1024, 1280, 1440, 2056]) {
    const p = await open(SAOC + r, w);
    const m = await p.evaluate(() => {
      const copy = document.querySelector('[data-page-hero-copy]'); if (!copy) return null;
      const right = (e) => { const g = document.createRange(); g.selectNodeContents(e); return g.getBoundingClientRect().right; };
      const kids = [...copy.querySelectorAll('h1,[data-page-hero-lede],[data-hero-facts] > div,a')];
      const hdr = [...document.querySelectorAll('header a, header button')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect().right);
      const facts = [...copy.querySelectorAll('[data-hero-facts] > div')].map((e) => Math.round(e.getBoundingClientRect().top));
      const broken = [];
      for (const e of copy.querySelectorAll('[data-hero-facts] dd, [data-hero-facts] dt')) for (const n of e.childNodes) {
        if (n.nodeType !== 3) continue;
        for (const hit of n.textContent.matchAll(/\S+/g)) { const g = document.createRange(); g.setStart(n, hit.index); g.setEnd(n, hit.index + hit[0].length); if (new Set([...g.getClientRects()].map((q) => Math.round(q.top))).size > 1) broken.push(hit[0]); }
      }
      const factsRight = Math.max(0, ...[...copy.querySelectorAll('[data-hero-facts] > div')].map(right));
      return { broken, factsRight, vw: document.documentElement.clientWidth, copyRight: Math.max(...kids.map(right)), cta: Math.max(...hdr), hero: document.querySelector('[data-page-hero]').getBoundingClientRect().height, rows: new Set(facts).size, nfacts: facts.length, typo: !!document.querySelector('[data-page-hero-variant=type]') };
    });
    if (!m) { check(`C4 ${r} ${w} has PageHero`, false); await p.context().close(); continue; }
    check(`C4 ${r} ${w} no word broken across lines in the facts`, m.broken.length === 0, m.broken.join(','));
    check(`C4 ${r} ${w} facts stay inside the viewport`, m.factsRight <= m.vw, `${Math.round(m.factsRight)} of ${m.vw}`);
    if (w >= 1440) check(`C4 ${r} ${w} copy right <= CTA right`, m.copyRight <= m.cta + 1, `${Math.round(m.copyRight)} vs ${Math.round(m.cta)}`);
    // Baseline on main: the event hero is already taller than 480 (530 at 1024, 496 at 1440), and /about is 496 at 1024, where the cap does not bite.
    if (!m.typo && w >= 1440) { const cap = r.split('/').length === 3 ? 540 : 481; check(`C4 ${r} ${w} hero height holds`, m.hero <= cap, `${m.hero} (cap ${cap})`); }
    if (m.nfacts && w >= 1440) check(`C4 ${r} ${w} facts one row`, m.rows === 1, `${m.nfacts} facts in ${m.rows} rows`);
    await p.context().close();
  }
}
if (item === 'C5') {
  const p = await open(SAOC + (process.env.BAND_ROUTE || '/events/19th-south-african-national-orchid-show'), 390);
  await p.locator('[data-show-band-countdown]').first().scrollIntoViewIfNeeded();
  const m = await p.evaluate(() => {
    const cells = [...document.querySelectorAll('[data-show-band-countdown] [data-countdown-cell]')];
    const rects = cells.map((c) => { const g = document.createRange(); g.selectNodeContents(c.lastElementChild); const r = g.getBoundingClientRect(), b = c.getBoundingClientRect(); return { t: c.lastElementChild.textContent, l: r.left, r: r.right, top: r.top, bl: b.left, br: b.right }; });
    const gaps = []; for (let i = 1; i < rects.length; i++) if (Math.abs(rects[i].top - rects[i - 1].top) < 2) gaps.push(rects[i].l - rects[i - 1].r);
    return { n: cells.length, gaps, inside: rects.every((r) => r.l >= r.bl && r.r <= r.br), over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  check('C5 ShowBand has four cells at 390', m.n === 4);
  check('C5 labels at least 8px apart at 390', m.gaps.length > 0 && m.gaps.every((g) => g >= 8), JSON.stringify(m.gaps.map(Math.round)));
  check('C5 labels inside their cells', m.inside);
  check('C5 no page overflow', m.over <= 0);
  await p.context().close();
}
await browser.close();
process.exit(bad ? 1 : 0);
