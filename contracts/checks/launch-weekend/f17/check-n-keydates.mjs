#!/usr/bin/env node
// F17-A20 (scope G2): the /national-show/exhibitors key-dates caption "Key dates for exhibitors" sits on ONE line and spans the table at 1280 and 1920 (measured with a Range over the caption text, distinct
// line tops, and the caption box width against the table width). ROOT CAUSE (traced, not the Tailwind max-sm:block utility the lead suspected, which only applies below 640px): nos-structure.css
// ".nos-theme [data-nos-keydates] :is(table, tbody) { display: block }" is deliberate (each row is its own card surface, the header row is screen-reader-only), and a <caption> inside a block <table>
// shrink-wraps to ~75px (3 lines). The table stays display:block, so the fix is on the caption (full-width block), not display:table. The card rows and the sr-only header are asserted unchanged.
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3662 node --import tsx/esm contracts/checks/launch-weekend/f17/check-n-keydates.mjs
import { main, openPage, withBrowser, T } from './_lib.mjs';

const K = T.keyDates;

function read(sel) {
  const table = document.querySelector(sel);
  if (!table) return { error: `no ${sel}` };
  const cap = table.querySelector('caption');
  if (!cap) return { error: 'the table has no <caption>' };
  const range = document.createRange();
  range.selectNodeContents(cap);
  const tops = new Set([...range.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top)));
  const cr = cap.getBoundingClientRect(); const tr = table.getBoundingClientRect();
  const head = table.querySelector('thead');
  const hr = head?.getBoundingClientRect();
  return {
    display: getComputedStyle(table).display,
    caption: cap.textContent.replace(/\s+/g, ' ').trim(),
    capLines: tops.size, capWidth: cr.width, tableWidth: tr.width,
    headVisible: !!hr && hr.width > 2 && hr.height > 2,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}

await main('F17-A20 key-dates caption', async (r) => {
  await withBrowser(async (browser) => {
    const widths = [...K.desktopViewports, [390, 844]];
    for (const [w, h] of widths) {
      const { ctx, page, status } = await openPage(browser, { width: w, height: h }, K.route);
      const tag = `${K.route} @${w}`;
      if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
      const m = await page.evaluate(read, K.tableSelector);
      if (m.error) { r.fail(`${tag}: ${m.error}`); await ctx.close(); continue; }
      if (m.overflow > 1) r.fail(`${tag}: horizontal overflow ${m.overflow}px`);
      if (w >= K.stackBelow) {
        if (m.display !== 'block') r.fail(`${tag}: the table must stay display:block (row cards), computes ${m.display}`);
        if (m.capLines > K.captionMaxLines) r.fail(`${tag}: the caption "${m.caption}" wraps onto ${m.capLines} lines (caption ${m.capWidth.toFixed(0)}px in a ${m.tableWidth.toFixed(0)}px table), want ${K.captionMaxLines}`);
        if (m.capWidth < m.tableWidth * 0.9) r.fail(`${tag}: the caption box is ${m.capWidth.toFixed(0)}px of a ${m.tableWidth.toFixed(0)}px table, want it to span the table`);
        if (m.headVisible) r.fail(`${tag}: the column header row must stay screen-reader-only (the rows are cards)`);
      } else {
        if (m.display !== 'block') r.fail(`${tag}: the stacked mobile layout changed (table display:${m.display}, want block below ${K.stackBelow}px)`);
        if (m.headVisible) r.fail(`${tag}: the column header row must stay screen-reader-only when stacked`);
      }
      await ctx.close();
    }
  });
});
