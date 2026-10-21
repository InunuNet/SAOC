// nos-critique-r13 f1 rendered (production build, next start 3010-3019, PUBLIC mode as launch-weekend F24-A2). QA input, hash-locked.
// Reuses F24's sweep (contracts/checks/launch-weekend/f24/_meta.mjs sweepRoutes + readMeta) and title rules (_rules.mjs titleProblems T1-T6), plus
// _r13.mjs EXTRA_ROUTES, and extends r12 f4's R64 title assertion from casing to wording:
//   Rule:        every swept route's title is "<its rendered h1><template suffix>" (NOS inner: " — National Orchid Show | SAOC"; every other route,
//                the NOS hub included: " | South African Orchid Council"), unless _r13.mjs EXCEPTIONS lists it with a cited reason.
//   Exceptions:  each listed route keeps its exact BASE title, and every listed route must be measured (no stale entries).
//   Edits:       the five EDITS routes still render the audited h1 (a CMS change to it is reported, not silently followed).
//   F24:         T1-T6 hold on every route, and the rendered titles equal the worktree's F24-A2 titles.json (as superseded by r13).
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { FEATURES, finish, golden, repoRoot, specDir } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';
import { EDITS, EXCEPTIONS, EXTRA_ROUTES, TITLES_JSON, suffixFor } from './_r13.mjs';

const { chromium } = require('playwright');
const NAME = 'f1-rendered.mjs';
const F24 = path.join(repoRoot, 'contracts/checks/launch-weekend/f24');
const { sweepRoutes, readMeta } = await import(pathToFileURL(path.join(F24, '_meta.mjs')).href);
const { titleProblems } = await import(pathToFileURL(path.join(F24, '_rules.mjs')).href);
const norm = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
const failures = [];
const got = {};

let browser;
let srv;
try {
  const sourceFiles = [...new Set(FEATURES.filter((n) => existsSync(path.join(specDir, 'goldens', `f${n}-footprint.json`))).flatMap((n) => JSON.parse(golden(`f${n}-footprint.json`))))].filter((rel) => existsSync(path.join(repoRoot, rel)));
  if (!process.env.NOS_CR13_ORIGIN) {
    const stale = assertFreshBuild(sourceFiles.filter((rel) => rel.startsWith('app/')));
    if (stale.length > 0) finish(NAME, stale);
  }
  srv = process.env.NOS_CR13_ORIGIN ? { origin: process.env.NOS_CR13_ORIGIN, stop: () => {} } : await startServer({ publicMode: true });
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
  const page = await ctx.newPage();
  const routes = [...sweepRoutes(), ...EXTRA_ROUTES.map((route) => ({ route, optional: false }))];
  for (const { route, optional } of routes) {
    const m = await readMeta(page, route, srv.origin);
    if (m.status !== 200) { if (!optional) failures.push(`${route}: HTTP ${m.status}`); continue; }
    got[route] = { title: norm(m.title), h1: norm(m.h1) };
  }
  await ctx.close();
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  if (srv) await srv.stop();
  if (browser) await browser.close();
}

const exc = new Map(EXCEPTIONS.map((e) => [e.route, e]));
for (const [route, m] of Object.entries(got)) {
  for (const [id, msg] of titleProblems(route, m.title, m.h1)) failures.push(`${route}: F24 [${id}] ${msg}`);
  const e = exc.get(route);
  if (e) {
    if (m.title !== e.title) failures.push(`${route}: listed exception (${e.reason}) must keep "${e.title}", got "${m.title}"`);
    continue;
  }
  if (!m.h1) { failures.push(`${route}: no h1 to take the title from`); continue; }
  const want = `${m.h1}${suffixFor(route)}`;
  if (m.title !== want) failures.push(`${route}: title "${m.title}", want "${want}" (its h1 "${m.h1}", Codi R64)`);
}
for (const e of EXCEPTIONS) if (!got[e.route]) failures.push(`${e.route}: listed exception was not measured (stale entry?)`);
for (const e of EDITS) if (got[e.route] && got[e.route].h1 !== e.h1) failures.push(`${e.route}: h1 is now "${got[e.route].h1}", audited "${e.h1}"; the edit table needs review`);
const titlesJson = path.join(repoRoot, TITLES_JSON);
if (!existsSync(titlesJson)) failures.push(`${TITLES_JSON} is missing`);
else for (const [route, want] of Object.entries(JSON.parse(readFileSync(titlesJson, 'utf8')).expected)) {
  if (got[route] && got[route].title !== want) failures.push(`${route}: title "${got[route].title}" differs from F24-A2 titles.json "${want}"`);
}

finish(NAME, failures, `${Object.keys(got).length} public routes: every title is its h1 plus the template suffix, bar ${EXCEPTIONS.length} cited exceptions; F24 T1-T6 and titles.json hold.`);
