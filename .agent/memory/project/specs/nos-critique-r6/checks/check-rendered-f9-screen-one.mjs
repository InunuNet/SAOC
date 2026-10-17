// nos-critique-r6 F9 + F5 - screen-one check (Codi verdict 2026-10-17, via the lead). Run in the stacked tree AFTER f9 (no utility bar) and f5 (220px inner photos):
// at 390x844 on plan-your-visit, symposium and vendors/apply the sub-nav (where the page has one) and the first content line after the hero are visible above y=844.
// Production build (next start, 3010-3019, never 3002); one suite at a time; the server is stopped by PID in finally.
import { finish } from './_lib.mjs';
import { AUTH, require, startServer } from './_server.mjs';

const NAME = 'check-rendered-f9-screen-one.mjs';
const ROUTES = ['/national-show/plan-your-visit', '/national-show/symposium', '/national-show/vendors/apply'];
const FOLD = 844;
const LINE = 24;
const failures = [];
const { chromium } = require('playwright');

const probe = () => {
  const hero = document.querySelector('[data-nos-hero]');
  const sub = document.querySelector('.nos-subnav');
  const main = document.querySelector('main');
  const after = (el) => !!(hero && (hero.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) && !hero.contains(el) && !(sub && sub.contains(el));
  const first = [...main.querySelectorAll('h2, h3, p, legend, label')].find((el) => after(el) && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== 'hidden' && el.textContent.trim() !== '' && !el.closest('nav'));
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  return {
    subBottom: sub ? r(sub).bottom : null,
    firstTag: first ? first.tagName.toLowerCase() : null, firstText: first ? first.textContent.trim().slice(0, 50) : '',
    firstTop: first ? r(first).top : null,
    heroBottom: hero ? r(hero).bottom : null,
  };
};

let browser;
let stop = () => {};
try {
  const srv = await startServer();
  stop = srv.stop;
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: FOLD }, extraHTTPHeaders: { authorization: AUTH } });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    const tag = `${route} @390x844`;
    const res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); continue; }
    const p = await page.evaluate(probe);
    if (p.subBottom !== null && p.subBottom > FOLD) failures.push(`${tag}: the sub-nav ends at y=${Math.round(p.subBottom)}, below the ${FOLD}px fold`);
    if (p.firstTop === null) failures.push(`${tag}: no content heading or paragraph found after the hero`);
    else if (p.firstTop + LINE > FOLD) failures.push(`${tag}: the first content line (${p.firstTag} "${p.firstText}") starts at y=${Math.round(p.firstTop)}, not fully above the ${FOLD}px fold`);
  }
  await ctx.close();
} catch (err) {
  failures.push(`${err.name}: ${err.message}`);
} finally {
  if (browser) await browser.close();
  stop();
}
finish(NAME, failures, 'screen one: sub-nav and the first content line are above y=844 on plan-your-visit, symposium and vendors/apply at 390x844.');
