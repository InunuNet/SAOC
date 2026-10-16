#!/usr/bin/env node
// Diagnostic (not a gate): list every axe violation node per route so a dev can see exactly what to fix.
// Usage: BASE_URL=http://localhost:3019 node contracts/checks/launch-weekend/f7/probe-axe-nodes.mjs [route ...]
import { BASE, withBrowser, open, runAxe } from './_lib.mjs';

const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/societies', '/national-show'];
const mobile = process.env.VIEWPORT === 'mobile';
await withBrowser(async (ctx) => {
  const page = await ctx.newPage();
  for (const r of routes) {
    await open(page, r);
    const v = await runAxe(page);
    console.log(`\n== ${BASE}${r}`);
    for (const x of v) for (const n of x.nodes) console.log(`${x.impact}\t${x.id}\t${n.target}\t${n.summary.slice(0, 140)}`);
  }
}, mobile ? { width: 390, height: 844 } : undefined, mobile ? { isMobile: true, hasTouch: true } : {});
