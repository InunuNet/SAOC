// Shared helpers for the saoc-inner-heroes gates (re-synced from nos-pagehero/checks/_lib.mjs): golden loading, a `next start`
// server on the production build (build.sh first), a Playwright launcher, route discovery, a failure collector, and the in-browser
// pixel helpers behind the scrim-local and per-glyph contrast gates. Every gate runs from the repo root of the dev's worktree.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, openSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SPEC = '.agent/memory/project/specs/saoc-inner-heroes';
export const GOLDEN = JSON.parse(readFileSync(`${SPEC}/goldens/crop-map.json`, 'utf8'));
export const T = GOLDEN.thresholds;
export const BASE_PORT = Number(process.env.SAOC_PAGEHERO_PORT ?? 3081);
export const AUTH_USER = 'sandbox';
export const AUTH_PASS = 'sandbox-pass';
export const AUTH = `Basic ${Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64')}`;
export const SHOT_DIR = '.tmp/sandbox/saoc-pagehero-gate/shots';
const LOG_DIR = '.tmp/sandbox/saoc-pagehero-gate';
mkdirSync(SHOT_DIR, { recursive: true });

/** Start `next start` on BASE_PORT + offset with BETA_PASSWORD_WALL_OFF=true, live Sanity reads (replay opt-in) and placeholder preview on. */
export function startServer(offset) {
  const port = BASE_PORT + offset;
  const env = {
    ...process.env, NODE_ENV: 'production', BETA_BASIC_AUTH_USER: AUTH_USER, BETA_BASIC_AUTH_PASSWORD: AUTH_PASS, SITE_PUBLIC_LAUNCH: '',
    SHOW_PLACEHOLDER_PREVIEW: 'true',
    NEXT_PUBLIC_NOS_SITE_URL: `http://nos.localhost:${port}`, NEXT_PUBLIC_SAOC_SITE_URL: `http://saoc.localhost:${port}`,
  };
  env.BETA_PASSWORD_WALL_OFF = 'true'; // 10-26 gate environment: wall off. The sandbox basic-auth values above stay as dummies.
  // Sanity is read live (GET only, public dataset), as checks/f2-build.sh already does at build time. The recorded replay fixture cannot serve
  // the runtime: the societyEvent queries take $todayStart (lib/sast-date.ts, SAST start of day), so every entry is keyed to the day it was
  // recorded; from the next SAST midnight home, /events and /societies/[slug] fail closed with a 500 (SanityFixtureMiss) and each probe waits
  // out its 20 s timeout - the 11 minute served-width run of 10-27. SAOC_GATE_SANITY_REPLAY=1 restores replay.
  if (process.env.SAOC_GATE_SANITY_REPLAY === '1') {
    env.SANITY_FIXTURE_MODE = 'replay';
    env.SANITY_FIXTURE_DIR = process.env.SANITY_FIXTURE_DIR ?? resolve('.agent/memory/project/specs/nos-content-standard/fixtures/sanity');
  } else {
    delete env.SANITY_FIXTURE_MODE;
    delete env.SANITY_FIXTURE_DIR;
  }
  const log = openSync(`${LOG_DIR}/next-start-${port}.log`, 'w');
  const proc = spawn('node_modules/.bin/next', ['start', '-p', String(port)], { stdio: ['ignore', log, log], env });
  return { port, proc, saoc: `http://saoc.localhost:${port}` };
}

export async function waitReady(server) {
  for (let i = 0; i < 90; i += 1) {
    try {
      const r = await fetch(`${server.saoc}/about`, { headers: { authorization: AUTH } });
      if (r.status < 500) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('server never became ready');
}

export async function launchChromium() {
  const require = createRequire(`${process.cwd()}/package.json`);
  const { chromium } = require('@playwright/test');
  return chromium.launch();
}

export function newContext(browser, vp) {
  return browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf ?? 1, httpCredentials: { username: AUTH_USER, password: AUTH_PASS } });
}

export function collector(label) {
  const failures = [];
  return {
    check: (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); },
    note: (line) => console.log(line),
    finish(server) {
      server?.proc.kill();
      if (failures.length) { console.error(`${label} FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
      console.log(`${label} pass`);
      process.exit(0);
    },
    fail: (e) => failures.push(`exception ${e.message}`),
  };
}

/** Run `body` with a started server, always reporting through the collector. */
export async function withServer(offset, label, body) {
  const c = collector(label);
  const server = startServer(offset);
  try { await waitReady(server); await body(server, c); } catch (e) { c.fail(e); console.error(e); }
  c.finish(server);
}

/** First link under `hrefPrefix` found on `from` (a society slug route), or null. */
export async function discoverPath(page, base, from, hrefPrefix) {
  await page.goto(`${base}${from}`, { waitUntil: 'load' });
  return page.evaluate((prefix) => [...document.querySelectorAll(`a[href^="${prefix}"]`)].map((a) => a.getAttribute('href')).find((h) => h && h.length > prefix.length)?.split(/[?#]/)[0] ?? null, hrefPrefix);
}

/**
 * Navigate to a golden hero route and say whether it rendered a PageHero. A conditional route that does not render is logged
 * `NOT PROBED (stated reason)` by the caller and never silently skipped; an unconditional one is a failure.
 */
export async function openHeroRoute(page, server, route, c, tag) {
  let path = route.path;
  if (route.discover) {
    path = await discoverPath(page, server.saoc, route.discover.from, route.discover.hrefPrefix);
    if (!path) { c.check(`${tag} a link under ${route.discover.hrefPrefix} exists to probe ${route.path}`, false); return null; }
  }
  const res = await page.goto(`${server.saoc}${path}`, { waitUntil: 'load' });
  const rendered = res?.status() === (route.expectStatus ?? 200) && new URL(page.url()).pathname === path && (await page.locator('section[data-page-hero]').count()) > 0;
  if (!rendered) {
    if (route.conditional) { c.note(`NOT PROBED (stated reason): ${tag} ${path} -> ${res?.status()} ${page.url()}: ${route.conditional.reason}`); return null; }
    c.check(`${tag} ${path} renders a PageHero`, false, `status ${res?.status()} url ${page.url()}`);
    return null;
  }
  await page.evaluate(() => document.fonts.ready);
  return path;
}

/** Freeze motion so a screenshot is repeatable. */
export async function freeze(page) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
}

/** Document-space rect of an element, or null. */
export const docRect = (page, selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
}, selector);

const TEXT_HIDDEN = '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important;caret-color:transparent!important}';

/** Screenshot of the hero with every glyph made transparent (the background the glyphs sit on), as base64 PNG. */
export async function heroBackgroundShot(page, heroSel) {
  const style = await page.addStyleTag({ content: `${heroSel} ${TEXT_HIDDEN}` });
  const clip = await docRect(page, heroSel);
  const png = await page.screenshot({ fullPage: true, clip: { x: clip.x, y: clip.y, width: clip.w, height: clip.h } });
  await style.evaluate((el) => el.remove());
  return { b64: png.toString('base64'), clip };
}

/** Same, but with everything that is not the photograph (or one of its ancestors) hidden: the photograph on its own. */
export async function heroPhotoOnlyShot(page, heroSel, imgSel) {
  await page.evaluate(({ heroSel: h, imgSel: i }) => {
    const hero = document.querySelector(h);
    const img = hero.querySelector(i);
    const keep = new Set();
    for (let el = img; el && el !== hero; el = el.parentElement) keep.add(el);
    keep.add(hero);
    for (const el of hero.querySelectorAll('*')) if (!keep.has(el) && !img.contains(el)) el.setAttribute('data-gate-hidden', '');
  }, { heroSel, imgSel });
  const style = await page.addStyleTag({ content: `${heroSel} [data-gate-hidden]{visibility:hidden!important}` });
  const shot = await heroBackgroundShot(page, heroSel);
  await style.evaluate((el) => el.remove());
  await page.evaluate(() => document.querySelectorAll('[data-gate-hidden]').forEach((el) => el.removeAttribute('data-gate-hidden')));
  return shot;
}

/** Pixel helpers run in a scratch page: mean absolute difference over a region, and per-box contrast against a background shot. */
export async function pixelPage(browser) {
  const page = await browser.newPage();
  await page.setContent('<canvas id="c"></canvas>');
  return page;
}

export async function meanAbsDiff(px, aB64, bB64, region) {
  return px.evaluate(async ({ a, b, region: rg }) => {
    const load = (s) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `data:image/png;base64,${s}`; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const x0 = Math.round(rg.x0 * w), x1 = Math.round(rg.x1 * w), y0 = Math.round(rg.y0 * h), y1 = Math.round(rg.y1 * h);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(ia, 0, 0); const da = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    ctx.clearRect(0, 0, w, h); ctx.drawImage(ib, 0, 0); const db = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let sum = 0, n = 0;
    for (let i = 0; i < da.length; i += 4) { sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]); n += 3; }
    return n ? sum / n : 0;
  }, { a: aB64, b: bB64, region });
}

/** Mean colour of a small box of a screenshot (CSS px relative to the shot). */
export async function meanColor(px, b64, box) {
  return px.evaluate(async ({ s, box: bx }) => {
    const i = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `data:image/png;base64,${s}`; });
    const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(i, 0, 0);
    const d = ctx.getImageData(Math.round(bx.x), Math.round(bx.y), Math.max(1, Math.round(bx.w)), Math.max(1, Math.round(bx.h))).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; n += 1; }
    return [r / n, g / n, b / n];
  }, { s: b64, box });
}

/**
 * Glyph boxes of the copy inside `heroSel`: one per visible non-space character, with its computed colour, the product of the
 * opacity of the element and its ancestors, and a kind (eyebrow | h1 | lede | cta | other). Rects are document-space CSS px.
 */
export const glyphBoxes = (page, heroSel) => page.evaluate((sel) => {
  const hero = document.querySelector(sel);
  const out = [];
  const kindOf = (el) => {
    if (el.closest('h1')) return 'h1';
    if (el.closest('[data-page-hero-lede],[data-hero-lede]')) return 'lede';
    if (el.closest('a,button')) return 'cta';
    if (el.closest('[data-page-hero-eyebrow]')) return 'eyebrow';
    if (el.closest('span') && el.closest('span').className.includes('rounded-full')) return 'eyebrow';
    return 'other';
  };
  // Any CSS colour syntax (rgb, oklab, color(srgb ...)) is normalised by painting it on a 1x1 canvas.
  const cvs = document.createElement('canvas'); cvs.width = 1; cvs.height = 1;
  const cx = cvs.getContext('2d', { willReadFrequently: true });
  const parse = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return { rgb: [d[0], d[1], d[2]], a: d[3] / 255 }; };
  const walker = document.createTreeWalker(hero, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || !n.textContent.trim()) continue;
    let opacity = 1;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) opacity *= Number(getComputedStyle(a).opacity);
    const { rgb, a } = parse(cs.color);
    const range = document.createRange();
    for (let i = 0; i < n.textContent.length; i += 1) {
      if (!n.textContent[i].trim()) continue;
      range.setStart(n, i); range.setEnd(n, i + 1);
      const r = range.getClientRects()[0];
      if (!r || r.width < 1 || r.height < 1) continue;
      out.push({ ch: n.textContent[i], kind: kindOf(el), rgb, alpha: a * opacity, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height });
    }
  }
  return out;
}, heroSel);

// Screenshot of the hero as painted (text visible), base64 PNG, same clip as heroBackgroundShot.
export async function heroTextShot(page, heroSel) {
  const clip = await docRect(page, heroSel);
  return (await page.screenshot({ fullPage: true, clip: { x: clip.x, y: clip.y, width: clip.w, height: clip.h } })).toString('base64');
}

// Worst WCAG contrast per kind, measured on the ink. A glyph's ink pixels are the pixels that differ between the painted hero and the
// text-free shot inside the glyph's box (the line box is taller than the letter, so sampling the whole box would score the photograph
// above and below it); each ink pixel is scored as the glyph colour against the background pixel under it, and the 0.5th-percentile
// pixel is the glyph's worst case. A glyph with fewer than 6 ink pixels is skipped (a space-like mark).
export async function contrastByKind(px, bgB64, inkB64, clip, glyphs) {
  return px.evaluate(async ({ s, t, clip: cl, glyphs: gs }) => {
    const load = (b64) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `data:image/png;base64,${b64}`; });
    const [ib, it] = await Promise.all([load(s), load(t)]);
    const cvB = document.createElement('canvas'); cvB.width = ib.width; cvB.height = ib.height;
    const cxB = cvB.getContext('2d', { willReadFrequently: true }); cxB.drawImage(ib, 0, 0);
    const cvT = document.createElement('canvas'); cvT.width = it.width; cvT.height = it.height;
    const cxT = cvT.getContext('2d', { willReadFrequently: true }); cxT.drawImage(it, 0, 0);
    const lin = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const res = {};
    for (const g of gs) {
      const x = Math.max(0, Math.floor(g.x - cl.x)), y = Math.max(0, Math.floor(g.y - cl.y));
      const w = Math.max(1, Math.min(ib.width - x, Math.ceil(g.w))), h = Math.max(1, Math.min(ib.height - y, Math.ceil(g.h)));
      const db = cxB.getImageData(x, y, w, h).data, dt = cxT.getImageData(x, y, w, h).data;
      const cs = [];
      for (let k = 0; k < db.length; k += 4) {
        if (Math.abs(db[k] - dt[k]) + Math.abs(db[k + 1] - dt[k + 1]) + Math.abs(db[k + 2] - dt[k + 2]) < 90) continue;
        const a = g.alpha;
        const l1 = lum(a * g.rgb[0] + (1 - a) * db[k], a * g.rgb[1] + (1 - a) * db[k + 1], a * g.rgb[2] + (1 - a) * db[k + 2]);
        const l2 = lum(db[k], db[k + 1], db[k + 2]);
        cs.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
      }
      if (cs.length < 6) continue;
      cs.sort((p, q) => p - q);
      const worst = cs[Math.floor(cs.length * 0.005)];
      const cur = res[g.kind];
      if (!cur || worst < cur.worst) res[g.kind] = { worst, ch: g.ch, at: [Math.round(g.x), Math.round(g.y)], minAlpha: Math.min(g.alpha, cur?.minAlpha ?? 1), count: (cur?.count ?? 0) + 1 };
      else { cur.count += 1; cur.minAlpha = Math.min(cur.minAlpha, g.alpha); }
    }
    return res;
  }, { s: bgB64, t: inkB64, clip, glyphs });
}
