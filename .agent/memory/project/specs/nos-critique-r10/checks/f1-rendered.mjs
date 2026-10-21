// nos-critique-r10 f1 rendered (production build, next start 3010-3019, public mode): defining the tokens and dropping the fallbacks moves nothing.
//   Routes: /national-show/tickets (hub: masthead facts and visit links, pool banner, ticket stubs, buy CTA), /national-show/workshops (cards and stubs), and the hub's first
//   checkout link (purchase form CTA). Widths 375 and 1280.
//   Every element matching each audited selector reports its computed font-size (the five --fs uses) or background-color + background-image (.nk-stub, the --nk-field use);
//   the whole map must equal goldens/f1-baseline.json, captured by @architect on the d05c85a5 build (`--capture` prints the map, it never writes a file). Each selector must match
//   at least one element somewhere, so a route that stops rendering cannot pass by measuring nothing.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { finish, golden, repoRoot } from './_lib.mjs';
import { AUTH, assertFreshBuild, startServer } from './_server.mjs';

const NAME = 'f1-rendered.mjs';
const CAPTURE = process.argv.includes('--capture');
const failures = [];
const sourceFiles = JSON.parse(golden('f1-footprint.json')).filter((rel) => existsSync(path.join(repoRoot, rel)));
const WIDTHS = [375, 1280];
const ROUTES = ['/national-show/tickets', '/national-show/workshops'];
// nos-structure.css at BASE d05c85a5: :771 .nk-btn, :1347 .nk-pool strong, :1354 .nk-pool p, :1535 .nk-facts dd, :1572 .nk-visit a, :882 .nk-stub.
const PROBES = [
  { sel: '.nos-theme .nk-btn', props: ['font-size'] },
  { sel: '.nos-theme .nk-pool strong', props: ['font-size'] },
  { sel: '.nos-theme .nk-pool p', props: ['font-size'] },
  { sel: '.nos-theme .nk-facts dd', props: ['font-size'] },
  { sel: '.nos-theme .nk-visit a', props: ['font-size'] },
  { sel: '.nos-theme .nk-stub', props: ['background-color', 'background-image'] },
];

const measure = (probes) => Object.fromEntries(probes.map(({ sel, props }) => [sel, [...document.querySelectorAll(sel)].map((el) => {
  const cs = getComputedStyle(el);
  return props.map((p) => `${p}: ${cs.getPropertyValue(p)}`).join('; ');
})]));

let browser;
let srv;
const got = {};
try {
  if (!process.env.NOS_CR10_ORIGIN) {
    const stale = assertFreshBuild(sourceFiles);
    if (stale.length > 0) finish(NAME, stale);
  }
  process.env.SHOW_PLACEHOLDER_PREVIEW = ''; // public mode; the withhold switch matches 'true' exactly
  srv = process.env.NOS_CR10_ORIGIN ? { origin: process.env.NOS_CR10_ORIGIN, stop: () => {} } : await startServer();
  browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  let checkout = null;
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    const routes = [...ROUTES];
    if (checkout) routes.push(checkout);
    for (let i = 0; i < routes.length; i += 1) {
      const route = routes[i];
      const res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) { failures.push(`${route} @${width}: HTTP ${res && res.status()}`); continue; }
      await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
      got[`${route} @${width}`] = await page.evaluate(measure, PROBES);
      if (route === ROUTES[0] && checkout === null) {
        checkout = await page.evaluate(() => { const a = document.querySelector('a[data-ticket-cta][href^="/"]'); return a ? a.getAttribute('href').split('#')[0] : null; });
        if (checkout) routes.push(checkout);
      }
    }
    await ctx.close();
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  if (srv) await srv.stop();
  if (browser) await browser.close();
}

if (CAPTURE) {
  if (failures.length) finish(NAME, failures);
  process.stdout.write(`${JSON.stringify({ recorded: 'from the d05c85a5 build (next start, public mode, DPR 1)', measured: got }, null, 1)}\n`);
  process.exit(0);
}
const want = JSON.parse(golden('f1-baseline.json')).measured;
for (const key of new Set([...Object.keys(want), ...Object.keys(got)])) {
  if (!(key in got)) { failures.push(`${key}: not measured (the baseline has it)`); continue; }
  if (!(key in want)) { failures.push(`${key}: measured but not in the baseline`); continue; }
  for (const { sel } of PROBES) {
    const a = JSON.stringify(want[key][sel] ?? []);
    const b = JSON.stringify(got[key][sel] ?? []);
    if (a !== b) failures.push(`${key} ${sel}: computed ${b}, baseline ${a}`);
  }
}
for (const { sel } of PROBES) if (!Object.values(got).some((m) => (m[sel] ?? []).length > 0)) failures.push(`${sel}: matched no element on any route; the probe measures nothing`);

finish(NAME, failures, `computed font-size and stub backgrounds equal the d05c85a5 baseline on ${Object.keys(got).length} route/width pairs.`);
