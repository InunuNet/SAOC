// G: every rendered link / button / input in the NOS chrome (#nh, #nd, #nf) is >= 44x44 and no
// rendered chrome text is under 12px (visually-hidden labels exempt). Measured closed and open.
import { VP_DESKTOP, VP_PHONE, main, openPage, withBrowser } from './_lib.mjs';

const ROUTES = ['/national-show', '/national-show/about', '/national-show/tickets'];
const MIN = 44;
const TEXT_MIN = 12;

const audit = ({ MIN, TEXT_MIN }) => {
  const out = { small: [], tiny: [] };
  const rendered = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]');
  };
  for (const el of document.querySelectorAll('#nh a, #nh button, #nh input, #nh select, #nh textarea, #nd a, #nd button, #nf a, #nf button, #nf input, #nf select, #nf textarea')) {
    if (!rendered(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < MIN - 0.5 || r.height < MIN - 0.5) out.small.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 40)}" ${Math.round(r.width * 10) / 10}x${Math.round(r.height * 10) / 10}`);
  }
  for (const root of document.querySelectorAll('#nh, #nd, #nf')) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const p = n.parentElement;
      if (!p || !rendered(p)) continue;
      const r = p.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      const fs = parseFloat(getComputedStyle(p).fontSize);
      if (fs < TEXT_MIN - 0.01) out.tiny.push(`"${n.textContent.trim().slice(0, 40)}" ${fs}px`);
    }
  }
  return out;
};

await main('G targets-type', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of ROUTES) {
      for (const [vpName, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
        const { ctx, page } = await openPage(browser, vp, route);
        if (!(await page.locator('#nh').count()) || !(await page.locator('#nf').count())) { r.fail(`${route} @${vpName}: NOS chrome (#nh / #nf) not present`); await ctx.close(); continue; }
        const states = [['closed', null]];
        if (vpName === '1280') states.push(['mega-open', async () => page.locator('#nh-show-trigger').click()]);
        else states.push(['panel-open', async () => { await page.locator('#nh-burger').click(); await page.locator('#nd [data-sub]').click(); }]);
        for (const [state, act] of states) {
          if (act) await act();
          const res = await page.evaluate(audit, { MIN, TEXT_MIN });
          for (const s of res.small) r.fail(`${route} @${vpName} ${state}: target under ${MIN}px: ${s}`);
          for (const t of res.tiny) r.fail(`${route} @${vpName} ${state}: text under ${TEXT_MIN}px: ${t}`);
        }
        await ctx.close();
      }
    }
  });
});
