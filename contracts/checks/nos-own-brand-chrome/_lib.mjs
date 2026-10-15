// Shared helpers for the nos-own-brand-chrome F1 checks. Run with:
//   node --import tsx/esm contracts/checks/nos-own-brand-chrome/<check>.mjs
// from the worktree root. Spawns `next start` on NOS_PORT (default 3617) unless
// NOS_REUSE_SERVER=1 (then it uses whatever already answers on NOS_BASE).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

export const PORT = process.env.NOS_PORT || '3617';
export const BASE = process.env.NOS_BASE || `http://localhost:${PORT}`;
export const BASE_REF = process.env.NOS_BASE_REF || 'b2e0e90d';
export const SPEC_DIR = '.agent/memory/project/specs/nos-own-brand-chrome';
export const GOLDEN_DIR = `${SPEC_DIR}/goldens/f1`;

// Every NOS route that renders under app/(marketing)/national-show/ (static,
// parameter-free). Hub first.
export const HUB = '/national-show';
export const NOS_ROUTES = [
  '/national-show',
  '/national-show/about',
  '/national-show/what-to-expect',
  '/national-show/plan-your-visit',
  '/national-show/faq',
  '/national-show/programme',
  '/national-show/workshops',
  '/national-show/symposium',
  '/national-show/wosa-conference',
  '/national-show/conferences',
  '/national-show/sa-exhibitors',
  '/national-show/international-guests',
  '/national-show/exhibitors',
  '/national-show/vendors',
  '/national-show/tickets',
  '/national-show/sponsors',
  '/national-show/archive',
];
export const SAOC_ROUTES = ['/', '/about', '/societies', '/contact'];
export const SAOC_LOGO_RE = /saoc-(lockup|emblem|logo)|eulophia|footer-lapis/i;
export const NOS_LOGO_FILES = {
  header: 'nos-full-colour-horizontal-1200.png',
  footerH: 'nos-reversed-horizontal-1200.png',
  footerV: 'nos-reversed-white-vertical-900.png',
};
export const VP_DESKTOP = { width: 1280, height: 800 };
export const VP_PHONE = { width: 390, height: 844 };

async function up() {
  try {
    const r = await fetch(`${BASE}/about`);
    return r.status;
  } catch {
    return 0;
  }
}

export async function withServer(fn) {
  let child = null;
  // The checks must run from the worktree root: `next start` serves whatever .next is in cwd.
  if (!existsSync('contracts/checks/nos-own-brand-chrome/_lib.mjs')) {
    throw new Error(`cwd ${process.cwd()} is not the worktree root`);
  }
  if (process.env.NOS_REUSE_SERVER === '1') {
    if ((await up()) !== 200) throw new Error(`NOS_REUSE_SERVER=1 but ${BASE}/about is not 200`);
  } else {
    if (!existsSync('.next/BUILD_ID')) throw new Error('no .next/BUILD_ID: run SITE_PUBLIC_LAUNCH=true pnpm build first (or NOS_REUSE_SERVER=1 against a running server)');
    if ((await up()) !== 0) {
      throw new Error(`port ${PORT} already answers: refusing to test an unknown server (set NOS_PORT, or NOS_REUSE_SERVER=1)`);
    }
    child = spawn('node_modules/.bin/next', ['start', '-p', PORT], {
      env: { ...process.env, SITE_PUBLIC_LAUNCH: 'true', PORT },
      stdio: 'ignore',
      detached: true,
    });
    const deadline = Date.now() + 90_000;
    while ((await up()) !== 200) {
      if (Date.now() > deadline) {
        process.kill(-child.pid);
        throw new Error('next start did not become ready in 90s (is there a build? run next build first)');
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  try {
    return await fn();
  } finally {
    if (child) {
      try {
        process.kill(-child.pid);
      } catch {
        /* already gone */
      }
    }
  }
}

export async function withBrowser(fn) {
  const browser = await chromium.launch();
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

export async function openPage(browser, viewport, path, { waitUntil = 'networkidle' } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const res = await page.goto(`${BASE}${path}`, { waitUntil });
  return { ctx, page, status: res ? res.status() : 0 };
}

export function reporter(name) {
  const fails = [];
  return {
    fail: (msg) => fails.push(msg),
    note: (msg) => console.log(`  ${msg}`),
    done() {
      if (fails.length) {
        console.error(`FAIL ${name}: ${fails.length} problem(s)`);
        const max = Number(process.env.NOS_MAX_FAILS || 40);
        for (const f of fails.slice(0, max)) console.error(`  - ${f}`);
        if (fails.length > max) console.error(`  ... and ${fails.length - max} more (NOS_MAX_FAILS=${fails.length} to list all)`);
        process.exit(1);
      }
      console.log(`PASS ${name}`);
    },
  };
}

export async function main(name, body) {
  const r = reporter(name);
  try {
    await withServer(() => body(r));
  } catch (err) {
    console.error(`ERROR ${name}: ${err.message}`);
    process.exit(2);
  }
  r.done();
}

// In-page: is this element actually rendered and (optionally) inside the viewport.
export const IN_PAGE_HELPERS = `
  window.__vis = (el, inViewport) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (!(r.width > 0 && r.height > 0)) return false;
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    if (el.closest('[hidden]')) return false;
    if (inViewport && !(r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth)) return false;
    return true;
  };
`;
