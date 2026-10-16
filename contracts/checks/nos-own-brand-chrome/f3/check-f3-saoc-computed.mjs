// F3-S2: SAOC routes are unchanged. Per element class (tag.className), the computed style (a fixed property list, box dimensions excluded) of every
// element on /, /societies, /about, /events and one society page (the shared StatusMarker/ConfirmationBadge render path) at 1280 and 390 must be one the golden goldens/f3/saoc-computed.json has recorded for that class. Counts and order are
// not compared: the home page's Sanity-driven lists change element counts between runs (329 vs 285 elements on / within minutes), and a style leak changes a
// class's style, not its count. Font-family names have their next/font
// build hash stripped. Failing classes are named so a leak (a NOS rule reaching a SAOC page) is findable.
//   verify : node --import tsx/esm contracts/checks/nos-own-brand-chrome/f3/check-f3-saoc-computed.mjs
//   capture: ... check-f3-saoc-computed.mjs --capture [--merge]   (--merge unions with the existing golden; capture from a tree whose SAOC-owned files equal base)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { F3_GOLDEN_DIR, VP_DESKTOP, VP_PHONE, main, openPage, withBrowser } from './_f3lib.mjs';

const GOLDEN = `${F3_GOLDEN_DIR}/saoc-computed.json`;
const ROUTES = ['/', '/societies', '/about', '/events', '/societies/border-orchid-society'];
const PROPS = ['display', 'position', 'color', 'background-color', 'background-image', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variation-settings', 'font-optical-sizing', 'line-height', 'letter-spacing', 'text-transform', 'text-decoration-line', 'text-align', 'opacity', 'visibility', 'overflow-x', 'margin-top', 'margin-bottom', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top-width', 'border-top-color', 'border-top-style', 'border-bottom-width', 'border-bottom-color', 'border-top-left-radius', 'box-shadow', 'flex-direction', 'justify-content', 'align-items', 'gap', 'max-width', 'z-index'];

function grab(props) {
  const fam = (s) => s.replace(/__([A-Za-z0-9]+(?:_[A-Za-z0-9]+)*?)_[0-9a-f]{6,8}/g, '$1');
  const out = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|LINK|META)$/.test(e.tagName)) continue;
    const cs = getComputedStyle(e);
    out.push({ d: `${e.tagName.toLowerCase()}.${String(e.className?.baseVal ?? e.className).slice(0, 40)}`, s: props.map((p) => (p === 'font-family' ? fam(cs.getPropertyValue(p)) : cs.getPropertyValue(p))).join('|') });
  }
  return out;
}
const h8 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 8);

await main('F3-S2 saoc-computed', async (r) => {
  const capture = process.argv.includes('--capture');
  const got = {};
  await withBrowser(async (browser) => {
    for (const route of ROUTES) {
      for (const [name, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
        const { ctx, page, status } = await openPage(browser, vp, route);
        if (status !== 200) { r.fail(`${route} @${name}: HTTP ${status}`); await ctx.close(); continue; }
        got[`${route}@${name}`] = await page.evaluate(grab, PROPS);
        await ctx.close();
      }
    }
  });
  const bySig = (els) => {
    const m = {};
    for (const e of els) (m[e.d] ??= new Set()).add(h8(e.s));
    return m;
  };
  if (capture) {
    const merge = process.argv.includes('--merge');
    const prev = merge ? JSON.parse(readFileSync(GOLDEN, 'utf8')).sets : {};
    const sets = {};
    for (const [k, els] of Object.entries(got)) {
      const m = bySig(els);
      for (const [d, hs] of Object.entries(prev[k] ?? {})) for (const h of hs) (m[d] ??= new Set()).add(h);
      sets[k] = Object.fromEntries(Object.entries(m).map(([d, hs]) => [d, [...hs].sort()]));
    }
    writeFileSync(GOLDEN, JSON.stringify({ _provenance: process.env.NOS_CAPTURE_NOTE ?? 'unrecorded', props: PROPS, sets }) + '\n');
    console.log(`captured ${Object.keys(sets).length} route/viewport sets (${Object.values(sets).reduce((n, o) => n + Object.keys(o).length, 0)} element signatures) to ${GOLDEN}`);
    return;
  }
  const gold = JSON.parse(readFileSync(GOLDEN, 'utf8')).sets;
  for (const [k, els] of Object.entries(got)) {
    const want = gold[k];
    if (!want) { r.fail(`${k}: not in the golden`); continue; }
    const diff = [];
    let unknown = 0;
    for (const [d, hs] of Object.entries(bySig(els))) {
      if (!want[d]) { unknown++; continue; } // a class the content added (Sanity-driven lists); its style cannot have leaked from a rule the golden never saw
      for (const h of hs) if (!want[d].includes(h)) diff.push(d);
    }
    if (diff.length) r.fail(`${k}: ${diff.length} element signature(s) have a computed style the SAOC golden never saw, first: ${[...new Set(diff)].slice(0, 5).join('; ')}`);
    if (unknown) r.note(`${k}: ${unknown} class(es) not in the golden (content-driven), not compared`);
  }
});
