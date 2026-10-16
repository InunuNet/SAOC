#!/usr/bin/env node
// F12-A16 - R71 inner hero, template-wide: on every NOS route whose hero is the inner kind, at >=1024 (1024, 1280, 1920, 2056) the title is
// max-width none, font-size clamp(48px,4.4vw,88px), text-wrap balance; the lede max-width is 46ch (the symposium theme-line lede keeps its own
// R70 30ch); the hero min-height is at least 380px. The International Guests and About h1 are two lines or fewer at 1280.
import { main, openPage, withBrowser, NOS_ROUTES, near, px } from './_lib.mjs';

const WIDTHS = [1024, 1280, 1920, 2056];
const MAX_TWO_LINES = ['/national-show/international-guests', '/national-show/about'];
const SYMPOSIUM = '/national-show/symposium';

function measure() {
  const hero = document.querySelector('[data-nos-hero="inner"]');
  if (!hero) return { kind: document.querySelector('[data-nos-hero]')?.getAttribute('data-nos-hero') ?? null };
  const cs = (e) => getComputedStyle(e);
  const title = hero.querySelector('h1');
  const lede = hero.querySelector('[data-nos-hero-lede]');
  const chFn = (el, n) => {
    const c = cs(el);
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;width:${n}ch;font-family:${c.fontFamily};font-size:${c.fontSize};font-weight:${c.fontWeight};font-style:${c.fontStyle};`;
    el.parentElement.appendChild(d);
    const w = d.getBoundingClientRect().width;
    d.remove();
    return w;
  };
  const rg = document.createRange();
  rg.selectNodeContents(title);
  const lines = new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size;
  return {
    kind: 'inner',
    title: { maxWidth: cs(title).maxWidth, size: parseFloat(cs(title).fontSize), wrap: cs(title).textWrapStyle || cs(title).textWrap, lines },
    lede: lede ? { maxWidth: parseFloat(cs(lede).maxWidth), ch46: chFn(lede, 46) } : null,
    minH: parseFloat(cs(hero).minHeight), h: hero.getBoundingClientRect().height,
  };
}

await main('F12-A16 inner hero', async (r) => {
  await withBrowser(async (browser) => {
    const probe = await openPage(browser, { width: 1280, height: 800 }, '/national-show/archive');
    const years = await probe.page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/national-show/archive/"]')].map((a) => a.getAttribute('href')))].slice(0, 2));
    await probe.ctx.close();
    let inner = 0;
    for (const route of [...NOS_ROUTES, ...years]) {
      const { ctx, page, status } = await openPage(browser, { width: 1280, height: 800 }, route);
      if (status !== 200) { r.fail(`${route}: HTTP ${status}`); await ctx.close(); continue; }
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.waitForTimeout(150);
        const m = await page.evaluate(measure);
        if (m.kind !== 'inner') break;
        if (w === WIDTHS[0]) inner++;
        const tag = `${route} @${w}`;
        const want = Math.min(88, Math.max(48, 0.044 * w));
        if (m.title.maxWidth !== 'none') r.fail(`${tag}: h1 max-width ${m.title.maxWidth}, want none`);
        if (!near(m.title.size, want, 0.6)) r.fail(`${tag}: h1 ${m.title.size}px, want clamp(48px,4.4vw,88px) = ${want.toFixed(2)}px`);
        if (m.title.wrap !== 'balance') r.fail(`${tag}: h1 text-wrap ${m.title.wrap}, want balance`);
        if (m.minH < 379.5 || m.h < 379.5) r.fail(`${tag}: inner hero min-height ${m.minH}px / height ${m.h.toFixed(0)}px, want at least 380px`);
        if (m.lede && route !== SYMPOSIUM && !near(m.lede.maxWidth, m.lede.ch46, 1.5)) r.fail(`${tag}: lede max-width ${m.lede.maxWidth}px, want 46ch = ${m.lede.ch46.toFixed(1)}px`);
        if (w === 1280 && MAX_TWO_LINES.includes(route) && m.title.lines > 2) r.fail(`${tag}: h1 wraps to ${m.title.lines} lines, want at most 2`);
      }
      await ctx.close();
    }
    if (inner < 8) r.fail(`only ${inner} inner-hero routes found, expected at least 8`);
  });
});
