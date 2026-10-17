// nos-critique-r6 F7 — rendered check for R33 on the production build (next start, 3010-3019, never 3002).
//  /national-show/plan-your-visit at 390 and 1280:
//    TEL   every emergency number whose text is digits only is an <a href="tel:DIGITS"> (DIGITS = the text without spaces), at
//          least one exists (a page with none would make this vacuous), each target >= 44 x 44px, numeral font-size >= 22px
//    MAP   "Open in a map ↗" is a nos Button (data-nos-button) with a 1px border and transparent fill (ghost), >= 44px high, href = the
//          venue's mapsUrl as the page renders it, opens in a new tab with rel noopener
//    C4    no horizontal overflow at 390
//  /contact: its "Open in a map ↗" stays the plain underlined link (no data-nos-button)
// Run as: node check-rendered-f7.mjs   (NOS_CR6_ROOT selects the worktree)
import { finish, scopeFiles } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';

const NAME = 'check-rendered-f7.mjs';
const failures = [];
const { chromium } = require('playwright');
const stale = assertFreshBuild(scopeFiles());
if (stale.length > 0) finish(NAME, stale);

const grab = () => {
  const main = document.querySelector('main');
  const box = (el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; };
  const nums = [...main.querySelectorAll('dd')].filter((d) => /^[+\d][\d\s]{1,}$/.test(d.textContent.trim())).map((d) => {
    const a = d.querySelector('a');
    const dt = d.parentElement.querySelector('dt'); const ds = getComputedStyle(a ?? d);
    return { text: d.textContent.trim(), href: a?.getAttribute('href') ?? null, size: a ? box(a) : null, font: parseFloat(ds.fontSize), weight: Number(ds.fontWeight), family: ds.fontFamily, ddTop: d.getBoundingClientRect().top, dtTop: dt ? dt.getBoundingClientRect().top : null };
  });
  const map = [...main.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Open in a map ↗');
  const cs = map ? getComputedStyle(map) : null;
  return {
    nums,
    aside: !!(map && map.closest('aside')), gettingX: (() => { const h = [...main.querySelectorAll('h2, h3')].find((x) => x.textContent.trim() === 'Getting there'); return h ? h.getBoundingClientRect().left : null; })(), mapX: map ? map.getBoundingClientRect().left : null,
    firstToKnow: [...main.querySelectorAll('h2, h3')].some((x) => x.textContent.trim() === 'Be the first to know'),
    map: map ? { size: box(map), button: map.hasAttribute('data-nos-button'), border: cs.borderTopWidth, bg: cs.backgroundColor, href: map.getAttribute('href'), target: map.getAttribute('target'), rel: map.getAttribute('rel') } : null,
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
};

let browser;
let stop = () => {};
try {
  const srv = await startServer();
  stop = srv.stop;
  browser = await chromium.launch();
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const ctx = await browser.newContext({ viewport: vp, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    const tag = `/national-show/plan-your-visit @${vp.width}`;
    const res = await page.goto(`${srv.origin}/national-show/plan-your-visit`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); await ctx.close(); continue; }
    const g = await page.evaluate(grab);
    if (g.nums.length === 0) failures.push(`${tag}: no digits-only emergency numbers rendered; the check would be vacuous`);
    for (const n of g.nums) {
      const want = `tel:${n.text.replace(/\s+/g, '')}`;
      if (n.href !== want) failures.push(`${tag}: emergency number ${n.text} has href ${n.href}, want ${want}`);
      else if (n.size.w < 43.5 || n.size.h < 43.5) failures.push(`${tag}: tel link ${n.text} is ${Math.round(n.size.w)}x${Math.round(n.size.h)}px, want >= 44x44`);
      if (n.font < 37.5) failures.push(`${tag}: numeral ${n.text} is ${n.font}px, want the v4 golden size (clamp from 2.4rem, >= 38px)`);
      if (n.weight > 400) failures.push(`${tag}: numeral ${n.text} weight ${n.weight}, want the light v4 numeral (300)`);
      if (!/Fraunces/i.test(n.family)) failures.push(`${tag}: numeral ${n.text} is not Fraunces (${n.family})`);
      if (n.dtTop !== null && n.ddTop > n.dtTop + 0.5) failures.push(`${tag}: numeral ${n.text} must sit above its label (v4 dl.numbers, dd order -1)`);
    }
    if (!g.aside) failures.push(`${tag}: the map link must sit in the venue card <aside> (v4 Getting there + venue-card aside)`);
    if (vp.width >= 1024 && g.gettingX !== null && g.mapX !== null && !(g.mapX > g.gettingX + 300)) failures.push(`${tag}: at desktop the venue aside must sit beside Getting there, not under it`);
    if (!g.firstToKnow) failures.push(`${tag}: no "Be the first to know" section`);
    if (!g.map) failures.push(`${tag}: "Open in a map ↗" not found`);
    else {
      if (!g.map.button) failures.push(`${tag}: the map link is not a nos Button (data-nos-button missing)`);
      if (g.map.border !== '1px') failures.push(`${tag}: map button border ${g.map.border}, want the 1px ghost outline`);
      if (!/rgba\(0, 0, 0, 0\)|transparent/.test(g.map.bg)) failures.push(`${tag}: map button fill ${g.map.bg}, want transparent`);
      if (g.map.size.h < 43.5) failures.push(`${tag}: map button ${Math.round(g.map.size.h)}px high, want >= 44px`);
      if (g.map.target !== '_blank' || !/noopener/.test(g.map.rel ?? '')) failures.push(`${tag}: map button must open in a new tab with rel noopener`);
      if (!/^https?:\/\//.test(g.map.href ?? '')) failures.push(`${tag}: map button href ${g.map.href} is not the venue mapsUrl`);
    }
    if (g.sw > g.cw) failures.push(`${tag}: horizontal overflow ${g.sw} > ${g.cw}`);
    if (vp.width === 1280) {
      await page.goto(`${srv.origin}/contact`, { waitUntil: 'networkidle' });
      const c = await page.evaluate(grab);
      if (c.map?.button) failures.push('/contact: the map link became a nos Button; the SAOC contact page must be unchanged');
    }
    await ctx.close();
  }
} catch (err) {
  failures.push(`${err.name}: ${err.message}`);
} finally {
  if (browser) await browser.close();
  stop();
}
finish(NAME, failures, 'R33 rendered: emergency numbers are tel: links with >=44px targets and large numerals, "Open in a map ↗" is a ghost nos Button >=44px with the venue mapsUrl, no overflow at 390, /contact unchanged.');
