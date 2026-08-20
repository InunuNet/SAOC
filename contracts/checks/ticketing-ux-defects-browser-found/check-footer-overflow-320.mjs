// A3 — the site-wide footer (components/chrome/Footer.tsx) must not cause horizontal
// self-overflow at a 320px viewport. Same convention as
// contracts/checks/partners-cards/check-overflow-375.mjs (real Chromium, scrollWidth vs
// clientWidth) — a class-string grep cannot see a rendered, wrapped layout.
//
// THE DEFECT, MEASURED LIVE AGAINST THE RUNNING DEV SERVER at 320px on /tickets
// (the page named in the architect brief, though the footer is shared site-wide):
// footer scrollWidth=339 vs viewport clientWidth=320 (~19px overflow), causing
// page-wide horizontal scroll. Root cause isolated by measuring the two candidate
// elements inside the footer's bottom bar separately:
//   - the bottom bar's OUTER row already carries `flex-wrap` and correctly wraps onto a
//     second line (copyright text wraps to ~256px, its own content width).
//   - the INNER row of 5 legal links (`<div className="flex items-center gap-4">`,
//     Privacy/Terms/Refunds/Constitution/Media kit) has NO `flex-wrap` of its own —
//     measured scrollWidth=307px against only ~256px of available width inside the
//     footer's own `px-8` padding at a 320px viewport. Because that inner row refuses to
//     wrap internally, IT is the widest element in the footer and pushes the whole
//     footer (and, at this page, the whole document — bodyScrollWidth also measured at
//     339) wider than the viewport.
// The fix (this contract's F3) is a single additive `flex-wrap` on that inner links row,
// reusing the EXACT utility class the outer row already uses one level up in the same
// file — no new token, no new visual language, matching this project's "No invented
// brand assets" rule.
//
// Asserted at BOTH the <footer> element and `document.documentElement` (unlike
// partners-cards, which deliberately scopes to one section to dodge an unrelated,
// out-of-scope page-level bug elsewhere) — this project has no known unrelated
// page-level 320px overflow bug on /tickets today, so both scopes are expected to agree,
// and asserting both catches a fix that happens to shrink the FOOTER element's own box
// (e.g. by clipping) without actually stopping the page from scrolling horizontally.
//
// Run as: npx tsx contracts/checks/ticketing-ux-defects-browser-found/check-footer-overflow-320.mjs

import { chromium } from 'playwright';

const BASE_URL = process.env.TICKETING_UX_CHECK_BASE_URL ?? 'http://localhost:3002';
const failures = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
await page.goto(`${BASE_URL}/tickets`, { waitUntil: 'networkidle' });

const footer = page.locator('footer');
await footer.waitFor({ state: 'visible', timeout: 15_000 });

const measurements = await page.evaluate(() => {
  const footerEl = document.querySelector('footer');
  return {
    footerScrollWidth: footerEl.scrollWidth,
    footerClientWidth: footerEl.clientWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
  };
});

await browser.close();

console.log(JSON.stringify(measurements, null, 2));

if (measurements.footerScrollWidth > measurements.footerClientWidth) {
  failures.push(
    `footer overflows its own box at 320px: scrollWidth=${measurements.footerScrollWidth} > ` +
      `clientWidth=${measurements.footerClientWidth}`
  );
}
if (measurements.docScrollWidth > measurements.docClientWidth) {
  failures.push(
    `document overflows the 320px viewport (page-wide horizontal scroll): scrollWidth=` +
      `${measurements.docScrollWidth} > clientWidth=${measurements.docClientWidth}`
  );
}

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}
process.exit(0);
