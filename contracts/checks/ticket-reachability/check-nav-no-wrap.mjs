#!/usr/bin/env node
// Sweeps a set of viewport widths around the header's min-[1180px] desktop-nav
// breakpoint and asserts, at every width:
//   1. exactly one of {desktop <nav aria-label="Primary">, hamburger "Open
//      menu" button} is visible — no width band where neither is reachable
//      (that would be a worse regression than wrapping); and
//   2. when the desktop nav IS visible, its items sit on a single line.
//
// "Single line" is derived per-run from the nav itself, not a hardcoded
// pixel constant: every top-level nav child's bounding-box top must match
// the first child's top (within a sub-pixel tolerance). A wrapped nav has a
// second row whose top differs by roughly a full line-height; a single-line
// nav has all tops equal. This survives font-size/spacing tweaks a fix might
// make — it only breaks if the nav genuinely wraps.
//
// Usage: node check-nav-no-wrap.mjs [url] [width1,width2,...]

import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:3333/about';
const widths = (process.argv[3] || '1180,1194,1200,1220,1260,1280')
  .split(',')
  .map((w) => parseInt(w.trim(), 10));

const TOLERANCE_PX = 1; // sub-pixel layout jitter only

const browser = await chromium.launch();
const failures = [];

for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle' });

  const nav = page.locator('nav[aria-label="Primary"]');
  const hamburger = page.getByRole('button', { name: /open menu/i });

  const navVisible = await nav.isVisible().catch(() => false);
  const hamburgerVisible = await hamburger.isVisible().catch(() => false);

  if (navVisible === hamburgerVisible) {
    failures.push(
      `width=${width}: nav visible=${navVisible}, hamburger visible=${hamburgerVisible} — ` +
        (navVisible ? 'BOTH visible (no dead band, but check for overlap)' : 'NEITHER visible — dead band, no nav destination reachable'),
    );
    await page.close();
    continue;
  }

  if (navVisible) {
    const tops = await nav.evaluate((el) =>
      Array.from(el.children).map((child) => child.getBoundingClientRect().top),
    );
    const baseline = tops[0];
    const wrapped = tops.some((t) => Math.abs(t - baseline) > TOLERANCE_PX);
    if (wrapped) {
      failures.push(`width=${width}: nav WRAPPED — item tops=${JSON.stringify(tops)}`);
    }
  }

  await page.close();
}

await browser.close();

if (failures.length > 0) {
  console.error('nav wrap / dead-band failures:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`OK: no nav wrap and no dead band across widths [${widths.join(', ')}]`);
process.exit(0);
