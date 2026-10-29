// Golden generator (not a gate): element crops of every U+2192 / U+203B site (text arrows, status markers, svg[data-glyph]) at 1440 and 390 on the ten routes, for NOS Design's before/after review.
// Usage: node capture-glyph-crops.mjs <outDir> (before: run on main, after: run on the branch). Up to 3 crops per route and width, 12px padding.
import { mkdirSync } from 'node:fs';
import { withSite, tenRoutes } from './lib.mjs';
const out = process.argv[2]; if (!out) throw new Error('usage: capture-glyph-crops.mjs <outDir>'); mkdirSync(out, { recursive: true });
const MARK = `() => { document.querySelectorAll('[data-crop]').forEach((e) => e.removeAttribute('data-crop')); const hit = new Set();
  document.querySelectorAll('[data-exhibitor-marker], [data-confirmation-badge], svg[data-glyph]').forEach((e) => hit.add(e.closest('[data-exhibitor-marker], [data-confirmation-badge]') || e.parentElement));
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[\\u2192\\u203B]/.test(n.textContent) && n.parentElement.getBoundingClientRect().width > 0) hit.add(n.parentElement);
  const els = [...hit].filter((e) => e && e.getBoundingClientRect().width > 0).slice(0, 3); els.forEach((e, i) => e.setAttribute('data-crop', String(i))); return els.length; }`;
await withSite(async (site) => {
  const { base, browser, ctxOpts } = site;
  for (const width of [1440, 390]) for (const path of tenRoutes(site)) {
    const ctx = await browser.newContext(ctxOpts({ width, height: 900 }, 2)); const page = await ctx.newPage(); await page.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 }); await page.waitForTimeout(400);
    const n = await page.evaluate(`(${MARK})()`);
    for (let i = 0; i < n; i++) { const el = page.locator(`[data-crop="${i}"]`); await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox(); if (!b) continue;
      await page.screenshot({ path: `${out}/${(path === '/' ? 'home' : path.slice(1)).replace(/\//g, '-')}-${width}-${i}.png`, clip: { x: Math.max(0, b.x - 12), y: Math.max(0, b.y - 12), width: b.width + 24, height: b.height + 24 }, fullPage: true }); }
    await ctx.close();
  }
});
