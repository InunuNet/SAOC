#!/usr/bin/env node
// F24-A2 (live, PUBLIC build, PUBLIC_URL): sweep every public route's <title> through the T1-T6 rules and pin the golden titles.
// Usage: PUBLIC_URL=http://localhost:3624 node contracts/checks/launch-weekend/f24/check-b-titles.mjs
import { PUBLIC_BASE, VIEWPORTS, launch, newPage, report, loadGolden, sweepRoutes, readMeta } from './_meta.mjs';
import { titleProblems } from './_rules.mjs';

const G = loadGolden('titles.json');
const problems = [];
const browser = await launch();
const { ctx, page } = await newPage(browser, VIEWPORTS[1]);
let seen = 0;
for (const { route, optional } of sweepRoutes()) {
  const m = await readMeta(page, route, PUBLIC_BASE);
  if (m.status !== 200) { if (!optional) problems.push(`${route}: HTTP ${m.status}`); continue; }
  seen++;
  for (const [id, msg] of titleProblems(route, m.title, route === '/national-show/faq' ? G.faqH1 : m.h1)) problems.push(`${route}: [${id}] ${msg}`);
  const want = G.expected[route];
  if (want && m.title !== want) problems.push(`${route}: title is "${m.title}", golden is "${want}"`);
  if (route === '/national-show/faq' && m.h1 !== G.faqH1) problems.push(`/national-show/faq: h1 is "${m.h1}", golden is "${G.faqH1}"`);
}
await ctx.close(); await browser.close();
report(problems, `${seen} public routes hold the F24 title rules and ${Object.keys(G.expected).length} golden titles`);
