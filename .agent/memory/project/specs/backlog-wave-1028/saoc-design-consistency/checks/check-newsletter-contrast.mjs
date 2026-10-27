// F1a: footer newsletter email field. Placeholder >=4.5:1 against the field fill, field border >=3:1 against the footer.
import { withSite, openPage, check, finish, RGBA_FN, blend, ratio } from './lib.mjs';
const PROBE = `() => { const rgba = ${RGBA_FN}; const f = document.querySelector('footer'); const i = f.querySelector('input[type=email]');
  const c = getComputedStyle(i); return { footer: rgba(getComputedStyle(f).backgroundColor), fill: rgba(c.backgroundColor), border: rgba(c.borderTopColor), bw: parseFloat(c.borderTopWidth), ph: rgba(getComputedStyle(i, '::placeholder').color) }; }`;
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [390, 1440]) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', width);
    const r = await page.evaluate(`(${PROBE})()`);
    const footer = r.footer.slice(0, 3); const fill = blend(r.fill, footer);
    const ph = ratio(blend(r.ph, fill), fill); const bd = ratio(blend(r.border, footer), footer);
    check(r.bw >= 1, `@${width}: field has no border`);
    check(ph >= 4.5, `@${width}: placeholder ${ph.toFixed(2)}:1 on the field fill, want >=4.5:1`);
    check(bd >= 3, `@${width}: field border ${bd.toFixed(2)}:1 on the footer, want >=3:1`);
    await ctx.close();
  }
});
finish('newsletter-contrast');
