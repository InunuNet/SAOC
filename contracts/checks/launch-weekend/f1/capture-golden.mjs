#!/usr/bin/env node
// Captures the identity and motion baselines from a server running the UNTOUCHED tree (origin/main chrome).
// Run against a clean origin/main build; set GOLDEN_SOURCE_DIR to its worktree so the recorded SHA is that tree's.
// Re-capture only when origin/main legitimately changes SAOC content, never from the implementation tree.
// Usage: BASE_URL=http://localhost:3002 node contracts/checks/launch-weekend/f1/capture-golden.mjs
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BASE, GOLDEN_DIR, VIEWPORTS, SAOC_ROUTES, launch, newPage, open, resolveRoute, identityInPage, motionInPage } from './_lib.mjs';

const browser = await launch();
const probe = await newPage(browser, VIEWPORTS[1]);
await open(probe.page, '/societies');
const societySlug = (await probe.page.evaluate(() => document.querySelector('a[href^="/societies/"]')?.getAttribute('href') || '')).replace('/societies/', '');
await probe.ctx.close();
if (!societySlug) { console.error('no society link found on /societies'); process.exit(2); }

const identity = { societySlug, capturedFrom: BASE, capturedAt: new Date().toISOString(), head: execFileSync('git', ['-C', process.env.GOLDEN_SOURCE_DIR || '.', 'rev-parse', 'HEAD']).toString().trim(), pages: {} };
const motion = { capturedFrom: BASE, routes: {} };
for (const vp of VIEWPORTS) {
  for (const route of SAOC_ROUTES) {
    const { ctx, page } = await newPage(browser, vp);
    await open(page, resolveRoute(route, societySlug));
    identity.pages[`${vp.name} ${route}`] = await page.evaluate(identityInPage);
    await ctx.close();
  }
}
const vp = VIEWPORTS[1];
for (const route of ['/', '/societies', '/about', '/events', '/national-show', '/national-show/tickets']) {
  const { ctx, page } = await newPage(browser, vp, { reducedMotion: 'no-preference' });
  await open(page, route);
  motion.routes[route] = await page.evaluate(motionInPage);
  await ctx.close();
}
await browser.close();
// Height tolerance (fraction) allowed per page: target sizing may lengthen a page, nothing else may.
for (const [k, v] of Object.entries(identity.pages)) v.heightTolerance = k.startsWith('390') ? 0.08 : 0.05;
writeFileSync(`${GOLDEN_DIR}/identity-baseline.json`, JSON.stringify(identity, null, 2) + '\n');
writeFileSync(`${GOLDEN_DIR}/motion-baseline.json`, JSON.stringify(motion, null, 2) + '\n');
console.log(`captured ${Object.keys(identity.pages).length} identity pages, ${Object.keys(motion.routes).length} motion routes from ${BASE}`);
