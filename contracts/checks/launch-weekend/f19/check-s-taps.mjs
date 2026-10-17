#!/usr/bin/env node
// F19-A25: SAOC tap targets at 390. In the SAOC footer on home, about, contact and events every link, button and input is >= 44 x 44 CSS px
// (footer links are 24px tall and the newsletter input and button 36-38px today). The SAOC footer only: the NOS footer, UtilityBar and the
// headers are other sessions' files.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-s-taps.mjs
import { VIEWPORTS, launch, newPage, open, report, loadGolden } from './_lib.mjs';

const T = loadGolden('tokens.json').tap;
const problems = [];
const browser = await launch();
const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
let n = 0;
for (const r of T.routes) {
  await open(page, r);
  const rows = await page.evaluate(() => [...document.querySelectorAll('footer a[href], footer button, footer input:not([type="hidden"])')].map((el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { k: el.tagName.toLowerCase() + ':' + ((el.textContent || '').trim().slice(0, 24) || el.getAttribute('aria-label') || el.getAttribute('type')), w: b.width, h: b.height, vis: b.width > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' }; }).filter((x) => x.vis));
  for (const x of rows) { n++; if (x.h < T.minPx - 0.5 || x.w < T.minPx - 0.5) problems.push(`${r}: footer ${x.k} is ${Math.round(x.w)}x${Math.round(x.h)}, want ${T.minPx}x${T.minPx}`); }
}
await ctx.close(); await browser.close();
if (n < 20) problems.push(`only ${n} footer controls found: detection is vacuous`);
report(problems, `${n} SAOC footer controls are at least ${T.minPx}x${T.minPx} at 390`);
