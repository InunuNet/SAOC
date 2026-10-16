#!/usr/bin/env node
// Evidence for F18-A11: full-page screenshots of the 12 critique routes (goldens/f18/tokens.json critique.routes) at 1280 and 390 from a running public build.
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 AFTER_DIR=.tmp/sandbox/lw-f18/after node --import tsx/esm contracts/checks/launch-weekend/f18/capture-shots.mjs
import { mkdirSync } from 'node:fs';
import { main, openPage, withBrowser, T } from './_lib.mjs';

const AFTER = process.env.AFTER_DIR || '.tmp/sandbox/lw-f18/after';
await main('F18 capture shots', async (r) => {
  mkdirSync(AFTER, { recursive: true });
  await withBrowser(async (browser) => {
    for (const route of T.critique.routes) {
      for (const w of T.critique.viewports) {
        const { ctx, page, status } = await openPage(browser, { width: Number(w), height: w === '390' ? 844 : 800 }, route);
        if (status !== 200) { r.fail(`${route} @${w}: HTTP ${status}`); await ctx.close(); continue; }
        await page.screenshot({ path: `${AFTER}/${w}-${route.split('/').pop()}.png`, fullPage: true });
        await ctx.close();
      }
    }
  });
});
