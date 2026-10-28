// Golden generator (not a gate): writes the arrow-link baseline JSON from whatever build it runs against. The committed baseline is from the F1d build at 7ee06e9a (text arrows).
// Usage: DC_PROD=1 node measure-arrow-links.mjs <out.json>   (cwd = the build's worktree)
import { writeFileSync } from 'node:fs';
import { withSite, openPage } from './lib.mjs';
import { ARROW_ROUTES, ARROW_WIDTHS, ARROW_PROBE } from './lib-arrow-links.mjs';
const out = process.argv[2]; if (!out) throw new Error('usage: measure-arrow-links.mjs <out.json>'); const data = {};
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of ARROW_WIDTHS) for (const path of ARROW_ROUTES) { const { page, ctx } = await openPage(browser, ctxOpts, base, path, width, 900); data[`${path}@${width}`] = await page.evaluate(`(${ARROW_PROBE})()`); await ctx.close(); }
});
writeFileSync(out, JSON.stringify({ source: 'F1d build 7ee06e9a (feat/sdc-f1d-lcp), DC_PROD=1 saoc.localhost, text arrows', links: data }, null, 1) + '\n');
console.log(Object.entries(data).map(([k, v]) => `${k}: ${v.length}`).join('  '), 'total', Object.values(data).reduce((a, v) => a + v.length, 0));
