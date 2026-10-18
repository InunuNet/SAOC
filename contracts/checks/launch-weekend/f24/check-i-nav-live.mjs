#!/usr/bin/env node
// F24-A14 (live, PUBLIC build, PUBLIC_URL): the rendered nav (mega menu and mobile drawer ship in the HTML) carries the voted vendors
// descriptor and no descriptor that says "gated" on home, the tickets page and /about.
// Usage: PUBLIC_URL=http://localhost:3624 node contracts/checks/launch-weekend/f24/check-i-nav-live.mjs
import { PUBLIC_BASE, VIEWPORTS, launch, newPage, report, loadGolden } from './_meta.mjs';

const V = loadGolden('copy-deletions.json').V1;
const problems = [];
const browser = await launch();
const { ctx, page } = await newPage(browser, VIEWPORTS[1]);
for (const r of ['/', '/national-show/tickets', '/about']) {
  const res = await page.goto(`${PUBLIC_BASE}${r}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e) => { console.error(`INFRA: ${e.message}`); process.exit(2); });
  if (!res || res.status() >= 400) { console.error(`INFRA: HTTP ${res ? res.status() : 'none'} for ${r}`); process.exit(2); }
  const html = await page.content();
  if (/application and gated/i.test(html)) problems.push(`${r}: the nav still says "application and gated registration"`);
  const gated = await page.evaluate(() => [...document.querySelectorAll('header *, nav *')].filter((e) => !e.children.length && /\bgated\b/i.test(e.textContent)).map((e) => e.textContent.trim().slice(0, 60)));
  gated.forEach((t) => problems.push(`${r}: nav text still says "gated": "${t}"`));
  if (r === '/national-show/tickets' && !html.includes(V.new)) problems.push(`${r}: the voted descriptor "${V.new}" is not rendered`);
}
await ctx.close(); await browser.close();
report(problems, 'the public nav carries the voted vendors descriptor and no "gated" descriptor');
