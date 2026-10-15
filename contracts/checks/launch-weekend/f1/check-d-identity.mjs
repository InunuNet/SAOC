#!/usr/bin/env node
// A4 — visual identity outside target sizing. Per SAOC route at 390 and 1280: the set of type+colour
// signatures (family, size, weight, style, tracking, transform, colour, background) of text-bearing
// elements equals the golden captured from the untouched tree (no new colour or type, none lost), page
// height stays within the golden tolerance, and there is no horizontal scroll.
// Usage: BASE_URL=http://localhost:3002 node contracts/checks/launch-weekend/f1/check-d-identity.mjs
import { BASE, VIEWPORTS, SAOC_ROUTES, launch, newPage, open, loadGolden, resolveRoute, report, identityInPage } from './_lib.mjs';

const golden = loadGolden('identity-baseline.json');
const problems = [];
const browser = await launch();
for (const vp of VIEWPORTS) {
  for (const route of SAOC_ROUTES) {
    const key = `${vp.name} ${route}`;
    const base = golden.pages[key];
    if (!base) { problems.push(`${key}: no golden entry`); continue; }
    const { ctx, page } = await newPage(browser, vp);
    await open(page, resolveRoute(route, golden.societySlug));
    const now = await page.evaluate(identityInPage);
    const added = now.signatures.filter((s) => !base.signatures.includes(s));
    const lost = base.signatures.filter((s) => !now.signatures.includes(s));
    if (added.length) problems.push(`${key}: ${added.length} new type/colour signature(s), e.g. ${added[0]}`);
    if (lost.length) problems.push(`${key}: ${lost.length} signature(s) disappeared, e.g. ${lost[0]}`);
    const drift = Math.abs(now.scrollHeight - base.scrollHeight) / base.scrollHeight;
    if (drift > base.heightTolerance) problems.push(`${key}: page height ${base.scrollHeight} -> ${now.scrollHeight} (${(drift * 100).toFixed(1)}% > ${(base.heightTolerance * 100).toFixed(0)}%)`);
    if (now.scrollWidth > now.innerWidth) problems.push(`${key}: horizontal scroll (${now.scrollWidth} > ${now.innerWidth})`);
    await ctx.close();
  }
}
await browser.close();
report(problems, `type/colour identity and page geometry match the golden on ${SAOC_ROUTES.length} routes x ${VIEWPORTS.length} viewports at ${BASE}`);
