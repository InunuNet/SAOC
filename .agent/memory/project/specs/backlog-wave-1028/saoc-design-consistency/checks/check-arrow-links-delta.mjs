// F1e guard (NOS Design ruling, arrow SVG): swapping the text arrow for the SVG must not move anything. For the 24 arrow links on /societies, /judging and Home (Full calendar, WOSA, 21 society cards) at 1440, 390 and 2056,
// link height and the label text's top (relative to the link) equal the F1d baseline (goldens/arrow-links-f1d-7ee06e9a.json, measured on 7ee06e9a) exactly: delta 0.00, tolerance 0.01 px.
// Same links in the same order with the same labels, so nothing was dropped or reflowed. Needs DC_PROD=1 (Home) or DC_BASE_URL.
import { readFileSync } from 'node:fs';
import { withSite, openPage, check, finish } from './lib.mjs';
import { ARROW_ROUTES, ARROW_WIDTHS, ARROW_PROBE } from './lib-arrow-links.mjs';
const base0 = JSON.parse(readFileSync(process.env.DC_ARROW_BASELINE || '.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/goldens/arrow-links-f1d-7ee06e9a.json', 'utf8')).links; const TOL = 0.01;
await withSite(async ({ base, browser, ctxOpts, prod, live }) => {
  if (!prod && !live) { console.error('INCONCLUSIVE: Home needs a production build (DC_PROD=1) or a deployed DC_BASE_URL'); process.exit(2); }
  for (const width of ARROW_WIDTHS) for (const path of ARROW_ROUTES) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, path, width, 900); const now = await page.evaluate(`(${ARROW_PROBE})()`); const was = base0[`${path}@${width}`]; const w = `${path}@${width}`;
    check(now.length === was.length, `${w}: ${now.length} arrow links, baseline has ${was.length}`);
    for (let i = 0; i < Math.min(now.length, was.length); i++) {
      const a = now[i]; const b = was[i]; const tag = `${w} #${i} "${b.label.slice(0, 28)}"`;
      check(a.label === b.label, `${tag}: label is now "${a.label.slice(0, 28)}"`);
      check(a.titleLines === b.titleLines, `${tag}: title wraps to ${a.titleLines} line(s), F1d has ${b.titleLines} (no title may gain a line)`);
      check(Math.abs(a.h - b.h) <= TOL, `${tag}: link height ${a.h.toFixed(2)} vs F1d ${b.h.toFixed(2)} (delta ${(a.h - b.h).toFixed(2)}), want 0.00 +-${TOL}`);
      check(a.textTop !== null && b.textTop !== null && Math.abs(a.textTop - b.textTop) <= TOL, `${tag}: label text top ${a.textTop && a.textTop.toFixed(2)} vs F1d ${b.textTop && b.textTop.toFixed(2)}, want delta 0.00 +-${TOL}`);
    }
    await ctx.close();
  }
});
finish('arrow-links-delta');
