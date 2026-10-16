#!/usr/bin/env node
// F19-A5 (R79 #4): the yearbook band's meta and actions sit straight under the copy. At 1280 (two columns) and 390 (stacked):
// the meta block starts exactly 32px under the copy paragraph (data-yearbook-copy), the action row follows the meta at 16-32px, the
// copy column is top-aligned with the photo, and the PHOTO carries the row height (copy column no taller than the photo, nothing
// stretched with justify-between). F14's "last CTA bottom on the photo bottom" clause is superseded by this (supersession.json).
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-e-yearbook.mjs
import { VIEWPORTS, launch, newPage, open, report, loadGolden } from './_lib.mjs';

const T = loadGolden('tokens.json').yearbook;
const problems = [];
const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await open(page, '/');
  const m = await page.evaluate(() => {
    const yb = document.querySelector('[data-home-section="yearbook"]');
    const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, b: r.bottom + scrollY, w: r.width, h: r.height }; };
    const ctas = [...yb.querySelectorAll('[data-yearbook-cta]')].map(R);
    return { copy: R(yb.querySelector('[data-yearbook-copy]')), meta: R(yb.querySelector('[data-yearbook-meta]')), content: R(yb.querySelector('[data-yearbook-content]')), img: R(yb.querySelector('[data-yearbook-image]')),
      eyebrow: R(yb.querySelector('.eyebrow')), ctas, grid: getComputedStyle(yb.querySelector('[data-yearbook-content]')).justifyContent };
  });
  if (!m.copy) { problems.push(`${vp.name}: no [data-yearbook-copy] hook on the copy paragraph`); await ctx.close(); continue; }
  const near = (a, b, t) => Math.abs(a - b) <= t;
  if (!near(m.meta.y - m.copy.b, T.gapPx, 1)) problems.push(`${vp.name}: meta starts ${Math.round(m.meta.y - m.copy.b)}px under the copy, want ${T.gapPx}px`);
  const ctaTop = Math.min(...m.ctas.map((c) => c.y));
  const gap2 = ctaTop - m.meta.b;
  if (gap2 < T.actionsGapPx[0] - 1 || gap2 > T.actionsGapPx[1] + 1) problems.push(`${vp.name}: actions start ${Math.round(gap2)}px under the meta, want ${T.actionsGapPx.join('-')}px`);
  if (m.grid === 'space-between') problems.push(`${vp.name}: the copy column still uses justify-content: space-between`);
  if (vp.width >= T.twoColFrom) {
    if (!near(m.eyebrow.y, m.img.y, 2)) problems.push(`${vp.name}: copy column top ${Math.round(m.eyebrow.y)} is not on the photo top ${Math.round(m.img.y)}`);
    if (m.content.h > m.img.h + 1) problems.push(`${vp.name}: copy column (${Math.round(m.content.h)}px) is taller than the photo (${Math.round(m.img.h)}px): the image must carry the height`);
    const last = Math.max(...m.ctas.map((c) => c.b));
    if (last > m.img.b + 1) problems.push(`${vp.name}: actions end below the photo`);
  }
  await ctx.close();
}
await browser.close();
report(problems, `yearbook meta is ${T.gapPx}px under the copy, actions follow, copy top-aligned to a photo that carries the height`);
