// nos-critique-r2 F1 — rendered check (golden §3). Starts `next start` on a free port in
// 3010-3019 (never 3002) against the existing production build, then measures with Playwright
// Chromium at 375x812, 768x1024 and 1280x800 (plus 360x800 for overflow only) on about,
// what-to-expect, sa-exhibitors, international-guests, programme and faq:
//   MEASURE every visible <p> in <main> (outside header/nav/footer) with >= 40 chars of text,
//           and every such <li> with no block children (accordion rows and grid cards are not
//           prose), is <= 60ch of its own font; the hero lede (<p> after <h1>) is <= 58ch;
//   C4      document scrollWidth <= clientWidth;
//   SCOPE   (1280, routes with .nos-show-page-prose) an injected grid <li> under
//           [data-nos-content-state] fills its track while a prose <li> is <= 60ch;
//   R13     (about, all widths) no display:grid container in <main> outside <nav> ends on a
//           partial last row (the 2+1 orphan).
//   R35     (symposium, 1280 and 375) .pc-role computes the label role, Karla 700 12px
//           .14em (1.68px) uppercase; .pc-name computes the card-title role, Fraunces 400
//           22px / 27.5px, font-variation-settings "opsz" 24. R36: .pc-title computes the same
//           section-h2 role as the page's own .nos-theme section h2 (family, weight, size,
//           line-height, letter-spacing, opsz).
// The FAQ chip (item 2) is NOT asserted: it is Sanity showFaq.status data (golden §4).
// Requires a current build (A6). Run as: node contracts/checks/nos-critique-r2/check-rendered.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';

import { FILES, ROUTES as ROUTE_SLUGS, finish, gitRoot } from './_lib.mjs';

const NAME = 'check-rendered.mjs';
const failures = [];
const require = createRequire(path.join(gitRoot, 'package.json'));
const { chromium } = require('playwright');

const USER = 'nos-critique-r2';
const PASS = 'local-render-check';
const AUTH = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;
const ROUTES = ROUTE_SLUGS.map((r) => `/national-show/${r}`);
const VIEWPORTS = [
  { width: 375, height: 812, measure: true },
  { width: 768, height: 1024, measure: true },
  { width: 1280, height: 800, measure: true },
  { width: 360, height: 800, measure: false },
];
const SHOTS = path.resolve(gitRoot, '..', 'critique-r2-shots');

// ---- build freshness ----
const buildId = path.join(gitRoot, '.next', 'BUILD_ID');
if (!existsSync(buildId)) finish(NAME, ['no production build (.next/BUILD_ID) — run pnpm build first']);
const builtAt = statSync(buildId).mtimeMs;
for (const rel of Object.values(FILES)) {
  if (statSync(path.join(gitRoot, rel)).mtimeMs > builtAt) finish(NAME, [`stale build: ${rel} changed after .next/BUILD_ID — run pnpm build`]);
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer().once('error', () => resolve(false)).once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}
let port = null;
for (let p = Number(process.env.NOS_CR2_PORT || 3010); p <= 3019; p += 1) {
  if (p !== 3002 && (await portFree(p))) { port = p; break; }
}
if (!port) finish(NAME, ['no free port in 3010-3019']);
const origin = `http://127.0.0.1:${port}`;

const server = spawn(path.join(gitRoot, 'node_modules', '.bin', 'next'), ['start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: gitRoot,
  env: { ...process.env, BETA_BASIC_AUTH_USER: USER, BETA_BASIC_AUTH_PASSWORD: PASS, NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });

async function waitUp() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${origin}${ROUTES[0]}`, { headers: { authorization: AUTH } });
      if (r.status === 200) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

let browser;
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
try {
  if (!(await waitUp())) throw new Error(`next start did not serve ${ROUTES[0]} with 200 within 120s\n${serverLog.slice(-2000)}`);
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
        return {
          prose: prose.map((el) => ({ text: el.textContent.trim().slice(0, 50), chars: cw(el) / zero(el) })),
          lede: lede ? { text: lede.textContent.trim().slice(0, 50), chars: cw(lede) / zero(lede) } : null,
        };
      }, zeroFn);
      if (m.prose.length === 0) failures.push(`${tag}: no prose measured — the check would be vacuous`);
      for (const p of m.prose) if (p.chars > 60.5) failures.push(`${tag}: MEASURE ${p.chars.toFixed(1)}ch > 60ch ("${p.text}…")`);
      if (m.lede && m.lede.chars > 58.5) failures.push(`${tag}: lede measure ${m.lede.chars.toFixed(1)}ch > 58ch ("${m.lede.text}…")`);

      if (route.endsWith('/about')) {
        const orphans = await page.evaluate(() => {
          const main = document.querySelector('main') || document.body;
          return [...main.querySelectorAll('div, ul, ol, dl, section')].filter((el) => getComputedStyle(el).display === 'grid' && !el.closest('nav, header, footer'))
            .map((g) => {
              const kids = [...g.children].filter((c) => c.offsetParent !== null);
              const cols = new Set(kids.map((c) => Math.round(c.getBoundingClientRect().left))).size;
              return { n: kids.length, cols, cls: String(g.className).slice(0, 60) };
            })
            .filter((g) => g.cols > 1 && g.n % g.cols !== 0);
        });
        for (const o of orphans) failures.push(`${tag}: R13 grid "${o.cls}" has ${o.n} items in ${o.cols} columns — partial last row`);
      }

      if (vp.width === 1280) {
        const s = await page.evaluate((zs) => {
          const zero = eval(zs);
          const region = document.querySelector('[data-nos-content-state]');
          const prose = region && region.querySelector('.nos-show-page-prose');
          if (!region || !prose) return 'n/a';
          const long = 'Probe text that is deliberately long enough to wrap across a wide grid track and well past sixty characters of measure. '.repeat(3);
          const grid = document.createElement('ul');
          grid.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr);list-style:none;margin:0;padding:0';
          const gli = document.createElement('li');
          gli.textContent = long;
          grid.append(gli);
          region.prepend(grid);
          const pul = document.createElement('ul');
          const pli = document.createElement('li');
          pli.textContent = long;
          pul.append(pli);
          prose.append(pul);
          const out = { track: grid.clientWidth, gridLi: gli.getBoundingClientRect().width, trackCh: grid.clientWidth / zero(gli), proseCh: pli.getBoundingClientRect().width / zero(pli) };
          grid.remove();
          pul.remove();
          return out;
        }, zeroFn);
        if (s !== 'n/a') {
          if (s.trackCh <= 61) failures.push(`${tag}: SCOPE probe invalid — grid track only ${s.trackCh.toFixed(1)}ch`);
          else if (s.gridLi < s.track - 1) failures.push(`${tag}: SCOPE grid <li> is ${s.gridLi.toFixed(0)}px in a ${s.track}px track — the cap reaches grid cards`);
          if (s.proseCh > 60.5) failures.push(`${tag}: SCOPE prose <li> measure ${s.proseCh.toFixed(1)}ch > 60ch`);
        }
      }
    }
    if (vp.width === 1280 || vp.width === 375) {
      const tag = `/national-show/symposium @${vp.width}`;
      const res = await page.goto(`${origin}/national-show/symposium`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) failures.push(`${tag}: HTTP ${res && res.status()}`);
      else {
        const t = await page.evaluate(() => {
          const host = document.querySelector('.nos-presenters');
          if (!host) return null;
          const first = (v) => v.split(',')[0].trim().replace(/['"]/g, '');
          const hs = getComputedStyle(host);
          const fam = { karla: first(hs.getPropertyValue('--font-nos-karla')), fraunces: first(hs.getPropertyValue('--font-nos-fraunces')) };
          const read = (sel) => {
            const el = host.querySelector(sel);
            if (!el) return null;
            const cs = getComputedStyle(el);
            return { family: first(cs.fontFamily), weight: cs.fontWeight, size: cs.fontSize, lh: cs.lineHeight, ls: cs.letterSpacing, fvs: cs.fontVariationSettings, tt: cs.textTransform };
          };
          // Probe: a bare h2 beside .nos-presenters (inside .nos-theme) computes the nos-theme section-h2 role. The route's own
          // h2s are not a safe reference (the ShowContentState label h2s render at 16px).
          const scope = host.parentElement && host.parentElement.closest('.nos-theme') ? host.parentElement : null;
          const section = scope ? (() => { const ref = document.createElement('h2'); ref.textContent = 'probe'; scope.appendChild(ref); const cs = getComputedStyle(ref); const out = { family: first(cs.fontFamily), weight: cs.fontWeight, size: cs.fontSize, lh: cs.lineHeight, ls: cs.letterSpacing, fvs: cs.fontVariationSettings }; ref.remove(); return out; })() : null;
          return { fam, section, role: read('.pc-role'), name: read('.pc-name'), title: read('.pc-title') };
        });
        if (!t) failures.push(`${tag}: .nos-presenters not rendered — R35 cannot be measured`);
        else {
          const LABEL = { family: t.fam.karla, weight: '700', size: '12px', ls: '1.68px', tt: 'uppercase' };
          const CARD = { family: t.fam.fraunces, weight: '400', size: '22px', lh: '27.5px', fvs: '"opsz" 24' };
          if (!t.section) failures.push(`${tag}: R36 .nos-presenters is not inside .nos-theme, cannot probe the section-h2 role`);
          for (const [key, want] of [['role', LABEL], ['name', CARD], ['title', t.section || {}]]) {
            const got = t[key];
            if (!got) { failures.push(`${tag}: R35 .pc-${key} not rendered`); continue; }
            for (const [k, v] of Object.entries(want)) {
              if (!v || got[k] !== v) failures.push(`${tag}: R35 .pc-${key} ${k} is ${JSON.stringify(got[k])}, want ${JSON.stringify(v)}`);
            }
          }
        }
      }
    }
    await ctx.close();
  }
} catch (err) {
  failures.push(`${err.name}: ${err.message}`);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

finish(NAME, failures, `rendered six routes at 375/768/1280 (+360 overflow) on :${port}: prose <= 60ch, ledes <= 58ch, no overflow, grid cards uncapped, about has no partial grid row, symposium R35 presenter type. Shots: ${SHOTS}`);
