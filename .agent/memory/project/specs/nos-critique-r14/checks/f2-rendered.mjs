// nos-critique-r14 f2 rendered (production build, next start 3010-3019 minus 3013, PUBLIC mode). QA input, hash-locked.
// F2 (lead ruling FINAL 2026-10-18): /societies carries its own meta description, the Drive sentence in goldens/f2-description.json.
//   R1  /societies: <meta name="description">, og:description and twitter:description each equal the golden string exactly; the title stays
//       "Affiliated Societies | South African Orchid Council" and the h1 "Find an orchid society near you".
//   R2  the site default (app/layout.tsx DEFAULT_DESCRIPTION, read from BASE) is in none of those three /societies head tags. The root
//       layout's Organization JSON-LD description is site-wide, not a page description, and is not checked.
//   R3  F24's description rules (contracts/checks/launch-weekend/f24/_rules.mjs descProblems, D1-D4) hold on every swept public route, as
//       F24-A3 asserts, and no other swept route carries the /societies description (including /about's).
//   R4  UNSOURCED_LEDE (read from the page source) and F24's STATIC_CLAIM are absent from the public /societies HTML and its rendered text.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { SOCIETIES, finish, golden, readBaseFile, readRepoFile, repoRoot } from './_lib.mjs';
import { assertFreshBuild, require, startServer } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f2-rendered.mjs';
const G = JSON.parse(golden('f2-description.json'));
const ROUTE = G.route;
const TITLE = 'Affiliated Societies | South African Orchid Council';
const H1 = 'Find an orchid society near you';
const F24 = path.join(repoRoot, 'contracts/checks/launch-weekend/f24');
const { sweepRoutes, readMeta } = await import(pathToFileURL(path.join(F24, '_meta.mjs')).href);
const { descProblems, STATIC_CLAIM } = await import(pathToFileURL(path.join(F24, '_rules.mjs')).href);
const norm = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
const failures = [];

const layout = readBaseFile('app/layout.tsx') ?? '';
const DEFAULT = /const DEFAULT_DESCRIPTION =\s*'([^']+)';/.exec(layout)?.[1];
if (!DEFAULT) failures.push('cannot read DEFAULT_DESCRIPTION from app/layout.tsx at BASE');
const LEDE = /const UNSOURCED_LEDE =\s*'([^']+)';/.exec(readRepoFile(SOCIETIES) ?? '')?.[1];
if (!LEDE) failures.push(`cannot read UNSOURCED_LEDE from ${SOCIETIES}; it must stay in the page, withheld on public`);

let browser;
let srv;
const seen = {};
try {
  if (!process.env.NOS_CR14_ORIGIN) {
    const stale = assertFreshBuild([SOCIETIES]);
    if (stale.length > 0) finish(NAME, stale);
  }
  srv = process.env.NOS_CR14_ORIGIN ? { origin: process.env.NOS_CR14_ORIGIN, stop: () => {} } : await startServer({ publicMode: true });
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  for (const { route, optional } of sweepRoutes()) {
    const m = await readMeta(page, route, srv.origin);
    if (m.status !== 200) { if (!optional) failures.push(`${route}: HTTP ${m.status}`); continue; }
    seen[route] = m;
    for (const [id, msg] of descProblems(m.description, m.lede, route)) failures.push(`${route}: [${id}] ${msg} (R3)`);
    if (m.ogDescription && m.description && m.ogDescription !== m.description) for (const [id, msg] of descProblems(m.ogDescription, m.lede, route)) failures.push(`${route}: og:description [${id}] ${msg} (R3)`);
    if (route === ROUTE) {
      m.twitter = await page.evaluate(() => document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') ?? null);
      m.text = await page.evaluate(() => document.body.innerText);
    }
  }
  const res = await fetch(`${srv.origin}${ROUTE}`);
  seen.html = res.status === 200 ? await res.text() : null;
  if (seen.html === null) failures.push(`${ROUTE}: raw fetch HTTP ${res.status}`);
  await ctx.close();
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  if (srv) await srv.stop();
  if (browser) await browser.close();
}

const s = seen[ROUTE];
if (!s) failures.push(`${ROUTE} was not measured`);
else {
  // R1
  for (const [tag, v] of [['meta description', s.description], ['og:description', s.ogDescription], ['twitter:description', s.twitter]]) {
    if (v !== G.text) failures.push(`${ROUTE}: ${tag} is ${JSON.stringify(v)}, want the Drive sentence exactly (R1)`);
    // R2
    if (DEFAULT && norm(v) === DEFAULT) failures.push(`${ROUTE}: ${tag} is still the site default (R2)`);
  }
  if (s.title !== TITLE) failures.push(`${ROUTE}: title is "${s.title}", want "${TITLE}" (R1)`);
  if (s.h1 !== H1) failures.push(`${ROUTE}: h1 is "${s.h1}", want "${H1}" (R1)`);
  // R3
  for (const [route, m] of Object.entries(seen)) if (route !== ROUTE && route !== 'html' && m.description && norm(m.description) === norm(s.description)) failures.push(`${route} repeats the ${ROUTE} description (R3)`);
  // R4
  if (LEDE) {
    if (seen.html && seen.html.includes(LEDE)) failures.push(`${ROUTE}: UNSOURCED_LEDE is in the public HTML (R4)`);
    if (norm(s.text).includes(norm(LEDE))) failures.push(`${ROUTE}: UNSOURCED_LEDE is rendered on public (R4)`);
  }
  if (seen.html && STATIC_CLAIM.test(seen.html)) failures.push(`${ROUTE}: F24's unsourced "21" claim is in the public HTML (R4)`);
}

const n = Object.keys(seen).filter((k) => k !== 'html').length;
finish(NAME, failures, `${ROUTE} carries the Drive sentence as description, og:description and twitter:description, not the default; ${n} public routes meet F24 D1-D4 and none repeats it; UNSOURCED_LEDE stays withheld.`);
