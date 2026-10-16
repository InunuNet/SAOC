#!/usr/bin/env node
// Captures goldens/f19/copy-baseline.json from a build of UNTOUCHED main: the leaf-text set of <main> on every SAOC route at 1280.
// Usage: BASE_URL=http://localhost:3012 node contracts/checks/launch-weekend/f19/capture-copy-baseline.mjs
import { writeFileSync } from 'node:fs';
import { GOLDEN_DIR, launch, newPage, open } from './_lib.mjs';
import { SAOC_ROUTES, LEAF_TEXT_SRC } from './_routes.mjs';

const browser = await launch();
const { ctx, page } = await newPage(browser, { name: '1280', width: 1280, height: 900 });
const out = { head: process.env.BASE_HEAD || '76ad8b98', routes: {} };
for (const r of SAOC_ROUTES) { await open(page, r); out.routes[r] = await page.evaluate(LEAF_TEXT_SRC); }
await ctx.close(); await browser.close();
writeFileSync(`${GOLDEN_DIR}/copy-baseline.json`, JSON.stringify(out, null, 1) + '\n');
console.log(`captured ${Object.keys(out.routes).length} routes, ${Object.values(out.routes).reduce((n, a) => n + a.length, 0)} strings`);
