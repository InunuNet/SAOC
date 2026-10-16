// nos-critique-r3 F1 — rendered check (golden spec §4). Starts `next start` on a free port in
// 3010-3019 (never 3002) against the existing production build, then drives /national-show/symposium
// with Playwright Chromium at 375x812 and 1280x800:
//   R39 P1  collapsed .pc-clip is <= 4 lines tall (4 x computed line-height + 1px); at least one card
//           overflows and shows the button; a card whose bio fits shows no button and no clip;
//           the card is <= 600px tall (was 782px) at both widths;
//   toggle  button aria-expanded false -> true on click, aria-controls resolves to the .pc-clip,
//           the full bio is then visible (clip clientHeight >= scrollHeight - 1, taller than collapsed),
//           document.activeElement is still the button, click again -> false and re-clamped; Enter works;
//   names   accessible name starts "Read full bio" and ends " of <h3 name>"; one h3 per card;
//   modal   no <dialog> and no .pc-modal anywhere in the DOM, before and after the click;
//   target  the button box is >= 44 x 44 px; no horizontal overflow (scrollWidth <= clientWidth);
//   R39 P2  every bio <p>/<li> computes font-size 17px, line-height 1.68 x 17 = 28.56px, <= 68ch wide;
//   no-JS   with JavaScript disabled every bio is fully visible (no data-clamp, clip not clipped, all
//           buttons hidden);
//   motion  with prefers-reduced-motion: reduce the button computes a transition duration <= 1ms (globals.css reduce rule: 0.01ms).
// Requires a current build. Run as: node contracts/checks/nos-critique-r3/check-rendered.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';

import { CSS, GRID, finish, gitRoot } from './_lib.mjs';

const NAME = 'check-rendered.mjs';
const failures = [];
const require = createRequire(path.join(gitRoot, 'package.json'));
const { chromium } = require('playwright');

const USER = 'nos-critique-r3';
const PASS = 'local-render-check';
const AUTH = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;
const ROUTE = '/national-show/symposium';
const VIEWPORTS = [{ width: 375, height: 812 }, { width: 1280, height: 800 }];
const SHOTS = path.resolve(gitRoot, '..', 'critique-r3-shots');
const MAX_CARD_PX = 600;
const MAX_LINES = 4;
// globals.css sets `transition-duration: 0.01ms !important` under reduce (computes as 1e-05s): anything <= 1ms is no motion.
const REDUCED_MOTION_ZERO_S = 0.001;

const buildId = path.join(gitRoot, '.next', 'BUILD_ID');
if (!existsSync(buildId)) finish(NAME, ['no production build (.next/BUILD_ID) — run pnpm build first']);
const builtAt = statSync(buildId).mtimeMs;
for (const rel of [GRID, CSS]) {
  if (statSync(path.join(gitRoot, rel)).mtimeMs > builtAt) finish(NAME, [`stale build: ${rel} changed after .next/BUILD_ID — run pnpm build`]);
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer().once('error', () => resolve(false)).once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}
let port = null;
for (let p = Number(process.env.NOS_CR3_PORT || 3010); p <= 3019; p += 1) {
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
      const r = await fetch(`${origin}${ROUTE}`, { headers: { authorization: AUTH } });
      if (r.status === 200) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

// Per-card facts, measured in the page. Runs collapsed.
const MEASURE = `() => {
  const probe = (el) => {
    const s = document.createElement('span');
    const cs = getComputedStyle(el);
    s.textContent = '0'.repeat(100);
    Object.assign(s.style, { font: cs.font, letterSpacing: cs.letterSpacing, position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap' });
    document.body.appendChild(s);
    const w = s.getBoundingClientRect().width / 100;
    s.remove();
    return w;
  };
  const cards = [...document.querySelectorAll('.nos-presenters .pc-card')];
  return {
    dialogs: document.querySelectorAll('dialog, .pc-modal').length,
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    clamp: document.querySelector('.nos-presenters .pc-grid')?.hasAttribute('data-clamp') ?? false,
    cards: cards.map((card) => {
      const clip = card.querySelector('.pc-clip');
      const btn = card.querySelector('.pc-more');
      const blocks = [...card.querySelectorAll('.pc-body p, .pc-body li')];
      const first = blocks[0];
      const fcs = first ? getComputedStyle(first) : null;
      const zero = first ? probe(first) : 0;
      const b = btn.getBoundingClientRect();
      return {
        name: card.querySelector('.pc-name')?.textContent ?? '',
        cardH: card.getBoundingClientRect().height,
        clipH: clip.clientHeight,
        clipScroll: clip.scrollHeight,
        clipId: clip.id,
        isClipped: clip.classList.contains('is-clipped'),
        btnHidden: btn.hidden || getComputedStyle(btn).display === 'none',
        btnName: btn.textContent.replace(/\\s+/g, ' ').trim(),
        btnExpanded: btn.getAttribute('aria-expanded'),
        btnControls: btn.getAttribute('aria-controls'),
        btnW: b.width,
        btnH: b.height,
        lh: fcs ? parseFloat(fcs.lineHeight) : 0,
        blocks: blocks.map((el) => {
          const cs = getComputedStyle(el);
          return { size: cs.fontSize, lh: cs.lineHeight, w: el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), zero: probe(el) };
        }),
      };
    }),
  };
}`;

let browser;
try {
  if (!(await waitUp())) throw new Error(`next start did not serve ${ROUTE} with 200 within 120s\n${serverLog.slice(-2000)}`);
  mkdirSync(SHOTS, { recursive: true });
  browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: vp, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    const tag = `${ROUTE} @${vp.width}`;
    const res = await page.goto(`${origin}${ROUTE}`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); await ctx.close(); continue; }
    await page.waitForSelector('.nos-presenters .pc-grid[data-clamp]', { timeout: 10_000 }).catch(() => failures.push(`${tag}: grid never got data-clamp after hydration`));
    await page.waitForTimeout(400); // ResizeObserver + fonts.ready settle
    await page.screenshot({ path: path.join(SHOTS, `symposium-${vp.width}-collapsed.png`), fullPage: true });

    const m = await page.evaluate(`(${MEASURE})()`);
    if (m.cards.length === 0) { failures.push(`${tag}: no .pc-card rendered`); await ctx.close(); continue; }
    if (m.dialogs !== 0) failures.push(`${tag}: ${m.dialogs} <dialog>/.pc-modal left in the DOM`);
    if (m.sw > m.cw) failures.push(`${tag}: horizontal overflow, scrollWidth ${m.sw} > clientWidth ${m.cw}`);

    const overflowing = [];
    m.cards.forEach((c, i) => {
      const id = `${tag} card ${i + 1} (${c.name})`;
      if (c.cardH > MAX_CARD_PX) failures.push(`${id}: collapsed card is ${Math.round(c.cardH)}px tall, want <= ${MAX_CARD_PX}px (R39 P1, was 782px)`);
      if (c.clipH > MAX_LINES * c.lh + 1) failures.push(`${id}: collapsed bio ${c.clipH}px tall exceeds ${MAX_LINES} lines (${MAX_LINES * c.lh}px)`);
      if (!c.btnHidden) overflowing.push(i);
      if (c.btnHidden && c.clipScroll > MAX_LINES * c.lh + 1) failures.push(`${id}: bio overflows ${MAX_LINES} lines (${c.clipScroll}px) but the toggle is hidden`);
      if (!c.btnHidden && c.clipScroll <= MAX_LINES * c.lh + 1) failures.push(`${id}: toggle shown although the bio fits ${MAX_LINES} lines`);
      if (c.btnHidden && c.isClipped) failures.push(`${id}: is-clipped on a bio that does not overflow`);
      for (const b of c.blocks) {
        if (b.size !== '17px') failures.push(`${id}: bio font-size ${b.size}, want 17px (R39 P2, body role --fs-body 1.0625rem)`);
        if (Math.abs(parseFloat(b.lh) - 28.56) > 0.1) failures.push(`${id}: bio line-height ${b.lh}, want 28.56px (1.68 x 17)`);
        if (b.w > 68 * b.zero + 1) failures.push(`${id}: bio block ${Math.round(b.w)}px wider than 68ch (${Math.round(68 * b.zero)}px)`);
      }
      if (c.btnExpanded !== 'false' && !c.btnHidden) failures.push(`${id}: collapsed aria-expanded is ${JSON.stringify(c.btnExpanded)}, want "false"`);
      if (!c.btnHidden) {
        if (!c.btnName.startsWith('Read full bio') || !c.btnName.endsWith(` of ${c.name}`)) failures.push(`${id}: accessible name ${JSON.stringify(c.btnName)}, want "Read full bio of ${c.name}"`);
        if (!c.clipId || c.btnControls !== c.clipId) failures.push(`${id}: aria-controls ${JSON.stringify(c.btnControls)} does not match the .pc-clip id ${JSON.stringify(c.clipId)}`);
        if (c.btnH < 44 || c.btnW < 44) failures.push(`${id}: toggle target ${Math.round(c.btnW)}x${Math.round(c.btnH)}px, want >= 44x44`);
      }
    });
    if (overflowing.length === 0) { failures.push(`${tag}: no bio overflows 4 lines, so the disclosure cannot be exercised`); await ctx.close(); continue; }

    // ---- exercise the first overflowing card: click, Enter, collapse ----
    const idx = overflowing[0];
    const btn = page.locator('.nos-presenters .pc-card').nth(idx).locator('.pc-more');
    const clip = page.locator('.nos-presenters .pc-card').nth(idx).locator('.pc-clip');
    const state = () => page.evaluate((i) => {
      const card = document.querySelectorAll('.nos-presenters .pc-card')[i];
      const c = card.querySelector('.pc-clip');
      const b = card.querySelector('.pc-more');
      return { exp: b.getAttribute('aria-expanded'), h: c.clientHeight, sh: c.scrollHeight, focused: document.activeElement === b, dialogs: document.querySelectorAll('dialog, .pc-modal').length, hidden: b.hidden, overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    }, idx);
    const before = await state();
    await btn.click();
    const open = await state();
    if (open.exp !== 'true') failures.push(`${tag}: after click aria-expanded is ${JSON.stringify(open.exp)}, want "true"`);
    if (open.h < open.sh - 1) failures.push(`${tag}: expanded but the bio is still clipped (${open.h}px of ${open.sh}px)`);
    if (open.h <= before.h) failures.push(`${tag}: expanding did not grow the bio (${before.h}px -> ${open.h}px)`);
    if (!open.focused) failures.push(`${tag}: focus left the button after expanding`);
    if (open.hidden) failures.push(`${tag}: the toggle vanished once expanded, so it cannot collapse`);
    if (open.dialogs !== 0) failures.push(`${tag}: a <dialog> appeared on expand`);
    if (open.overflowX) failures.push(`${tag}: horizontal overflow once expanded`);
    if (!(await clip.isVisible())) failures.push(`${tag}: expanded bio not visible`);
    await page.screenshot({ path: path.join(SHOTS, `symposium-${vp.width}-expanded.png`), fullPage: true });
    await btn.click();
    const closed = await state();
    if (closed.exp !== 'false') failures.push(`${tag}: second click aria-expanded is ${JSON.stringify(closed.exp)}, want "false"`);
    if (closed.h > before.h + 1) failures.push(`${tag}: collapsing did not re-clamp (${closed.h}px, was ${before.h}px)`);
    if (!closed.focused) failures.push(`${tag}: focus left the button after collapsing`);
    await btn.focus();
    await page.keyboard.press('Enter');
    if ((await state()).exp !== 'true') failures.push(`${tag}: Enter on the focused toggle did not expand`);
    await page.keyboard.press('Space');
    if ((await state()).exp !== 'false') failures.push(`${tag}: Space on the focused toggle did not collapse`);
    await ctx.close();
  }

  // ---- no JS: every bio fully visible, no toggle ----
  {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[1], javaScriptEnabled: false, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    const res = await page.goto(`${origin}${ROUTE}`, { waitUntil: 'load' });
    if (!res || res.status() !== 200) failures.push(`no-JS: HTTP ${res && res.status()}`);
    else {
      const m = await page.evaluate(`(${MEASURE})()`);
      if (m.clamp) failures.push('no-JS: grid carries data-clamp without JavaScript');
      m.cards.forEach((c, i) => {
        if (c.clipH < c.clipScroll - 1) failures.push(`no-JS card ${i + 1}: bio clipped (${c.clipH}px of ${c.clipScroll}px) with no way to expand`);
        if (!c.btnHidden) failures.push(`no-JS card ${i + 1}: toggle visible although it cannot work`);
      });
    }
    await ctx.close();
  }

  // ---- reduced motion ----
  {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[1], reducedMotion: 'reduce', extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    await page.goto(`${origin}${ROUTE}`, { waitUntil: 'networkidle' });
    const d = await page.evaluate(() => [...document.querySelectorAll('.nos-presenters .pc-more, .nos-presenters .pc-clip')].map((el) => getComputedStyle(el).transitionDuration + '|' + getComputedStyle(el).animationName));
    for (const v of d) { const [dur, anim] = v.split('|'); if (dur.split(',').some((x) => parseFloat(x) * (/ms$/.test(x.trim()) ? 0.001 : 1) > REDUCED_MOTION_ZERO_S) || anim !== 'none') failures.push(`reduced motion: element still animates (${v})`); }
    await ctx.close();
  }
} catch (err) {
  failures.push(`${err.name}: ${err.message}`);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

finish(NAME, failures, `symposium at 375 and 1280 on :${port}: bios <= 4 lines, card <= ${MAX_CARD_PX}px, inline aria-expanded toggle works (click/Enter/Space), focus stays, no dialog, 17px bio, target >= 44, no overflow, no-JS shows full bios, reduced motion. Shots: ${SHOTS}`);
