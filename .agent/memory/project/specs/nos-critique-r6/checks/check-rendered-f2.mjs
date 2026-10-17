// nos-critique-r6 F2 — rendered check for R63 on the production build (next start, 3010-3019, never 3002).
//   /national-show/zz-no-such-page and /national-show/archive/1900/extra: HTTP 404, NOS chrome (footer#nf, no SAOC
//   HTTP 404 and noindex (meta robots or X-Robots-Tag), footer), the .nos-theme scope, one h1 "This orchid has left the bench.", three recovery links in the order Tickets, National Show, Plan your visit (R67) with
//   the right hrefs, links >= 44px high, no horizontal overflow at 390 and 1280.
//   below 480px (390) the three links stack full width, each 48px (+-1) tall with a 12px (+-1) gap; >= 480 unchanged
//   archive/[year]: one valid year returns 200 (the catch-all must not shadow it), an invalid year returns 404 with the NOS chrome
//   /zz-no-such-page (outside the show): still 404 with the SAOC chrome and no NOS footer (root not-found unchanged).
//   /national-show/faq: still 200 (the catch-all must not shadow a real route).
import { finish } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';
import { scopeFiles } from './_lib.mjs';

const NAME = 'check-rendered-f2.mjs';
const failures = [];
const { chromium } = require('playwright');
const LABELS = [['Tickets', '/national-show/tickets'], ['National Show', '/national-show'], ['Plan your visit', '/national-show/plan-your-visit']];

const stale = assertFreshBuild(scopeFiles().filter((f) => f.includes('not-found') || f.includes('[...slug]')));
if (stale.length > 0) finish(NAME, stale);

let browser;
let stop = () => {};
try {
  const srv = await startServer();
  stop = srv.stop;
  browser = await chromium.launch();
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const ctx = await browser.newContext({ viewport: vp, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    for (const route of ['/national-show/zz-no-such-page', '/national-show/archive/1900/extra']) {
      const tag = `${route} @${vp.width}`;
      const res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 404) { failures.push(`${tag}: HTTP ${res && res.status()}, want 404`); continue; }
      const m = await page.evaluate((labels) => {
        const main = document.querySelector('main');
        const hs = [...(main ? main.querySelectorAll('h1') : [])].map((h) => h.textContent.trim());
        const links = labels.map(([label, href]) => {
          const a = [...(main ? main.querySelectorAll('a') : [])].find((x) => x.getAttribute('href') === href && x.textContent.trim() === label);
          return a ? { label, href, w: a.getBoundingClientRect().width, h: a.getBoundingClientRect().height, y: a.getBoundingClientRect().top + window.scrollY, x: a.getBoundingClientRect().left } : null;
        });
        return {
          nosFooter: !!document.querySelector('footer#nf'),
          saocFooter: !!document.querySelector('footer.bg-primary-800'),
          scope: !!document.querySelector('.nos-theme'),
          robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '', hs, links, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        };
      }, LABELS);
      const header = (res.headers()['x-robots-tag'] ?? '');
      if (!/noindex/i.test(m.robots) && !/noindex/i.test(header)) failures.push(`${tag}: not noindex (meta robots "${m.robots}", X-Robots-Tag "${header}")`);
      if (!m.nosFooter) failures.push(`${tag}: NOS footer (footer#nf) missing, so the NOS chrome is not mounted`);
      if (m.saocFooter) failures.push(`${tag}: SAOC footer present on a /national-show route`);
      if (!m.scope) failures.push(`${tag}: no .nos-theme scope element`);
      if (m.hs.length !== 1 || m.hs[0] !== 'This orchid has left the bench.') failures.push(`${tag}: h1s ${JSON.stringify(m.hs)}, want exactly ["This orchid has left the bench."]`);
      m.links.forEach((l, i) => { if (!l) failures.push(`${tag}: recovery link "${LABELS[i][0]}" -> ${LABELS[i][1]} missing`); else if (l.h < 43.5) failures.push(`${tag}: link "${l.label}" is ${l.h}px high, want >= 44px`); });
      if (m.links.every(Boolean)) {
        const order = m.links.map((l) => l.y * 10000 + l.x);
        if (order.some((v, i) => i > 0 && v < order[i - 1])) failures.push(`${tag}: recovery links are not in order National Show, Tickets, Plan your visit`);
      }
      if (vp.width < 480 && m.links.every(Boolean)) {
        const ws = m.links.map((l) => l.w);
        if (Math.max(...ws) - Math.min(...ws) > 2 || Math.min(...ws) < vp.width - 80) failures.push(`${tag}: below 480 the three links must stack at full width, got widths ${ws.map(Math.round)}`);
        m.links.forEach((l, i) => { if (Math.abs(l.h - 48) > 1) failures.push(`${tag}: stacked link "${l.label}" is ${l.h}px high, want 48px`); if (i > 0 && Math.abs(l.y - (m.links[i - 1].y + m.links[i - 1].h) - 12) > 1.5) failures.push(`${tag}: gap above "${l.label}" is ${Math.round(l.y - (m.links[i - 1].y + m.links[i - 1].h))}px, want 12px`); });
      }
      if (m.sw > m.cw) failures.push(`${tag}: horizontal overflow ${m.sw} > ${m.cw}`);
    }
    await ctx.close();
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, extraHTTPHeaders: { authorization: AUTH } });
  const page = await ctx.newPage();
  const outside = await page.goto(`${srv.origin}/zz-no-such-page`, { waitUntil: 'networkidle' });
  if (!outside || outside.status() !== 404) failures.push(`/zz-no-such-page: HTTP ${outside && outside.status()}, want 404`);
  else if (await page.evaluate(() => !!document.querySelector('footer#nf'))) failures.push('/zz-no-such-page: shows the NOS footer; the SAOC root not-found must stay SAOC');
  const archive = await page.goto(`${srv.origin}/national-show/archive`, { waitUntil: 'networkidle' });
  let yearHrefs = archive && archive.status() === 200 ? await page.$$eval('a[href^="/national-show/archive/"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')))]) : [];
  if (yearHrefs.length === 0) console.log('VACUOUS: no published editions; the /national-show/archive index lists no years, so "a valid year returns 200" cannot be tested (check-static-f2 asserts archive/[year]/page.tsx exists beside the [...slug] catch-all)');
  else {
    let validOk = false;
    for (const h of yearHrefs) { const r = await page.goto(`${srv.origin}${h}`, { waitUntil: 'networkidle' }); if (r && r.status() === 200) { validOk = true; break; } }
    if (!validOk) failures.push(`no valid archive year returned 200 (tried ${yearHrefs.join(', ')}); the catch-all must not shadow archive/[year]`);
  }
  const badYear = await page.goto(`${srv.origin}/national-show/archive/1900`, { waitUntil: 'networkidle' });
  if (!badYear || badYear.status() !== 404) failures.push(`/national-show/archive/1900: HTTP ${badYear && badYear.status()}, want 404`);
  else if (await page.evaluate(() => !document.querySelector('footer#nf'))) failures.push('/national-show/archive/1900: 404 without the NOS chrome');
  const faq = await page.goto(`${srv.origin}/national-show/faq`, { waitUntil: 'networkidle' });
  if (!faq || faq.status() !== 200) failures.push(`/national-show/faq: HTTP ${faq && faq.status()}, the catch-all must not shadow real routes`);
  await ctx.close();
} catch (err) {
  failures.push(`${err.name}: ${err.message}`);
} finally {
  if (browser) await browser.close();
  stop();
}
finish(NAME, failures, 'R63 rendered: unknown /national-show routes return 404 with the NOS chrome, one h1, three ordered 44px recovery links, no overflow at 390 and 1280; the SAOC root 404 and real routes unchanged.');
