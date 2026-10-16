// F3-C2 (NOS Design Acceptance bar rev 2, C2): one section rhythm. padding-block of every section is clamp(72px, 9vw, 120px)
// (handoff index.html:156 `.section { padding-block: clamp(72px, 9vw, 120px); }`; closing copy I:230 uses the same token). The hub measured
// 96/96, 0/32, 64/64, 80/80, 96/96. Measured within +-1px at 1440, 1280, 1024, 768, 390 on every route.
// The mock's only exception, `.section-tight` (I:157, 32px 0 0), is a plain <div> there (I:577), never a <section>: a <section> has no exception here.
// Blocks = rendered children of the page-content root (the parent of [data-nos-hero]) other than the hero and the sub-nav. A non-section block
// must be a <nav> (the foot ShowSectionNav, R21) or fails; vertical padding sits on the <section> itself, never on its wrap.
import { allRoutes, main, openPage, withBrowser, sectionPadOf } from './_f3lib.mjs';

const VPS = [[1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844]];

function measure() {
  const hero = document.querySelector('[data-nos-hero]');
  if (!hero) return { error: 'no [data-nos-hero]' };
  const root = hero.parentElement;
  const vw = document.documentElement.clientWidth;
  const blocks = [...root.children].filter((e) => e !== hero && !/^(SCRIPT|STYLE|TEMPLATE|LINK|NOSCRIPT)$/.test(e.tagName) && e.getBoundingClientRect().height > 0.5 && !(e.tagName === 'NAV' && / pages$/.test(e.getAttribute('aria-label') ?? '')));
  return {
    vw,
    blocks: blocks.map((b) => {
      const cs = getComputedStyle(b);
      return { tag: b.tagName.toLowerCase(), cls: String(b.className).slice(0, 50), pt: parseFloat(cs.paddingTop), pb: parseFloat(cs.paddingBottom) };
    }),
  };
}

await main('F3-C2 rhythm', async (r) => {
  await withBrowser(async (browser) => {
    const routes = await allRoutes(browser);
    for (const route of routes) {
      const { ctx, page, status } = await openPage(browser, { width: 1280, height: 800 }, route);
      if (status !== 200) { r.fail(`${route}: HTTP ${status}`); await ctx.close(); continue; }
      for (const [w, h] of VPS) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(120);
        const m = await page.evaluate(measure);
        const tag = `${route} @${w}`;
        if (m.error) { r.fail(`${tag}: ${m.error}`); continue; }
        if (!m.blocks.length) { r.fail(`${tag}: no content blocks after the hero`); continue; }
        const want = sectionPadOf(m.vw);
        for (const b of m.blocks) {
          const id = `${tag} <${b.tag} class="${b.cls}">`;
          if (b.tag === 'nav') continue;
          if (b.tag !== 'section') { r.fail(`${id}: a content block must be a <section> carrying the rhythm (only a <nav> is exempt)`); continue; }
          if (Math.abs(b.pt - want) > 1 || Math.abs(b.pb - want) > 1) r.fail(`${id}: padding-block ${b.pt.toFixed(1)}/${b.pb.toFixed(1)}px, want clamp(72px, 9vw, 120px) = ${want.toFixed(1)}px`);
        }
      }
      await ctx.close();
    }
  });
});
