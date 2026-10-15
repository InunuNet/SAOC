// F2-S1 (NOS Design R25, item 4): the NOS-scoped h2 size must not leak onto SAOC pages. The h2 computed style (size, weight, line-height,
// letter-spacing, family, variation settings) on the SAOC routes at 1280 and 390 must equal the golden captured from main before F2
// (goldens/f2/saoc-h2.json), and no SAOC h2 may compute to Fraunces or Karla.
//   verify : node --import tsx/esm contracts/checks/nos-own-brand-chrome/f2/check-f2-saoc-h2.mjs
//   capture: ... check-f2-saoc-h2.mjs --capture   (against a server built from main only; never from the F2 branch)
import { readFileSync, writeFileSync } from 'node:fs';
import { F2_GOLDEN_DIR, VP_DESKTOP, VP_PHONE, main, openPage, withBrowser } from './_f2lib.mjs';

const GOLDEN = `${F2_GOLDEN_DIR}/saoc-h2.json`;
const ROUTES = ['/', '/about', '/societies', '/contact', '/judging', '/events'];

const grab = () => [...document.querySelectorAll('h2')].filter((e) => e.getClientRects().length && !e.closest('#nh, #nd, #nf')).map((e) => {
  const cs = getComputedStyle(e);
  return { text: (e.textContent ?? '').trim().slice(0, 30), family: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight, lh: cs.lineHeight, ls: cs.letterSpacing, fvs: cs.fontVariationSettings };
});
const strip = (h) => h.map(({ family, size, weight, lh, ls, fvs }) => ({ family, size, weight, lh, ls, fvs }));

await main('F2-S1 saoc-h2', async (r) => {
  const capture = process.argv.includes('--capture');
  const got = {};
  await withBrowser(async (browser) => {
    for (const route of ROUTES) {
      for (const [name, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
        const { ctx, page, status } = await openPage(browser, vp, route);
        if (status !== 200) { r.fail(`${route} @${name}: HTTP ${status}`); await ctx.close(); continue; }
        got[`${route}@${name}`] = await page.evaluate(grab);
        await ctx.close();
      }
    }
  });
  if (capture) { writeFileSync(GOLDEN, JSON.stringify({ _source: `clean origin/main build ${process.env.NOS_CAPTURE_SHA ?? 'unrecorded'}`, ...got }, null, 1) + '\n'); console.log(`captured ${Object.keys(got).length} route/viewport sets to ${GOLDEN}`); return; }
  const gold = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  for (const [k, hs] of Object.entries(got)) {
    for (const h of hs) if (/fraunces|karla/i.test(h.family.split(',')[0])) r.fail(`${k}: SAOC h2 "${h.text}" computes to ${h.family.slice(0, 30)}; NOS fonts leaked onto a SAOC page`);
    const want = gold[k];
    if (!want) { r.fail(`${k}: not in the golden`); continue; }
    if (JSON.stringify(strip(hs)) !== JSON.stringify(strip(want))) r.fail(`${k}: SAOC h2 computed style changed vs main: got ${JSON.stringify(strip(hs)).slice(0, 160)} want ${JSON.stringify(strip(want)).slice(0, 160)}`);
  }
});
