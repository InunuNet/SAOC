#!/usr/bin/env node
// A1: copy. The standfirst reads "2027 National Orchid Show" (and the metadata description that restates it), the Joint
// clause is gone from the conference card and from the whole route, the FROM block and the public test-mode strip are gone,
// and NO other copy changed: every visible text node on /national-show/tickets is in the origin/main golden, in the ruled
// additions, a price (R + digits), or CMS data read live (ticketType names, the ticketsPage buy label). Run with the CMS
// read-only query (never a mutation).
// Usage: node --import tsx/esm contracts/checks/launch-weekend/f16/check-a-copy.mjs   (cwd = implementation worktree)
import { readFileSync } from 'node:fs';
import { VIEWPORTS, HUB, launch, newPage, openPath, loadGolden, readCms, report, TEXT_NODES_SRC } from './_lib.mjs';

const copy = loadGolden('copy.json');
const base = new Set(loadGolden('copy-base.json').nodes);
const problems = [];
const cms = await readCms();
const cmsStrings = new Set([...cms.types.map((t) => t.name), cms.page.buyButtonLabel, cms.page.soldOutMessage, cms.page.salesClosedMessage].filter(Boolean));
const allowed = new Set([...base, ...copy.addedAllowed, copy.lede, copy.conferenceBody, ...cmsStrings]);
for (const r of copy.removedNodes) allowed.delete(r);
allowed.delete(copy.conferenceBodyBefore);
allowed.delete('Early-bird pricing ends');

const browser = await launch();
for (const vp of [VIEWPORTS[1], VIEWPORTS[0]]) {
  const { ctx, page } = await newPage(browser, vp);
  await openPath(page, HUB);
  const nodes = await page.evaluate(TEXT_NODES_SRC);
  const tag = `@${vp.name}`;
  if (!nodes.includes(copy.lede)) problems.push(`${tag}: standfirst is not exactly "${copy.lede}"`);
  if (!nodes.includes(copy.conferenceBody)) problems.push(`${tag}: conference card body is not exactly "${copy.conferenceBody}"`);
  for (const k of copy.keptVerbatim) if (!nodes.includes(k)) problems.push(`${tag}: existing copy missing or changed: "${k}"`);
  for (const r of copy.removedNodes) if (nodes.includes(r)) problems.push(`${tag}: removed copy still renders: "${r}"`);
  for (const n of nodes) {
    if (/\bJoint\b|SAOC National Show/i.test(n)) problems.push(`${tag}: forbidden wording renders: "${n}"`);
    const sr = /^— (.+)$/.exec(n); // the visually hidden suffix that names the row on its buy action
    if (sr && cmsStrings.has(sr[1])) continue;
    if (allowed.has(n) || /^R\d[\d.,]*$/.test(n) || /^Early-bird pricing ends \d{1,2} [A-Za-z]+\.$/.test(n)) continue;
    problems.push(`${tag}: new or changed copy not in the ruling: "${n}"`);
  }
  if (vp.name === '1280') {
    const meta = await page.locator('meta[name="description"]').getAttribute('content');
    if (meta !== copy.metadataDescription) problems.push(`meta description is "${meta}", want the restated lede`);
  }
  await ctx.close();
}
await browser.close();

const src = readFileSync('app/(marketing)/national-show/tickets/page.tsx', 'utf8');
if (/Joint/.test(src)) problems.push('tickets/page.tsx still mentions Joint');
if (/SAOC National Show/.test(src)) problems.push('tickets/page.tsx still says "SAOC National Show"');
report(problems, 'standfirst and conference card re-worded, no other copy changed, Joint and FROM gone');
