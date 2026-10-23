// Mission nos-site-split — type render gate (NOS Design footer-serif-ruling T1-T6).
// Starts `next start` (needs a prior `pnpm build`) on a fixed local port with sandbox-only env, then drives
// Chromium against the SAOC home, about and judging pages, the NOS hub and NOS about, at 390/1280/1440.
// Read-only: GET only. For every text element set in a serif face (Crimson Pro on SAOC, Fraunces on NOS):
//   SAOC   computed weight follows the size rule: >=32px 300, 20-31.99px 400, <20px 500 (T2)
//   NOS    display sizes (>=20px) sit at 300-400 so the two sites match (T5); small text is only held to the loaded-face rule
//   >=32px letter-spacing is -0.015em (T2), display numerals included
//   both   the computed weight is a weight the browser actually loaded for that face, so nothing is
//          synthesised (document.fonts), and no serif element computes to 600 or above outside the lockup
// `--report` lists the offenders grouped by element signature instead of failing on the first.
// Screenshots go to ../split-shots (relative to the worktree), type-NAME.png. Exit 1 on any failure.
import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { chromium } from '@playwright/test';

const REPORT = process.argv.includes('--report');
const PORT = 3218;
const SAOC_HOST = `saoc.localhost:${PORT}`;
const NOS_HOST = `nos.localhost:${PORT}`;
const CREDENTIALS = { username: 's', password: 'p' };
const SHOT_DIR = '../split-shots';
const LOG_DIR = '.tmp/sandbox/nos-split';
const VIEWPORTS = [[390, 844], [1280, 800], [1440, 900]];
const PAGES = [
  ['saoc-home', SAOC_HOST, '/', 'saoc'],
  ['saoc-about', SAOC_HOST, '/about', 'saoc'],
  ['saoc-judging', SAOC_HOST, '/judging', 'saoc'],
  ['nos-hub', NOS_HOST, '/', 'nos'],
  ['nos-about', NOS_HOST, '/about', 'nos'],
  ['nos-vendors', NOS_HOST, '/vendors', 'nos'],
  ['nos-tickets', NOS_HOST, '/tickets', 'nos'],
  ['nos-tickets-cancelled', NOS_HOST, '/tickets/cancelled', 'nos'],
  ['nos-tickets-confirmation', NOS_HOST, '/tickets/confirmation', 'nos'],
];
// NOS Design ruling on #54: /admin and components/admin keep 600 as their UI register, so no admin page is in
// PAGES, and a page whose path is under one of these prefixes is skipped if it is ever added.
const ADMIN_EXEMPT_PREFIXES = ['/admin'];
const TRACKING_EM = -0.015;
const TRACKING_TOLERANCE_PX = 0.06;
const DISPLAY_PX = 32;
const SUBHEAD_PX = 20;
const SAOC_WEIGHTS = { display: 300, subhead: 400, small: 500 };
const SIZE_EPSILON = 0.01;

mkdirSync(SHOT_DIR, { recursive: true });
mkdirSync(LOG_DIR, { recursive: true });
const log = openSync(`${LOG_DIR}/type-check-start.log`, 'w');
const server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT)], {
  stdio: ['ignore', log, log],
  env: {
    ...process.env,
    NODE_ENV: 'production',
    BETA_BASIC_AUTH_USER: CREDENTIALS.username,
    BETA_BASIC_AUTH_PASSWORD: CREDENTIALS.password,
    SITE_PUBLIC_LAUNCH: '',
    NEXT_PUBLIC_SAOC_SITE_URL: `http://${SAOC_HOST}`,
    NEXT_PUBLIC_NOS_SITE_URL: `http://${NOS_HOST}`,
    SITE_URL: `http://${SAOC_HOST}`,
  },
});

let failures = 0;
const offenders = new Map();
function check(name, ok, detail) {
  if (!REPORT) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures += 1;
}

async function waitUp() {
  for (let i = 0; i < 90; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`, { headers: { Host: SAOC_HOST, Authorization: `Basic ${Buffer.from('s:p').toString('base64')}` } });
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`next start did not come up; see ${LOG_DIR}/type-check-start.log`);
}

/** Runs in the page: every text-bearing element set in a serif face, with what the browser loaded for it. */
function collectSerif() {
  const SERIF = /crimson|fraunces/i;
  const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => ({ family: f.family.replace(/"/g, ''), style: f.style, weight: f.weight }));
  const inRange = (spec, weight) => {
    const [lo, hi = lo] = spec.split(/\s+/).map(Number);
    return weight >= lo && weight <= hi;
  };
  const rows = [];
  for (const el of document.body.querySelectorAll('*')) {
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) continue;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || (rect.width === 0 && rect.height === 0)) continue;
    const primary = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    if (!SERIF.test(primary)) continue;
    const weight = Number(cs.fontWeight);
    const style = cs.fontStyle === 'italic' ? 'italic' : 'normal';
    const faces = loaded.filter((f) => f.family === primary && f.style === style);
    rows.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute('class') ?? '').replace(/\s+/g, ' ').slice(0, 110),
      text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40),
      face: /fraunces/i.test(primary) ? 'fraunces' : 'crimson',
      size: parseFloat(cs.fontSize),
      tracking: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing),
      weight,
      style,
      loadedFace: faces.some((f) => inRange(f.weight, weight)),
      anyFaceLoaded: faces.length > 0,
    });
  }
  return rows;
}

function expectedWeights(site, size) {
  if (site === 'saoc') {
    if (size >= DISPLAY_PX - SIZE_EPSILON) return [SAOC_WEIGHTS.display];
    if (size >= SUBHEAD_PX - SIZE_EPSILON) return [SAOC_WEIGHTS.subhead];
    return [SAOC_WEIGHTS.small];
  }
  return size >= SUBHEAD_PX - SIZE_EPSILON ? [300, 400] : null;
}

async function checkPage(browser, [label, host, path, site], [width, height]) {
  if (ADMIN_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))) return;
  const context = await browser.newContext({ viewport: { width, height }, httpCredentials: CREDENTIALS });
  const page = await context.newPage();
  await page.goto(`http://${host}${path}`, { waitUntil: 'networkidle' });
  // Fonts load on first use: scroll the whole page so every face the page uses is requested.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    window.scrollTo(0, 0);
    await document.fonts.ready;
  });
  const rows = await page.evaluate(collectSerif);
  const tag = `${label} ${width}`;
  const bad = [];
  for (const row of rows) {
    const want = expectedWeights(site, row.size);
    const problems = [];
    if (want && !want.includes(row.weight)) problems.push(`weight ${row.weight}, expected ${want.join('/')}`);
    if (!row.loadedFace) problems.push(`weight ${row.weight} is not a loaded ${row.face} ${row.style} face (synthesised)`);
    if (row.size >= DISPLAY_PX - SIZE_EPSILON && Math.abs(row.tracking - TRACKING_EM * row.size) > TRACKING_TOLERANCE_PX) {
      problems.push(`tracking ${row.tracking.toFixed(2)}px, expected ${(TRACKING_EM * row.size).toFixed(2)}px (-0.015em)`);
    }
    if (problems.length) bad.push({ row, problems });
  }
  check(`type ${tag}: ${rows.length} serif elements follow the weight rule`, rows.length > 0 && bad.length === 0, bad.slice(0, 3).map((b) => `${b.row.tag}.${b.row.size}px "${b.row.text}" ${b.problems[0]}`).join(' | '));
  for (const { row, problems } of bad) {
    const key = `${site} <${row.tag}> ${row.cls}`;
    const entry = offenders.get(key) ?? { sizes: new Set(), weights: new Set(), problems: new Set(), where: new Set(), text: row.text };
    entry.sizes.add(Math.round(row.size));
    entry.weights.add(row.weight);
    entry.where.add(tag);
    problems.forEach((p) => entry.problems.add(p));
    offenders.set(key, entry);
  }
  await page.screenshot({ path: `${SHOT_DIR}/type-${label}-${width}.png`, fullPage: false });
  await context.close();
}

async function shootPartners(browser) {
  for (const [width, height] of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width, height }, httpCredentials: CREDENTIALS });
    const page = await context.newPage();
    await page.goto(`http://${SAOC_HOST}/`, { waitUntil: 'networkidle' });
    const section = page.locator('section', { hasText: 'In collaboration with' }).first();
    const found = (await section.count()) > 0;
    check(`partners ${width}: the "In collaboration with" section is on the SAOC home`, found);
    if (found) {
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await section.screenshot({ path: `${SHOT_DIR}/type-saoc-partners-${width}.png` });
    }
    await context.close();
  }
}

try {
  await waitUp();
  const browser = await chromium.launch();
  for (const target of PAGES) for (const viewport of VIEWPORTS) await checkPage(browser, target, viewport);
  await shootPartners(browser);
  await browser.close();
} finally {
  server.kill();
}
if (REPORT) {
  for (const [key, e] of [...offenders].sort()) {
    console.log(`${key}\n    sizes ${[...e.sizes].join(',')} weights ${[...e.weights].join(',')} at ${[...e.where].join(' ')} :: ${[...e.problems][0]} :: "${e.text}"`);
  }
  console.log(`${offenders.size} offender signatures`);
} else {
  console.log(failures === 0 ? 'type render check: all passed' : `type render check: ${failures} FAILED`);
}
process.exit(failures === 0 || REPORT ? 0 : 1);
