import { chromium } from 'playwright';

// Exits 0 iff the "In collaboration with" partners <section> has no
// horizontal self-overflow at a 375px viewport (scrollWidth <= clientWidth).
// Deliberately scoped to the section element, NOT document.documentElement —
// ShowBand.tsx has a known, separate, out-of-scope page-level overflow bug
// that would otherwise make this assertion permanently red regardless of
// this feature's changes. See negative-control.golden.md.

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
await page.goto('http://localhost:3333/', { waitUntil: 'networkidle' });

const section = page.locator('section', { hasText: 'In collaboration with' }).first();
const scrollWidth = await section.evaluate((el) => el.scrollWidth);
const clientWidth = await section.evaluate((el) => el.clientWidth);
const bodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);

await browser.close();

console.log(JSON.stringify({ scrollWidth, clientWidth, bodyScrollWidth }));

if (scrollWidth > clientWidth) {
  console.error(`partners section overflows at 375px: scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`);
  process.exit(1);
}
process.exit(0);
