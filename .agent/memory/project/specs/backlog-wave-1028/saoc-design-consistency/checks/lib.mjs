// Shared helpers for the saoc-design-consistency checks. Browser checks run against DC_BASE_URL when set (a
// running SAOC-host server, or the beta origin with BETA_BASIC_AUTH_USER/PASSWORD for the deployed variants);
// otherwise they start `next dev` on a free port from the current working directory in fixture-replay mode with the
// beta wall disabled, and stop exactly that PID when done. Nothing here writes to Sanity or Firestore.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { chromium } from 'playwright';

// Routes warmed before measuring on a locally started server.
const WARM_ROUTES = ['/about', '/judging', '/sponsors', '/members', '/memorandum-of-incorporation', '/privacy', '/terms', '/refunds', '/societies', '/contact'];
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

// Production mode (DC_PROD=1, no DC_BASE_URL): `next build` when .next has no BUILD_ID, then `next start` on a free port, served as http://saoc.localhost:<port>
// with the recipe env (README.md): fixture replay, beta wall off, the two site origins differing. Home (/) then renders locally, so the checks include it.
const PROD_ENV = { BETA_BASIC_AUTH_USER: '', BETA_BASIC_AUTH_PASSWORD: '', BETA_PASSWORD_WALL_OFF: 'true', SANITY_FIXTURE_MODE: 'replay', SANITY_FIXTURE_DIR: FIXTURE_DIR, NEXT_PUBLIC_SAOC_SITE_URL: 'http://localhost', NEXT_PUBLIC_NOS_SITE_URL: 'http://nos.localhost' };
const NEXT_BIN = 'node_modules/next/dist/bin/next';

export async function withSite(fn) {
  let child = null; let base = process.env.DC_BASE_URL; const prod = Boolean(process.env.DC_PROD) && !base;
  if (!base) {
    // A bare `next build`/`next dev` leaves public/images/_opt empty and the hero returns 404: generate the variants first, as `pnpm build` and `pnpm dev` do.
    if (existsSync('scripts/generate-image-variants.mjs') && (!existsSync('public/images/_opt') || (prod && !existsSync('.next/BUILD_ID')))) spawnSync(process.execPath, ['scripts/generate-image-variants.mjs'], { stdio: 'ignore' });
    const port = await freePort(); base = prod ? `http://saoc.localhost:${port}` : `http://localhost:${port}`;
    if (prod && !existsSync('.next/BUILD_ID')) {
      const b = spawnSync(process.execPath, [NEXT_BIN, 'build'], { stdio: 'ignore', env: { ...process.env, ...PROD_ENV }, timeout: 1_200_000 });
      if (b.status !== 0) throw new Error('next build failed (DC_PROD)');
    }
    child = spawn(process.execPath, [NEXT_BIN, prod ? 'start' : 'dev', '--port', String(port)], { stdio: 'ignore', env: { ...process.env, ...(prod ? PROD_ENV : { BETA_BASIC_AUTH_USER: '', BETA_BASIC_AUTH_PASSWORD: '', SANITY_FIXTURE_MODE: 'replay', SANITY_FIXTURE_DIR: FIXTURE_DIR }) } });
    const deadline = Date.now() + 420_000;
    // Ready means a 200 AND a rendered header (a cold .next answers 404/500 or an empty shell while it compiles), with a generous timeout.
    for (;;) {
      try { const r = await fetch(base + '/about'); if (r.status === 200 && /data-hd="nav"/.test(await r.text())) break; } catch { /* not up yet */ }
      if (Date.now() > deadline) { child.kill(); throw new Error('server did not render /about with its header in time'); }
      await new Promise((r) => setTimeout(r, 2000));
    }
    // Warm every route the checks touch so the first browser load of each is not a compile.
    for (const path of WARM_ROUTES) { try { await fetch(base + path); } catch { /* the check itself reports a bad route */ } }
  }
  const user = process.env.BETA_BASIC_AUTH_USER; const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
  const browser = await chromium.launch();
  const ctxOpts = (vp, dpr = 1) => ({ viewport: vp, deviceScaleFactor: dpr, ...(process.env.DC_BASE_URL && user && pass ? { httpCredentials: { username: user, password: pass } } : {}) });
  // live: a real deployed origin (beta); home: Home (/) renders too (live, or a production build on saoc.localhost); /events needs live Sanity so it is live-only.
  const live = Boolean(process.env.DC_BASE_URL) && !/^https?:\/\/([^/]*\.)?(localhost|127\.0\.0\.1)\b/.test(process.env.DC_BASE_URL);
  const home = live || prod || /^https?:\/\/saoc\.localhost\b/.test(base);
  // prod: a production build (autostarted, or the README recipe on saoc.localhost): the only local origin whose LCP means anything.
  try { await fn({ base, browser, ctxOpts, deployed: home, live, prod: prod || /^https?:\/\/saoc\.localhost\b/.test(base) }); }
  finally { await browser.close(); if (child) child.kill(); }
}

export async function openPage(browser, ctxOpts, base, path, width, height = 1000, dpr = 1) {
  const ctx = await browser.newContext(ctxOpts({ width, height }, dpr)); const page = await ctx.newPage();
  // Phase-5 authenticated runs only: DC_ADMIN_SESSION is a verified admin `session` cookie value (lib/admin-auth.ts), read from the environment and never printed. Unset, nothing changes.
  if (process.env.DC_ADMIN_SESSION && process.env.DC_BASE_URL) await ctx.addCookies([{ name: 'session', value: process.env.DC_ADMIN_SESSION, url: base, httpOnly: true, secure: base.startsWith('https:') }]);
  const resp = await page.goto(base + path, { waitUntil: 'load', timeout: 120_000 }); await page.waitForSelector('header', { timeout: 60_000 }).catch(() => {}); await page.waitForTimeout(700);
  return { page, ctx, status: resp ? resp.status() : 0 };
}

// Any CSS colour string to [r,g,b,a] via a canvas (handles oklab/oklch that Chromium reports for Tailwind colours).
export const RGBA_FN = `(c) => { const k = document.createElement('canvas'); k.width = k.height = 1; const x = k.getContext('2d', { willReadFrequently: true }); x.clearRect(0,0,1,1); x.fillStyle = '#000'; x.fillStyle = c; x.fillRect(0,0,1,1); const d = x.getImageData(0,0,1,1).data; return [d[0], d[1], d[2], d[3] / 255]; }`;
export const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
export const blend = ([r, g, b, a], [br, bg, bb]) => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
export const ratio = (fg, bg) => { const l1 = lum(fg), l2 = lum(bg); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

// Routes that carry the SAOC inner PageHero, and the PG-1 exceptions (Events list, Societies grid, Contact).
export const INNER_ROUTES = ['/about', '/judging', '/sponsors', '/members', '/memorandum-of-incorporation', '/privacy', '/terms', '/refunds'];
// The ten routes the F1e gates walk. Home needs `home`, /events needs `live`.
export const TEN_ROUTES = ['/', '/about', '/societies', '/judging', '/events', '/sponsors', '/members', '/contact', '/privacy', '/terms'];
export const tenRoutes = ({ deployed, live }) => TEN_ROUTES.filter((r) => (r !== '/' || deployed) && (r !== '/events' || live));
export const EXEMPT_ROUTES = ['/societies', '/contact'];

// A society detail route (the first linked from /societies), so a walk covers a page whose back link carries the mirrored arrow. Returns null when /societies links none.
export async function societyDetail(base) {
  try { const html = await (await fetch(base + '/societies')).text(); const m = /href="(\/societies\/[a-z0-9][a-z0-9-]*)"/.exec(html); return m ? m[1] : null; } catch { return null; }
}
