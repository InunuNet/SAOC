// nos-critique-r1 F1 — rendered critique round (golden §5). Starts `next start` on a free
// port in 3010-3019 (never 3002) against the existing production build, then measures with
// Playwright Chromium at 375x812, 768x1024 and 1280x800 (plus 360x800 for overflow only):
//   B3  every <p>/<li> inside [data-nos-content-state] is <= 60ch of its own font, and the
//       hero lede (the <p> after the <h1>) is <= 58ch — sponsors, symposium, wosa-conference;
//   C4  document scrollWidth <= clientWidth on all three routes at all four widths;
//   SCOPE (1280) an injected grid <ul><li> under [data-nos-content-state] (outside
//       .nos-show-page-prose) fills its track, while an injected <li> inside
//       .nos-show-page-prose is <= 60ch — the cap never reaches grid cards (Codex P2);
//   G2  sponsors (zero showSponsor records): "Each entry will show" is absent; the
//       [data-nos-empty-state="sponsors"] card holds, in DOM order, an <h2> "Become a sponsor",
//       a [data-confirmation-badge="pending"] reading "To be confirmed by the show committee",
//       a <p> "No Show sponsors have been confirmed for 2027 yet." and a 44x44+ link
//       "Talk to us about sponsorship" -> mailto:info@saoc.co.za;
//   D3  probe buttons inside .nos-presenters (symposium), focused with keyboard modality:
//       on the light ground the ring computes 2px solid rgb(126, 63, 151) (theme violet,
//       R9/3) at a 2px offset; inside a .nos-on-dark probe it flips to rgb(251, 250, 240).
// Screenshots land in .tmp/sandbox/critique-r1-shots/ for the design review.
//
// Requires a current build: run `pnpm build` first (A8). Fails if .next/BUILD_ID is older
// than any cleared source file.
// Run as: node contracts/checks/nos-critique-r1/check-rendered.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';

import { FILES, finish, gitRoot } from './_lib.mjs';

const NAME = 'check-rendered.mjs';
const failures = [];
const require = createRequire(path.join(gitRoot, 'package.json'));
const { chromium } = require('playwright');

const USER = 'nos-critique-r1';
const PASS = 'local-render-check';
const AUTH = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;
const ROUTES = ['/national-show/sponsors', '/national-show/symposium', '/national-show/wosa-conference'];
const VIEWPORTS = [
  { width: 375, height: 812, measure: true },
  { width: 768, height: 1024, measure: true },
  { width: 1280, height: 800, measure: true },
  { width: 360, height: 800, measure: false },
];
const SHOTS = path.resolve(gitRoot, '..', 'critique-r1-shots');

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
for (let p = Number(process.env.NOS_CR1_PORT || 3010); p <= 3019; p += 1) {
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

      const m = await page.evaluate(() => {
        const ch = (el) => {
          const probe = document.createElement('span');
          probe.textContent = '0'.repeat(100);
          const cs = getComputedStyle(el);
          Object.assign(probe.style, { font: cs.font, letterSpacing: cs.letterSpacing, position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap' });
          document.body.appendChild(probe);
          const w = probe.getBoundingClientRect().width / 100;
          probe.remove();
          return w;
        };
        const contentWidth = (el) => {
          const cs = getComputedStyle(el);
          return el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
        };
        const region = document.querySelector('[data-nos-content-state]');
        const prose = region ? [...region.querySelectorAll('p, li')].filter((el) => el.offsetParent !== null && el.textContent.trim().length >= 40) : [];
        const h1 = document.querySelector('h1');
        let lede = h1 ? h1.nextElementSibling : null;
        while (lede && lede.tagName !== 'P') lede = lede.nextElementSibling;
        return {
          region: Boolean(region),
          prose: prose.map((el) => ({ text: el.textContent.trim().slice(0, 50), chars: contentWidth(el) / ch(el) })),
          lede: lede ? { text: lede.textContent.trim().slice(0, 50), chars: contentWidth(lede) / ch(lede) } : null,
        };
      });
      if (!m.region) failures.push(`${tag}: [data-nos-content-state] not rendered`);
      if (m.prose.length === 0) failures.push(`${tag}: no prose measured — the check would be vacuous`);
      for (const p of m.prose) if (p.chars > 60.5) failures.push(`${tag}: B3 prose measure ${p.chars.toFixed(1)}ch > 60ch ("${p.text}…")`);
      if (!m.lede) failures.push(`${tag}: hero lede (<p> after <h1>) not found`);
      else if (m.lede.chars > 58.5) failures.push(`${tag}: B3 lede measure ${m.lede.chars.toFixed(1)}ch > 58ch ("${m.lede.text}…")`);

      if (vp.width === 1280) {
        const s = await page.evaluate(() => {
          const region = document.querySelector('[data-nos-content-state]');
          const prose = region && region.querySelector('.nos-show-page-prose');
          if (!region || !prose) return null;
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
          const zero = (el) => {
            const probe = document.createElement('span');
            probe.textContent = '0'.repeat(100);
            const cs = getComputedStyle(el);
            Object.assign(probe.style, { font: cs.font, letterSpacing: cs.letterSpacing, position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap' });
            document.body.appendChild(probe);
            const w = probe.getBoundingClientRect().width / 100;
            probe.remove();
            return w;
          };
          const out = { track: grid.clientWidth, gridLi: gli.getBoundingClientRect().width, trackCh: grid.clientWidth / zero(gli), proseCh: pli.getBoundingClientRect().width / zero(pli) };
          grid.remove();
          pul.remove();
          return out;
        });
        if (!s) failures.push(`${tag}: SCOPE probe could not find [data-nos-content-state] .nos-show-page-prose`);
        else {
          if (s.trackCh <= 61) failures.push(`${tag}: SCOPE probe invalid — grid track only ${s.trackCh.toFixed(1)}ch`);
          else if (s.gridLi < s.track - 1) failures.push(`${tag}: SCOPE grid <li> is ${s.gridLi.toFixed(0)}px in a ${s.track}px track — the prose cap reaches grid cards`);
          if (s.proseCh > 60.5) failures.push(`${tag}: SCOPE prose <li> measure ${s.proseCh.toFixed(1)}ch > 60ch`);
        }
      }

      if (route.endsWith('/sponsors')) {
        const g = await page.evaluate(() => {
          const body = document.body.innerText;
          const card = document.querySelector('[data-nos-empty-state="sponsors"]');
          const cards = document.querySelectorAll('[data-nos-content-state] article, [data-nos-content-state] li[data-sponsor]').length;
          if (!card) return { scaffold: /each entry will show/i.test(body), card: false, cards };
          const h2 = card.querySelector('h2');
          const chip = card.querySelector('[data-confirmation-badge="pending"]');
          const line = [...card.querySelectorAll('p')].find((p) => p.textContent.trim() === 'No Show sponsors have been confirmed for 2027 yet.');
          const cta = card.querySelector('a[href="mailto:info@saoc.co.za"]');
          const box = cta ? cta.getBoundingClientRect() : null;
          const order = [h2, chip, line, cta].every(Boolean)
            && [h2, chip, line, cta].every((el, i, a) => i === 0 || (a[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
          return {
            scaffold: /each entry will show/i.test(body),
            card: true,
            h2: h2 && h2.textContent.trim(),
            chip: chip && chip.textContent.trim(),
            line: Boolean(line),
            cta: cta && cta.textContent.trim(),
            w: box && box.width,
            h: box && box.height,
            order,
          };
        });
        if (g.scaffold) failures.push(`${tag}: G2 scaffold text "Each entry will show" still rendered`);
        if (!g.card) failures.push(`${tag}: G2 [data-nos-empty-state="sponsors"] not rendered (sponsor records present? ${g.cards})`);
        else {
          if (g.h2 !== 'Become a sponsor') failures.push(`${tag}: G2 heading is ${JSON.stringify(g.h2)}`);
          if (!g.chip || !g.chip.includes('To be confirmed by the show committee')) failures.push(`${tag}: G2 R11 chip is ${JSON.stringify(g.chip)}`);
          if (!g.line) failures.push(`${tag}: G2 line "No Show sponsors have been confirmed for 2027 yet." not rendered`);
          if (g.cta !== 'Talk to us about sponsorship') failures.push(`${tag}: G2 next step is ${JSON.stringify(g.cta)}`);
          if (!(g.w >= 44 && g.h >= 44)) failures.push(`${tag}: G2 next step is ${g.w}x${g.h}, needs >= 44x44`);
          if (!g.order) failures.push(`${tag}: G2 order must be heading, chip, line, next step`);
        }
      }

      if (route.endsWith('/symposium')) {
        const has = await page.locator('.nos-presenters').count();
        if (!has) failures.push(`${tag}: .nos-presenters not rendered — D3 cannot be measured`);
        else {
          await page.evaluate(() => {
            const host = document.querySelector('.nos-presenters');
            const light = document.createElement('button');
            light.type = 'button';
            light.id = 'nos-cr1-probe-light';
            light.textContent = 'probe';
            const dark = document.createElement('div');
            dark.className = 'nos-on-dark';
            const darkBtn = document.createElement('button');
            darkBtn.type = 'button';
            darkBtn.id = 'nos-cr1-probe-dark';
            darkBtn.textContent = 'probe';
            dark.append(darkBtn);
            host.prepend(light, dark);
          });
          const probes = [
            ['light', '#nos-cr1-probe-light', 'rgb(126, 63, 151)'],
            ['on-dark', '#nos-cr1-probe-dark', 'rgb(251, 250, 240)'],
          ];
          for (const [ground, sel, want] of probes) {
            await page.keyboard.press('Shift');
            await page.focus(sel);
            const f = await page.evaluate((s) => {
              const el = document.querySelector(s);
              const cs = getComputedStyle(el);
              return { fv: el.matches(':focus-visible'), style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor, offset: cs.outlineOffset };
            }, sel);
            if (!f.fv) failures.push(`${tag}: D3 ${ground} probe did not reach :focus-visible — measurement invalid`);
            else if (f.style !== 'solid' || f.width !== '2px' || f.color !== want || f.offset !== '2px') {
              failures.push(`${tag}: D3 presenters ${ground} ring is ${f.width} ${f.style} ${f.color} offset ${f.offset}; want 2px solid ${want} offset 2px`);
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

finish(NAME, failures, `rendered at 375/768/1280 (+360 overflow) on :${port}: prose <= 60ch, ledes <= 58ch, no overflow, sponsors G2 sourced and ordered, presenters ring theme violet (gold on dark) 2px at 2px offset. Shots: ${SHOTS}`);
