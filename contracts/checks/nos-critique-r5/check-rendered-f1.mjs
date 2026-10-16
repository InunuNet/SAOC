// nos-critique-r5 F1 — rendered check for the 60ch prose measure on /national-show/vendors and
// /national-show/exhibitors. Starts `next start` on 3010-3019 (never 3002) via _server.mjs; measures
// with Playwright Chromium at 375, 768 and 1280 (plus 360 for overflow only):
//   MEASURE every visible <p> in <main> (outside header/nav/footer) with >= 40 characters, and every
//           such <li> with no block children, is <= 60ch of its own font; the hero lede is <= 58ch;
//   C4      document scrollWidth <= clientWidth;
//   SCOPE   (1280) an injected 3-column grid of <li> inside the capped container fills its tracks (the
//           cap is on p only) while its long <p> is <= 60ch; on exhibitors every real grid/list li
//           (questions grid, steps list) is as wide as its track or its list;
//   CTA     vendors: the "Register as a vendor" link is still present and points at /national-show/vendors/apply.
// Requires a current build. Run as: node contracts/checks/nos-critique-r5/check-rendered-f1.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { EXHIBITORS, VENDORS, finish, gitRoot } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';

const NAME = 'check-rendered-f1.mjs';
const failures = [];
const { chromium } = require('playwright');
const SHOTS = path.resolve(gitRoot, '..', 'critique-r5-shots');
const ROUTES = ['/national-show/vendors', '/national-show/exhibitors'];
const VIEWPORTS = [
  { width: 375, height: 812, measure: true },
  { width: 768, height: 1024, measure: true },
  { width: 1280, height: 800, measure: true },
  { width: 360, height: 800, measure: false },
];

const stale = assertFreshBuild([VENDORS, EXHIBITORS]);
if (stale.length > 0) finish(NAME, stale);

const zeroFn = `(el) => {
  const probe = document.createElement('span');
  probe.textContent = '0'.repeat(100);
  const cs = getComputedStyle(el);
  Object.assign(probe.style, { font: cs.font, letterSpacing: cs.letterSpacing, position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap' });
  document.body.appendChild(probe);
  const w = probe.getBoundingClientRect().width / 100;
  probe.remove();
  return w;
}`;
const rows = [];
let browser;
let stop = () => {};
try {
  const srv = await startServer();
  stop = srv.stop;
  const { origin } = srv;
  mkdirSync(SHOTS, { recursive: true });
  browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    for (const route of ROUTES) {
      const tag = `${route} @${vp.width}`;
      const res = await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); continue; }
      const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      if (overflow.sw > overflow.cw) failures.push(`${tag}: C4 horizontal overflow, scrollWidth ${overflow.sw} > clientWidth ${overflow.cw}`);
      if (!vp.measure) continue;
      await page.screenshot({ path: path.join(SHOTS, `${route.split('/').pop()}-${vp.width}.png`), fullPage: true });

      const m = await page.evaluate((zs) => {
        const zero = eval(zs);
        const cw = (el) => {
          const cs = getComputedStyle(el);
          return el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
        };
        const main = document.querySelector('main') || document.body;
        const h1 = main.querySelector('h1') || document.querySelector('h1');
        let lede = h1 ? h1.nextElementSibling : null;
        while (lede && lede.tagName !== 'P') lede = lede.nextElementSibling;
        const BLOCK = 'div, p, ul, ol, details, article, section, dl, figure, table';
        const prose = [...main.querySelectorAll('p, li')].filter((el) => el !== lede
          && el.offsetParent !== null
          && el.textContent.trim().length >= 40
          && !el.closest('header, nav, footer')
          && !(el.tagName === 'LI' && el.querySelector(BLOCK)));
        // real li tracks: each li must be as wide as its grid track (grid parent) or its list (otherwise)
        const lists = [...main.querySelectorAll('ul, ol')].filter((l) => !l.closest('header, nav, footer') && l.offsetParent !== null);
        const narrow = [];
        for (const l of lists) {
          const pcs = getComputedStyle(l);
          const cols = pcs.display === 'grid' ? pcs.gridTemplateColumns.split(' ').map(parseFloat).filter((x) => x > 0) : [];
          const want = cols.length ? Math.min(...cols) : cw(l);
          for (const li of l.children) {
            if (li.tagName !== 'LI') continue;
            const w = li.getBoundingClientRect().width;
            if (w < want - 1.5) narrow.push({ text: li.textContent.trim().slice(0, 30), w: Math.round(w), want: Math.round(want) });
          }
        }
        // SCOPE probe: append a 3-up grid of long-p li to the capped container
        const capped = [...main.querySelectorAll('div')].find((d) => /max-w-\[1280px\]/.test(d.className));
        let probe = null;
        if (capped) {
          const ul = document.createElement('ul');
          ul.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:0;padding:0;list-style:none';
          for (let i = 0; i < 3; i += 1) {
            const li = document.createElement('li');
            const p = document.createElement('p');
            p.textContent = 'Probe card paragraph that is deliberately long enough to be measured as prose, '.repeat(3);
            li.appendChild(p);
            ul.appendChild(li);
          }
          capped.appendChild(ul);
          const track = parseFloat(getComputedStyle(ul).gridTemplateColumns.split(' ')[0]);
          const li0 = ul.children[0];
          const p0 = li0.firstElementChild;
          probe = { liW: li0.getBoundingClientRect().width, track, pCh: cw(p0) / zero(p0), pW: cw(p0) };
          ul.remove();
        }
        return {
          prose: prose.map((el) => ({ text: el.textContent.trim().slice(0, 50), chars: cw(el) / zero(el) })),
          lede: lede ? { text: lede.textContent.trim().slice(0, 50), chars: cw(lede) / zero(lede) } : null,
          narrow,
          probe,
          cta: [...document.querySelectorAll('a')].filter((a) => /register as a vendor/i.test(a.textContent)).map((a) => a.getAttribute('href')),
        };
      }, zeroFn);
      if (m.prose.length === 0) failures.push(`${tag}: no prose measured — the check would be vacuous`);
      for (const p of m.prose) if (p.chars > 60.5) failures.push(`${tag}: MEASURE ${p.chars.toFixed(1)}ch > 60ch ("${p.text}…")`);
      if (m.lede && m.lede.chars > 58.5) failures.push(`${tag}: lede measure ${m.lede.chars.toFixed(1)}ch > 58ch ("${m.lede.text}…")`);
      for (const n of m.narrow) failures.push(`${tag}: SCOPE list item "${n.text}" is ${n.w}px wide, narrower than its track ${n.want}px (a cap leaked onto li)`);
      if (vp.width === 1280) {
        if (!m.probe) failures.push(`${tag}: SCOPE probe could not find the capped container`);
        else {
          if (m.probe.liW < m.probe.track - 1.5) failures.push(`${tag}: SCOPE probe li ${Math.round(m.probe.liW)}px < track ${Math.round(m.probe.track)}px`);
          if (m.probe.pCh > 60.5) failures.push(`${tag}: SCOPE probe p ${m.probe.pCh.toFixed(1)}ch > 60ch`);
        }
      }
      if (route.endsWith('/vendors')) {
        if (m.cta.length !== 1 || m.cta[0] !== '/national-show/vendors/apply') failures.push(`${tag}: vendors CTA link missing or changed (${JSON.stringify(m.cta)})`);
      }
      const worst = m.prose.reduce((a, p) => Math.max(a, p.chars), 0);
      rows.push(`  ${tag}: ${m.prose.length} prose blocks, widest ${worst.toFixed(1)}ch, lede ${m.lede ? m.lede.chars.toFixed(1) : 'n/a'}ch`);
    }
    await ctx.close();
  }
} catch (err) {
  failures.push(`${err.name}: ${err.message}`);
} finally {
  if (browser) await browser.close();
  stop();
}
finish(NAME, failures, `vendors + exhibitors: prose <= 60ch, ledes <= 58ch, no overflow at 375/768/1280/360, list items and the injected grid fill their tracks, vendors CTA intact. Measured:\n${rows.join('\n')}\nShots: ${SHOTS}`);
