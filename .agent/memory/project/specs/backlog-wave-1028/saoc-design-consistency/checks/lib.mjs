// Shared helpers for the saoc-design-consistency checks. Browser checks run against DC_BASE_URL when set (a
// running SAOC-host server, or the beta origin with BETA_BASIC_AUTH_USER/PASSWORD for the deployed variants);
// otherwise they start `next dev` on a free port from the current working directory in fixture-replay mode with the
// beta wall disabled, and stop exactly that PID when done. Nothing here writes to Sanity or Firestore.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from 'playwright';

const FIXTURE_DIR = '.agent/memory/project/specs/nos-content-standard/fixtures/sanity';

export const fails = [];
export const check = (ok, msg) => { if (!ok) fails.push(msg); };
export const finish = (name) => {
  if (fails.length) { console.error(`FAIL ${name}: ${fails.length} problem(s)`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
  console.log(`PASS ${name}`);
};

function freePort() {
  return new Promise((resolve, reject) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); s.on('error', reject); });
}

export async function withSite(fn) {
  let child = null; let base = process.env.DC_BASE_URL;
  if (!base) {
    const port = await freePort(); base = `http://localhost:${port}`;
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', String(port)], {
      stdio: 'ignore', env: { ...process.env, BETA_BASIC_AUTH_USER: '', BETA_BASIC_AUTH_PASSWORD: '', SANITY_FIXTURE_MODE: 'replay', SANITY_FIXTURE_DIR: FIXTURE_DIR },
    });
    const deadline = Date.now() + 180_000;
    for (;;) { try { const r = await fetch(base + '/about'); if (r.status < 500) break; } catch { /* not up yet */ } if (Date.now() > deadline) { child.kill(); throw new Error('dev server did not start'); } await new Promise((r) => setTimeout(r, 1500)); }
  }
  const user = process.env.BETA_BASIC_AUTH_USER; const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
  const browser = await chromium.launch();
  const ctxOpts = (vp, dpr = 1) => ({ viewport: vp, deviceScaleFactor: dpr, ...(process.env.DC_BASE_URL && user && pass ? { httpCredentials: { username: user, password: pass } } : {}) });
  try { await fn({ base, browser, ctxOpts, deployed: Boolean(process.env.DC_BASE_URL) && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(process.env.DC_BASE_URL) }); }
  finally { await browser.close(); if (child) child.kill(); }
}

export async function openPage(browser, ctxOpts, base, path, width, height = 1000, dpr = 1) {
  const ctx = await browser.newContext(ctxOpts({ width, height }, dpr)); const page = await ctx.newPage();
  const resp = await page.goto(base + path, { waitUntil: 'load', timeout: 120_000 }); await page.waitForTimeout(700);
  return { page, ctx, status: resp ? resp.status() : 0 };
}

// Any CSS colour string to [r,g,b,a] via a canvas (handles oklab/oklch that Chromium reports for Tailwind colours).
export const RGBA_FN = `(c) => { const k = document.createElement('canvas'); k.width = k.height = 1; const x = k.getContext('2d', { willReadFrequently: true }); x.clearRect(0,0,1,1); x.fillStyle = '#000'; x.fillStyle = c; x.fillRect(0,0,1,1); const d = x.getImageData(0,0,1,1).data; return [d[0], d[1], d[2], d[3] / 255]; }`;
export const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
export const blend = ([r, g, b, a], [br, bg, bb]) => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
export const ratio = (fg, bg) => { const l1 = lum(fg), l2 = lum(bg); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

// Routes that carry the SAOC inner PageHero, and the PG-1 exceptions (Events list, Societies grid, Contact).
export const INNER_ROUTES = ['/about', '/judging', '/sponsors', '/members', '/memorandum-of-incorporation', '/privacy', '/terms', '/refunds'];
export const EXEMPT_ROUTES = ['/societies', '/contact'];
