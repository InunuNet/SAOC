// council-design-1 (NOS Design ruling 2): filter chips, toggles and tabs are t-label pills, and the selected state must not rely on weight alone.
// On /events and /societies at 390 and 1440, every control group (siblings sharing aria-pressed / aria-selected) with a selected member must show a
// selected-vs-unselected difference in background, border, text decoration, box-shadow or colour. A weight-only difference fails. Also each such control is t-label.
import { withSite, openPage, check, finish } from './council-lib.mjs';

const PROBE = `() => { const sel = '[aria-pressed],[aria-selected],[role=tab]'; const groups = new Map();
  for (const e of document.querySelectorAll(sel)) { if (e.getBoundingClientRect().width === 0) continue; const k = e.parentElement; groups.set(k, [...(groups.get(k) ?? []), e]); }
  const st = (e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, bd: c.borderTopColor + c.borderTopWidth, col: c.color, td: c.textDecorationLine, sh: c.boxShadow, w: c.fontWeight, fam: c.fontFamily.split(',')[0].replace(/["']/g, ''), tl: e.classList.contains('t-label') || !!e.closest('.t-label') }; };
  const on = (e) => e.getAttribute('aria-pressed') === 'true' || e.getAttribute('aria-selected') === 'true';
  return [...groups.values()].filter((g) => g.length > 1 && g.some(on) && g.some((x) => !on(x))).map((g) => ({ n: g.length, sel: st(g.find(on)), off: st(g.find((x) => !on(x))), label: (g.find(on).textContent || '').trim().slice(0, 30) })); }`;
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const path of ['/events', '/societies']) for (const width of [390, 1440]) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, path, width, 900); const groups = await page.evaluate(`(${PROBE})()`); const w = `${path}@${width}`;
    check(groups.length > 0, `${w}: no chip/toggle/tab group with a selected member found (the page lost its filter, or the probe is blind)`);
    for (const g of groups) {
      const beyondWeight = ['bg', 'bd', 'col', 'td', 'sh'].some((k) => g.sel[k] !== g.off[k]);
      check(beyondWeight, `${w}: selected "${g.label}" differs from its unselected sibling by weight alone (${g.sel.w} vs ${g.off.w}); keep or add a fill, border or underline`);
      check(g.sel.tl && g.off.tl, `${w}: "${g.label}" group is not t-label`);
    }
    await ctx.close();
  }
});
finish('selected-state');
