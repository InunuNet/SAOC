#!/usr/bin/env node
// F17-A7 (F12-audit P2 #3, runtime): /national-show/symposium in PUBLIC mode (a SITE_PUBLIC_LAUNCH=true build, placeholders withheld, live Sanity read only).
// The content-gap block (the muted "To be confirmed by the show committee" note, its 1px rule and the empty left grid cell) does not render: no [data-nos-content-gap],
// no TBC label inside the content section (the presenters block keeps its own marker), every .nos-show-page-prose block has its heading (so no empty grid cell), the real theme section, the presenters (when any) and the hero stay.
// Other pages keep their gap blocks (programme and wosa-conference are measured and reported, never failed on their data).
// check-h-symposium-render.mts is the data-independent proof; this one proves the route is wired. At 1280 and 390, no horizontal overflow.
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3662 node --import tsx/esm contracts/checks/launch-weekend/f17/check-g-symposium.mjs
import { main, openPage, withBrowser, T } from './_lib.mjs';

function measure(gapSel) {
  const t = (e) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const blocks = [...document.querySelectorAll('.nos-show-page-prose')];
  return {
    gaps: document.querySelectorAll(gapSel).length,
    tbc: t(document.querySelector('[data-nos-content-state]') ?? document.body).includes('To be confirmed by the show committee'),
    blocks: blocks.map((b) => ({ key: b.getAttribute('data-section-key'), hasH2: Boolean(b.querySelector(':scope > h2')), gap: b.hasAttribute('data-nos-content-gap'), borderTop: getComputedStyle(b).borderTopWidth })),
    theme: Boolean(document.querySelector('[data-section-key="theme"] h2')),
    h1: t(document.querySelector('h1')),
    state: document.querySelector('[data-nos-content-state]')?.getAttribute('data-nos-content-state') ?? null,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}

await main('F17-A7 symposium public gap', async (r) => {
  await withBrowser(async (browser) => {
    for (const [w, h] of [[1280, 800], [390, 844]]) {
      const { ctx, page, status } = await openPage(browser, { width: w, height: h }, T.symposium.route);
      if (status !== 200) { r.fail(`${T.symposium.route}: HTTP ${status}`); await ctx.close(); continue; }
      const m = await page.evaluate(measure, T.symposium.gapSelector);
      const tag = `${T.symposium.route} @${w}`;
      if (m.gaps) r.fail(`${tag}: ${m.gaps} content-gap block(s) render in public mode`);
      if (m.tbc) r.fail(`${tag}: the "To be confirmed by the show committee" note renders in public mode`);
      for (const b of m.blocks) if (!b.hasH2) r.fail(`${tag}: prose block "${b.key}" has no heading, which leaves an empty left grid cell`);
      if (m.state !== 'published') r.fail(`${tag}: content state is ${m.state}, want published`);
      if (!m.theme) r.fail(`${tag}: the real "theme" section (with its heading) is gone`);
      if (m.overflowX > 1) r.fail(`${tag}: horizontal overflow ${m.overflowX}px`);
      await ctx.close();
    }
    for (const route of ['/national-show/programme', '/national-show/wosa-conference']) {
      const { ctx, page, status } = await openPage(browser, { width: 1280, height: 800 }, route);
      if (status !== 200) { r.fail(`${route}: HTTP ${status}`); await ctx.close(); continue; }
      const m = await page.evaluate(measure, T.symposium.gapSelector);
      console.log(`NOTE: ${route} renders ${m.gaps} content-gap block(s) (unchanged by F17: the hide is symposium-only)`);
      await ctx.close();
    }
  });
});
