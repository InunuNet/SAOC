#!/usr/bin/env node
// F24-A3 (live, PUBLIC build, PUBLIC_URL): sweep every public route's meta description (and og:description) through D1-D4: 70-160 chars,
// or a sentence-cut of the page lede (<=155) when under 70; never over 160, never mid-word, never an ellipsis.
// Usage: PUBLIC_URL=http://localhost:3624 node contracts/checks/launch-weekend/f24/check-c-descriptions.mjs
import { PUBLIC_BASE, VIEWPORTS, launch, newPage, report, sweepRoutes, readMeta } from './_meta.mjs';
import { descProblems } from './_rules.mjs';

const problems = [];
const browser = await launch();
const { ctx, page } = await newPage(browser, VIEWPORTS[1]);
let seen = 0;
const byDesc = new Map();
for (const { route, optional } of sweepRoutes()) {
  const m = await readMeta(page, route, PUBLIC_BASE);
  if (m.status !== 200) { if (!optional) problems.push(`${route}: HTTP ${m.status}`); continue; }
  seen++;
  for (const [id, msg] of descProblems(m.description, m.lede)) problems.push(`${route}: [${id}] ${msg}`);
  if (m.ogDescription && m.description && m.ogDescription !== m.description) for (const [id, msg] of descProblems(m.ogDescription, m.lede)) problems.push(`${route}: og:description [${id}] ${msg}`);
  if (m.description) byDesc.set(m.description, [...(byDesc.get(m.description) || []), route]);
}
await ctx.close(); await browser.close();
for (const [d, routes] of byDesc) if (routes.length > 1) console.log(`NOTE: ${routes.length} routes share one description (${routes.join(', ')}): "${d.slice(0, 50)}..."`);
report(problems, `${seen} public routes hold a 70-160 char or sentence-cut-lede description`);
