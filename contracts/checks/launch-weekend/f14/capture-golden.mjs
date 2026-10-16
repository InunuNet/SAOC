#!/usr/bin/env node
// Captures copy.json (every text node of the NavCards and ShowBand sections, countdown digits excluded) and
// other-sections.json (sha256 of every OTHER home section's normalised markup, captured under reduced motion so the
// hero carousel is static) from a server running the UNTOUCHED tree (origin/main, e9f7d4f9). Captures twice and refuses
// to write if the two passes differ (a flaky golden is worse than none).
// Re-capture only when origin/main legitimately changes another home section; never from the F14 implementation tree.
// Usage: BASE_URL=http://localhost:3614 node contracts/checks/launch-weekend/f14/capture-golden.mjs
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { GOLDEN_DIR, VIEWPORTS, launch, newPage, openHome } from './_lib.mjs';
import { EXTRACT_SRC } from './_sections.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const browser = await launch();
const passes = [];
for (let i = 0; i < 2; i++) {
  const { ctx, page } = await newPage(browser, VIEWPORTS[1], { reducedMotion: 'reduce' });
  await openHome(page);
  const x = await page.evaluate(EXTRACT_SRC);
  passes.push({ nav: x.nav, band: x.band, others: Object.fromEntries(Object.entries(x.others).map(([k, v]) => [k, sha(v)])) });
  await ctx.close();
}
await browser.close();
if (JSON.stringify(passes[0]) !== JSON.stringify(passes[1])) {
  const unstable = Object.keys(passes[0].others).filter((k) => passes[0].others[k] !== passes[1].others[k]);
  console.error(`UNSTABLE capture; differing sections: ${unstable.join(', ') || 'copy'}`);
  process.exit(1);
}
const head = execFileSync('git', ['-C', process.env.GOLDEN_SOURCE_DIR || '.', 'rev-parse', 'HEAD']).toString().trim();
const meta = { capturedFrom: process.env.BASE_URL || 'http://localhost:3614', head };
writeFileSync(`${GOLDEN_DIR}/copy.json`, JSON.stringify({ ...meta, nav: passes[0].nav, band: passes[0].band }, null, 2) + '\n');
writeFileSync(`${GOLDEN_DIR}/other-sections.json`, JSON.stringify({ ...meta, sections: passes[0].others }, null, 2) + '\n');
console.log(`captured ${passes[0].nav.length} nav texts, ${passes[0].band.length} band texts, ${Object.keys(passes[0].others).length} other sections @ ${head.slice(0, 8)}`);
