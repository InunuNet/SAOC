// F1d: no opacity animation or transition on the hero <img>, its ancestors up to the hero section, or the hero <h1> (a fade makes LCP wait for
// the animation). Home's crossfade stack is the known case: the first slide must not fade in (later slides may fade between themselves only
// after the first paint, so the check inspects the FIRST slide and its wrappers).
import { withSite, openPage, check, finish } from './lib.mjs';
const PROBE = `() => { const hero = document.querySelector('[data-home-hero-media] img, [data-page-hero-media] img'); const sec = document.querySelector('[data-page-hero], .home-hero'); const h1 = sec && sec.querySelector('h1');
  const bad = (e) => { const c = getComputedStyle(e); const props = c.transitionProperty.split(',').map((s) => s.trim()); const durs = c.transitionDuration.split(',').map((s) => parseFloat(s)); const t = props.some((p, i) => (p === 'opacity' || p === 'all') && (durs[i % durs.length] || 0) > 0);
    const a = c.animationName !== 'none' && c.animationDuration !== '0s' && /fade|opacity|reveal|in/i.test(c.animationName); return t ? 'transition:' + c.transitionProperty : a ? 'animation:' + c.animationName : ''; };
  const out = []; const chain = []; for (let n = hero; n && n !== sec; n = n.parentElement) chain.push(n); if (h1) chain.push(h1);
  const slide = hero && hero.closest('[data-hero-slide]'); if (slide) chain.push(slide);
  for (const n of chain) { const b = bad(n); if (b) out.push((n.tagName + '.' + String(n.className).split(' ')[0]).slice(0, 50) + ' ' + b); } return { found: !!hero, out }; }`;
await withSite(async ({ base, browser, ctxOpts, deployed }) => {
  for (const path of deployed ? ['/', '/about'] : ['/about']) for (const width of [390, 1440]) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, path, width, 900);
    const r = await page.evaluate(`(${PROBE})()`);
    check(r.found, `${path}@${width}: hero img not found`);
    for (const o of r.out) check(false, `${path}@${width}: opacity motion on ${o}`);
    await ctx.close();
  }
});
finish('hero-no-fade');
