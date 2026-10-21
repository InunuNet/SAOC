// nos-critique-r12 f4 rendered (production build, next start 3010-3019, PUBLIC mode as launch-weekend F24-A3). Reuses F24's sweep
// (contracts/checks/launch-weekend/f24/_meta.mjs sweepRoutes + readMeta) and rules (_rules.mjs descProblems D1-D4), plus every ticket page:
// the union of _f4.mjs TICKET_SLUGS, every active Sanity ticket type (_ticket-slugs.mjs) and every /tickets/<slug> the hub links to.
//   Rules:      every swept route's description passes D1-D4 (70-160 chars, or a sentence-cut of its own lede at <=155, never mid-word).
//   Unique:     no two swept routes share a description (F24 only noted duplicates; r12 fails them).
//   Targets:    the five SAOC targets and every ticket page carry a description other than the site default, found in their own <main> text;
//               a ticket's description is its hero standfirst or a sentence-cut of it. /societies stays at the default (no source).
//   Titles:     SAOC targets keep their 26fde668 title; a ticket's title is "<its h1> — National Orchid Show | SAOC"; the three R64 routes read
//               "<h1> — National Orchid Show | SAOC"; every other NOS inner route's title head equals its h1 unless _f4.mjs lists it as a reported
//               wording mismatch (Codi R64).
//   Unchanged:  each target's canonical and hero text equal goldens/f4-baseline.json (captured by @architect on 26fde668; `--capture` prints it).
//   Symposium:  /national-show/symposium's description equals ellipsisCut() (F24 _rules.mjs) of its first rendered lede longer than 154 chars, and
//               F24 D1-D4 accept it only through the single-route ELLIPSIS_EXCEPTIONS entry (lead ruling 2026-10-18, Codi R7).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { finish, golden, repoRoot } from './_lib.mjs';
import { assertFreshBuild, require, startServer } from './_server.mjs';
import { CASING, DEFAULT_DESCRIPTION, LEFT_AT_DEFAULT, NOS_SUFFIX, SAOC_TARGETS, SYMPOSIUM, TICKET_SLUGS, WORDING_MISMATCH_REPORTED } from './_f4.mjs';
import { resolvableTicketSlugs } from './_ticket-slugs.mjs';

const { chromium } = require('playwright');
const NAME = 'f4-rendered.mjs';
const CAPTURE = process.argv.includes('--capture');
const F24 = path.join(repoRoot, 'contracts/checks/launch-weekend/f24');
const { sweepRoutes, readMeta } = await import(pathToFileURL(path.join(F24, '_meta.mjs')).href);
const { descProblems, ellipsisCut, ELLIPSIS_EXCEPTIONS, isLedeCut } = await import(pathToFileURL(path.join(F24, '_rules.mjs')).href);
const norm = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
const failures = [];
const got = {};
let tickets = [];

let browser;
let srv;
try {
  const sourceFiles = [...new Set(['f1', 'f2', 'f3', 'f4'].flatMap((f) => JSON.parse(golden(`${f}-footprint.json`))))].filter((rel) => existsSync(path.join(repoRoot, rel)));
  if (!process.env.NOS_CR12_ORIGIN) {
    const stale = assertFreshBuild(sourceFiles);
    if (stale.length > 0) finish(NAME, stale);
  }
  const fromSanity = await resolvableTicketSlugs();
  srv = process.env.NOS_CR12_ORIGIN ? { origin: process.env.NOS_CR12_ORIGIN, stop: () => {} } : await startServer({ publicMode: true });
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${srv.origin}/national-show/tickets`, { waitUntil: 'networkidle' });
  const linked = await page.evaluate(() => [...document.querySelectorAll('a[href^="/tickets/"]')].map((a) => a.getAttribute('href').split(/[?#]/)[0].replace(/^\/tickets\//, '')));
  tickets = [...new Set([...TICKET_SLUGS, ...fromSanity, ...linked.filter((s) => /^[a-z0-9-]+$/.test(s))])].sort().map((s) => `/tickets/${s}`);
  for (const { route, optional } of [...sweepRoutes(), ...tickets.map((route) => ({ route, optional: false }))]) {
    const m = await readMeta(page, route, srv.origin);
    if (m.status !== 200) { if (!optional) failures.push(`${route}: HTTP ${m.status}`); continue; }
    // readMeta reads at DOMContentLoaded; a streamed page (tickets/[slug]/loading.tsx) may still show its skeleton then, so settle first and
    // re-read the lede with readMeta's own selector before the rules run.
    await page.waitForLoadState('networkidle');
    const extra = await page.evaluate(() => {
      const lede = [...document.querySelectorAll('[data-page-hero] p, .nos-hero p, main p')].map((p) => p.textContent.replace(/\s+/g, ' ').trim()).filter((t) => t.length >= 20).slice(0, 3);
      const hero = document.querySelector('[data-page-hero], .nos-hero');
      const standfirst = document.querySelector('.nos-hero p');
      const canonical = document.querySelector('link[rel="canonical"]');
      const main = document.querySelector('main');
      const h1 = document.querySelector('h1');
      return { lede, title: document.title, h1: h1 ? h1.textContent : '', standfirst: standfirst ? standfirst.textContent : '', canonical: canonical ? canonical.getAttribute('href') : null, hero: hero ? hero.textContent : '', main: main ? main.textContent : '' };
    });
    got[route] = { ...m, ...extra, h1: norm(extra.h1), standfirst: norm(extra.standfirst), hero: norm(extra.hero), main: norm(extra.main) };
  }
  await ctx.close();
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  if (srv) await srv.stop();
  if (browser) await browser.close();
}

const targets = [...SAOC_TARGETS.map((t) => t.route), ...tickets];
const recorded = [...targets, ...CASING.map((c) => c.route), ...LEFT_AT_DEFAULT.map((t) => t.route), SYMPOSIUM.route];
if (CAPTURE) {
  if (failures.length) finish(NAME, failures);
  const out = Object.fromEntries(recorded.filter((r) => got[r]).map((r) => [r, { title: got[r].title, h1: got[r].h1, canonical: got[r].canonical, hero: got[r].hero, description: got[r].description }]));
  process.stdout.write(`${JSON.stringify({ recorded: 'from the 26fde668 build (next start, public mode); title, h1 and description are the BASE values, for the record', routes: out }, null, 1)}\n`);
  process.exit(0);
}
const baseline = JSON.parse(golden('f4-baseline.json')).routes;

const byDesc = new Map();
for (const [route, m] of Object.entries(got)) {
  for (const [id, msg] of descProblems(m.description, m.lede, route)) failures.push(`${route}: [${id}] ${msg}`);
  if (m.description) byDesc.set(norm(m.description), [...(byDesc.get(norm(m.description)) ?? []), route]);
}
for (const [d, rs] of byDesc) if (rs.length > 1) failures.push(`${rs.length} routes share one description (${rs.join(', ')}): "${d.slice(0, 60)}"`);

for (const route of targets) {
  const m = got[route];
  if (!m) { failures.push(`${route}: not measured`); continue; }
  const d = norm(m.description);
  if (!d || d === DEFAULT_DESCRIPTION) failures.push(`${route}: still carries the site default description`);
  else if (!m.main.includes(d)) failures.push(`${route}: description "${d.slice(0, 60)}" is not text of the page's own <main> (provenance)`);
  const isTicket = route.startsWith('/tickets/');
  if (isTicket) {
    if (!m.standfirst) failures.push(`${route}: no hero standfirst`);
    else if (d !== m.standfirst && !isLedeCut(d, m.standfirst)) failures.push(`${route}: description "${d.slice(0, 60)}" is neither the standfirst nor a sentence-cut of it`);
    if (m.title !== `${m.h1}${NOS_SUFFIX}`) failures.push(`${route}: title "${m.title}", want "${m.h1}${NOS_SUFFIX}" (NOS ticket)`);
  }
  const b = baseline[route];
  if (!b) { failures.push(`${route}: no baseline`); continue; }
  if (!isTicket && m.title !== b.title) failures.push(`${route}: title "${m.title}", baseline "${b.title}"`);
  if (m.canonical !== b.canonical) failures.push(`${route}: canonical ${m.canonical}, baseline ${b.canonical}`);
  if (m.hero !== b.hero) failures.push(`${route}: hero text changed: "${m.hero.slice(0, 80)}", baseline "${b.hero.slice(0, 80)}"`);
}
for (const c of CASING) {
  const m = got[c.route];
  if (!m) { failures.push(`${c.route}: not measured`); continue; }
  if (m.h1 !== c.to || m.title !== `${c.to}${NOS_SUFFIX}`) failures.push(`${c.route}: title "${m.title}" / h1 "${m.h1}", want "${c.to}${NOS_SUFFIX}" under h1 "${c.to}" (Codi R64)`);
}
for (const [route, m] of Object.entries(got)) {
  if (!route.startsWith('/national-show/') || WORDING_MISMATCH_REPORTED.includes(route) || !m.title.endsWith(NOS_SUFFIX)) continue;
  const head = m.title.slice(0, -NOS_SUFFIX.length);
  if (head !== m.h1) failures.push(`${route}: title head "${head}" differs from its h1 "${m.h1}" (Codi R64)`);
}
for (const { route } of LEFT_AT_DEFAULT) if (got[route] && norm(got[route].description) !== DEFAULT_DESCRIPTION) failures.push(`${route}: left at default (no source), but carries "${norm(got[route].description).slice(0, 60)}"`);
if (ELLIPSIS_EXCEPTIONS.length !== 1 || ELLIPSIS_EXCEPTIONS[0] !== SYMPOSIUM.route) failures.push(`F24 ELLIPSIS_EXCEPTIONS is ${JSON.stringify(ELLIPSIS_EXCEPTIONS)}, want exactly ["${SYMPOSIUM.route}"]`);
{
  const m = got[SYMPOSIUM.route];
  const source = m && m.lede.find((l) => l.length > 154);
  const want = source ? ellipsisCut(source) : null;
  if (!m) failures.push(`${SYMPOSIUM.route}: not measured`);
  else if (!want) failures.push(`${SYMPOSIUM.route}: no rendered lede longer than 154 chars to cut (the exception lapses; f4-spec.md)`);
  else if (norm(m.description) !== want) failures.push(`${SYMPOSIUM.route}: description "${norm(m.description)}", want the word-boundary cut "${want}"`);
}

finish(NAME, failures, `${Object.keys(got).length} swept routes pass F24 D1-D4 with unique descriptions; the five SAOC targets and ${tickets.length} ticket pages carry their own page text; tickets wear the NOS title; NOS titles follow their h1 (R64).`);
