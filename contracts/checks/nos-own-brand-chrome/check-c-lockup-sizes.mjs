// C: header lockup 448 @1280 / 390 @390; footer horizontal 448 @1280, vertical 342 @390 (mono file),
// aspect ratio intact, the inactive footer lockup is display:none.
import { NOS_ROUTES, VP_DESKTOP, VP_PHONE, main, openPage, withBrowser } from './_lib.mjs';

const TOL = 0.75;
const measure = (sel) => (page) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { w: rect.width, h: rect.height, nw: el.naturalWidth, nh: el.naturalHeight, display: getComputedStyle(el).display, src: el.getAttribute('src') };
}, sel);

await main('C lockup-sizes', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      for (const [vpName, vp, want] of [
        ['1280', VP_DESKTOP, { header: 448, visible: '#nf .nf-lockup .nf-h', hidden: '#nf .nf-lockup .nf-v', footer: 448 }],
        ['390', VP_PHONE, { header: 390, visible: '#nf .nf-lockup .nf-v', hidden: '#nf .nf-lockup .nf-h', footer: 342 }],
      ]) {
        const { ctx, page } = await openPage(browser, vp, route);
        const tag = `${route} @${vpName}`;
        const hd = await measure('#nh .nh-brand img')(page);
        if (!hd) r.fail(`${tag}: header lockup #nh .nh-brand img not found`);
        else {
          if (Math.abs(hd.w - want.header) > TOL) r.fail(`${tag}: header lockup width ${hd.w}, want ${want.header}`);
          if (Math.abs(hd.h - (hd.w * hd.nh) / hd.nw) > TOL) r.fail(`${tag}: header lockup aspect broken (${hd.w}x${hd.h}, natural ${hd.nw}x${hd.nh})`);
        }
        const ft = await measure(want.visible)(page);
        if (!ft) r.fail(`${tag}: footer lockup ${want.visible} not found`);
        else {
          if (ft.display === 'none') r.fail(`${tag}: footer lockup ${want.visible} is display:none`);
          if (Math.abs(ft.w - want.footer) > TOL) r.fail(`${tag}: footer lockup width ${ft.w}, want ${want.footer}`);
          if (Math.abs(ft.h - (ft.w * ft.nh) / ft.nw) > TOL) r.fail(`${tag}: footer lockup aspect broken (${ft.w}x${ft.h}, natural ${ft.nw}x${ft.nh})`);
        }
        const other = await measure(want.hidden)(page);
        if (!other || other.display !== 'none') r.fail(`${tag}: inactive footer lockup ${want.hidden} must exist and be display:none`);
        await ctx.close();
      }
    }
  });
});
