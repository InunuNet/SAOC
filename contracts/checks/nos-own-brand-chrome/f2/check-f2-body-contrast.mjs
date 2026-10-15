// F2-H5 (NOS Design ruling 2026-10-16): muted and alpha body copy (text-ink/80, muted, ink-500, lilac-muted ...) on NOS routes measures >= 4.5:1
// on its ACTUAL ground once the base is ink-700. Anything failing is raised to solid ink-700 (#3A3654, the full-opacity body colour; ink-500 is lighter and would lower contrast) by the dev. Purely decorative glyphs are exempt (WCAG 1.4.3): anything aria-hidden, or a single non-alphanumeric symbol such as the "※" marker; they are listed in the output and in the golden spec, and must not be the only carrier of meaning. Method as F2-H3: every text run outside the
// hero, chrome and buttons whose colour is alpha < 1 or ink-500/muted rgb(106,103,128) is boxed; all page text is hidden; the box is screenshotted from
// the real composite (card fills, photos, bands); the brightest and darkest pixel are contrasted with the run's colour (alpha composited). Worst case wins.
// Samples are de-duplicated by colour + class and capped (NOS_F2_BODY_CAP, default 40) per page and width. All 17 routes at 1280 and 390.
import { NOS_ROUTES, main, openPage, withBrowser, extremes, contrast, parseColor } from './_f2lib.mjs';

const MIN = Number(process.env.NOS_F2_CONTRAST_MIN || 4.5);
const CAP = Number(process.env.NOS_F2_BODY_CAP || 40);
const MUTED = [106, 103, 128];

function collect(cap) {
  const out = [];
  const decor = [];
  const seen = new Set();
  const w = document.createTreeWalker(document.querySelector('main') ?? document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n && out.length < cap; n = w.nextNode()) {
    if (!n.textContent.trim()) continue;
    const p = n.parentElement;
    if (!p || p.closest('[data-nos-hero], #nh, #nd, #nf, [data-nos-button], button, script, style')) continue;
    if (p.closest('[hidden]') || getComputedStyle(p).visibility === 'hidden') continue;
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/.exec(getComputedStyle(p).color);
    if (!m) continue;
    const a = m[4] === undefined ? 1 : Number(m[4]);
    const rgb = [Number(m[1]), Number(m[2]), Number(m[3])];
    const isMuted = rgb.every((v, i) => Math.abs(v - [106, 103, 128][i]) <= 2);
    if (a >= 1 && !isMuted) continue;
    const trimmed = n.textContent.trim();
    if (p.closest('[aria-hidden="true"]') || (/^\S$/u.test(trimmed) && !/[\p{L}\p{N}]/u.test(trimmed))) { decor.push(trimmed.slice(0, 6) + ' in ' + p.tagName.toLowerCase() + '.' + String(p.className).slice(0, 30)); continue; }
    const range = document.createRange();
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (!(r.width > 2 && r.height > 2) || r.right <= 0 || r.left >= innerWidth) continue; // off-canvas runs (carousels, skip links) have no ground to measure
    const key = getComputedStyle(p).color + '|' + String(p.className).slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: n.textContent.trim().slice(0, 28), color: getComputedStyle(p).color, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, cls: String(p.className).slice(0, 50) });
  }
  return { out, decor };
}

await main('F2-H5 body-contrast', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      for (const [name, vp] of [['1280', { width: 1280, height: 800 }], ['390', { width: 390, height: 844 }]]) {
        const { ctx, page } = await openPage(browser, vp, route);
        const got = await page.evaluate(collect, CAP);
        const runs = got.out;
        for (const d of new Set(got.decor)) r.note('exempt decorative glyph on ' + route + ' @' + name + ': ' + d);
        const tag = route + ' @' + name;
        if (runs.length) {
          const style = await page.addStyleTag({ content: 'body *, body { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }' });
          await page.waitForTimeout(80);
          for (const t of runs) {
            const fg = parseColor(t.color);
            const clip = { x: Math.max(0, t.x), y: Math.max(0, t.y), width: Math.max(2, Math.min(t.w, vp.width - t.x)), height: Math.max(2, t.h) };
            let png;
            try { png = await page.screenshot({ fullPage: true, clip, type: 'png' }); } catch (e) { r.note(tag + ': "' + t.text + '" outside the page image, skipped'); continue; }
            const { hi, lo } = await extremes(page, png);
            let worst = Infinity;
            let worstBg = null;
            for (const bg of [hi, lo]) {
              const eff = fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a));
              const cr = contrast(eff, bg);
              if (cr < worst) { worst = cr; worstBg = bg; }
            }
            if (worst < MIN) r.fail(tag + ': "' + t.text + '" (' + t.cls + ') ' + t.color + ' is ' + worst.toFixed(2) + ':1 on rgb(' + worstBg + '), want >= ' + MIN + ':1; raise it to solid ink-700 #3A3654');
          }
          await style.evaluate((el) => el.remove());
        }
        r.note(tag + ': ' + runs.length + ' muted/alpha run(s) sampled');
        await ctx.close();
      }
    }
  });
});
