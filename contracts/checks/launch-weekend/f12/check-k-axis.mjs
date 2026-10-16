#!/usr/bin/env node
// F12-A15 - R71 single alignment axis. The NOS header's container (F3 renders it as .nh-bar: max-width 1320 + two gutters, gutter
// clamp(16px, 2.5vw, 32px), centred) is the ONE axis. At 1280, 1920 and 2056 (and 390) on every NOS route the header content edge, the hero
// title, the sub-nav, every body section's wrap content edge, the first h2 of every section, the presenters wrap and the hub index share one left edge (+-1px).
// Also asserts the header itself was not moved (its edge still equals the formula), and that the wraps are the header's container, not a separate one.
import { main, openPage, withBrowser, NOS_ROUTES, near } from './_lib.mjs';

const WIDTHS = [[1280, 800], [1920, 1080], [2056, 1100], [390, 844]];
const gutterOf = (vw) => Math.min(Math.max(16, 0.025 * vw), 32);
const axisBox = (vw) => { const g = gutterOf(vw); const max = 1320 + g + g; const w = Math.min(vw, max); return { g, max, w, left: (vw - w) / 2, edge: (vw - w) / 2 + g }; };

function measure() {
  const rc = (e) => e.getBoundingClientRect();
  const cs = (e) => getComputedStyle(e);
  const edgeOf = (e) => rc(e).left + parseFloat(cs(e).paddingLeft);
  const bar = document.querySelector('#nh .nh-bar');
  const hero = document.querySelector('[data-nos-hero]');
  const root = hero?.parentElement;
  const out = { vw: innerWidth, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, header: bar ? { edge: edgeOf(bar), maxWidth: cs(bar).maxWidth, pad: parseFloat(cs(bar).paddingLeft) } : null, items: [] };
  if (!hero || !root) { out.error = 'no hero'; return out; }
  const push = (what, left, extra = {}) => out.items.push({ what, left, ...extra });
  const title = hero.querySelector('h1');
  if (title) push('hero h1', rc(title).left);
  const copy = hero.querySelector('.nos-hero-copy');
  if (copy) push('hero copy content edge', edgeOf(copy), { maxWidth: cs(copy).maxWidth, pad: parseFloat(cs(copy).paddingLeft) });
  const sub = document.querySelector('.nos-subnav .nos-subnav-link');
  if (sub) push('sub-nav first link', rc(sub).left);
  for (const w of document.querySelectorAll('main [data-nos-wrap]')) {
    if (w.closest('[data-nos-hero]')) continue;
    push('section wrap content edge', edgeOf(w), { maxWidth: cs(w).maxWidth, pad: parseFloat(cs(w).paddingLeft), width: rc(w).width, centred: Math.abs(rc(w).left - (innerWidth - rc(w).width) / 2) <= 1.5 });
  }
  for (const sec of [...root.children].filter((e) => e !== hero && e.tagName === 'SECTION')) {
    const h2 = sec.querySelector('h2');
    if (h2 && rc(h2).height > 0 && !h2.closest('.nos-surface.mx-auto')) push(`first h2 "${(h2.textContent ?? '').trim().slice(0, 30)}"`, rc(h2).left);
  }
  for (const w of document.querySelectorAll('.nos-presenters .pc-wrap')) push('presenters wrap content edge', edgeOf(w));
  const idx = document.querySelector('nav[aria-label="Explore the show pages"]');
  if (idx) {
    const inner = idx.firstElementChild;
    if (inner) push('hub index container content edge', edgeOf(inner), { maxWidth: cs(inner).maxWidth, pad: parseFloat(cs(inner).paddingLeft) });
    const eb = idx.querySelector('p');
    if (eb) push('hub index eyebrow', rc(eb).left);
  }
  return out;
}

await main('F12-A15 single axis', async (r) => {
  await withBrowser(async (browser) => {
    const probe = await openPage(browser, { width: 1280, height: 800 }, '/national-show/archive');
    const years = await probe.page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/national-show/archive/"]')].map((a) => a.getAttribute('href')))].slice(0, 2));
    await probe.ctx.close();
    for (const route of [...NOS_ROUTES, ...years]) {
      const { ctx, page, status } = await openPage(browser, { width: 1280, height: 800 }, route);
      if (status !== 200) { r.fail(`${route}: HTTP ${status}`); await ctx.close(); continue; }
      for (const [w, h] of WIDTHS) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(150);
        const m = await page.evaluate(measure);
        const tag = `${route} @${w}`;
        if (m.error) { r.fail(`${tag}: ${m.error}`); continue; }
        if (m.overflowX > 1) r.fail(`${tag}: horizontal overflow ${m.overflowX}px`);
        const ax = axisBox(w);
        if (!m.header) { r.fail(`${tag}: NOS header .nh-bar not found`); continue; }
        if (!near(m.header.edge, ax.edge, 1)) r.fail(`${tag}: the header edge is ${m.header.edge.toFixed(1)}px, the F3 header formula gives ${ax.edge.toFixed(1)}px (the header must not move; it IS the axis)`);
        for (const it of m.items) {
          if (!near(it.left, m.header.edge, 1)) r.fail(`${tag}: ${it.what} starts at ${it.left.toFixed(1)}px, the header axis is ${m.header.edge.toFixed(1)}px`);
          if (it.maxWidth !== undefined && it.maxWidth !== 'none') {
            const mw = parseFloat(it.maxWidth);
            if (!near(mw, ax.max, 1)) r.fail(`${tag}: ${it.what} max-width ${it.maxWidth}, want the header container ${ax.max.toFixed(0)}px`);
            if (!near(it.pad, ax.g, 0.6)) r.fail(`${tag}: ${it.what} padding-inline ${it.pad}px, want the header gutter ${ax.g.toFixed(1)}px`);
          }
          if (it.centred === false) r.fail(`${tag}: ${it.what} is not centred`);
        }
        if (!m.items.some((i) => i.what === 'section wrap content edge') && route !== '/national-show/archive') r.note(`${tag}: no [data-nos-wrap] section wraps measured`);
      }
      await ctx.close();
    }
  });
});
