// The ruled back arrow on the society page (data-direction="back") is classified separately from the baseline links (see below), not excluded.
// F1e guard (NOS Design ruling, arrow SVG): swapping the text arrow for the SVG must not move anything. For every arrow-bearing link on every ArrowIcon caller that renders on the fixture build
// (lib-arrow-links.mjs ARROW_TARGETS: Societies cards, Judging, Home, /events, an event page, a society page, Sponsors, the NOS tickets pages, NOS vendors, the search overlay) at 1440, 390 and 2056,
// link height and the label text's top (relative to the link) equal the F1d baseline (goldens/arrow-links-f1d-7ee06e9a.json, measured on 7ee06e9a) exactly: delta 0.00, tolerance 0.01 px, and no title
// gains a line (title line count <= baseline). Same links in the same order with the same labels. Targets that did not render at F1d, or rendered with no arrow link, are known gaps: listed (KNOWN GAP / NOT GUARDED), not asserted. Needs DC_PROD=1 (Home, NOS host) or DC_BASE_URL.
import { readFileSync } from 'node:fs';
import { withSite, check, finish } from './lib.mjs';
import { collectArrowLinks } from './lib-arrow-links.mjs';
const was = JSON.parse(readFileSync(process.env.DC_ARROW_BASELINE || '.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/goldens/arrow-links-f1d-7ee06e9a.json', 'utf8')).targets; const TOL = 0.01;
await withSite(async (site) => {
  if (!site.prod && !site.live) { console.error('INCONCLUSIVE: Home and the NOS host need a production build (DC_PROD=1) or a deployed DC_BASE_URL'); process.exit(2); }
  const now = await collectArrowLinks(site); let rows = 0; let backRows = 0;
  for (const [key, b] of Object.entries(was)) {
    if (b.gap) { console.log(`KNOWN GAP ${key}: ${b.gap}`); continue; }
    if (b.links.length === 0) { console.log(`NOT GUARDED ${key}: renders at F1d with no arrow link (fixtures carry no data for it)`); continue; }
    const nowAll = now[key]; const a = nowAll && !nowAll.gap ? { ...nowAll, links: nowAll.links.filter((l) => !l.back) } : nowAll;
    // The back arrow (ArrowIcon data-direction="back", "\u2190 All societies", NOS Design ruling (b)) did not exist as an arrow link at F1d (it was a text "\u2190", outside this baseline). It is EXPECTED on the society page and
    // classified separately here, never excluded: at least one, labelled "All societies", never wrapping its title. Anywhere else it is unexpected.
    if (nowAll && !nowAll.gap) { const back = nowAll.links.filter((l) => l.back);
      if (key.startsWith('saoc:/societies/[first]@')) { check(back.length >= 1, `${key}: no back arrow link (data-direction="back") for "\u2190 All societies"`); for (const l of back) { check(/^All societies$/i.test(l.label), `${key} back link label is "${l.label}", want "All societies"`); check(l.titleLines <= 1, `${key} back link wraps to ${l.titleLines} lines`); } backRows += back.length; }
      else check(back.length === 0, `${key}: unexpected back arrow link(s): ${back.map((l) => l.label).join(', ')}`); }
    check(!!a && !a.gap, `${key}: did not render now (${a && a.gap}), rendered at F1d`); if (!a || a.gap) continue;
    check(a.links.length === b.links.length, `${key}: ${a.links.length} arrow links, baseline has ${b.links.length}`);
    for (let i = 0; i < Math.min(a.links.length, b.links.length); i++) {
      const x = a.links[i]; const y = b.links[i]; const tag = `${key} #${i} "${y.label.slice(0, 28)}"`; rows++;
      check(x.label === y.label, `${tag}: label is now "${x.label.slice(0, 28)}"`);
      check(x.titleLines <= y.titleLines, `${tag}: title wraps to ${x.titleLines} line(s), F1d has ${y.titleLines} (no title may gain a line)`);
      check(Math.abs(x.h - y.h) <= TOL, `${tag}: link height ${x.h.toFixed(2)} vs F1d ${y.h.toFixed(2)} (delta ${(x.h - y.h).toFixed(2)}), want 0.00 +-${TOL}`);
      check(x.textTop !== null && y.textTop !== null && Math.abs(x.textTop - y.textTop) <= TOL, `${tag}: label text top ${x.textTop && x.textTop.toFixed(2)} vs F1d ${y.textTop && y.textTop.toFixed(2)}, want delta 0.00 +-${TOL}`);
    }
  }
  console.log(`compared ${rows} rows; back arrow links classified separately: ${backRows}`);
});
finish('arrow-links-delta');
