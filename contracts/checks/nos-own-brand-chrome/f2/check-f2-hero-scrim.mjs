// F2-H1 (R15, plus NOS Design rulings R15/9 and R25 of 2026-10-16): every NOS hero carries exactly ONE scrim at >=1024px, a 90deg
// near-black ramp, never purple: rgba(11,10,20) .92 @0, .86 @calc(min(640px,50%) + 48px), .42 @66%, .18 @82%, .06 @100% (same ramp for hub and inner).
// Stacked (<=1023px): NO gradient at all and the hero ground is solid rgb(11,10,20).
// Every gradient inside the hero (element, ::before, ::after) is found by computed style, so the check does not care
// whether the dev used a div or a pseudo-element. All 17 routes, widths 1280/1100/1024/1023/768/767/620/390/375.
import { NOS_ROUTES, HUB, VP_DESKTOP, HERO_WIDTHS, SCRIM_RAMP, HUB_STACK_MAX, INNER_STACK_MAX, SCRIM_RGB, main, openPage, withBrowser, heroInfo, judgeRamp, near } from './_f2lib.mjs';

await main('F2-H1 hero-scrim', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      const { ctx, page } = await openPage(browser, VP_DESKTOP, route);
      for (const w of HERO_WIDTHS) {
        await page.setViewportSize({ width: w, height: w >= 1000 ? 800 : 844 });
        await page.waitForTimeout(120);
        const tag = `${route} @${w}`;
        const h = await page.evaluate(heroInfo);
        if (!h) { r.fail(`${tag}: no [data-nos-hero] element`); continue; }
        const want = route === HUB ? 'hub' : 'inner';
        if (h.kind !== want) r.fail(`${tag}: data-nos-hero="${h.kind}", want "${want}"`);
        const stacked = w <= (h.kind === 'hub' ? HUB_STACK_MAX : INNER_STACK_MAX);
        if (h.variant === 'type') {
          // F3 R29: a typographic hero has no photo and so no scrim at any width, on a solid near-black ground.
          if (h.gradients.length) r.fail(`${tag}: typographic hero must have no scrim, found ${h.gradients.map((g) => g.where).join(', ')}`);
          const bgT = h.bgColor.match(/[\d.]+/g)?.map(Number) ?? [];
          if (!(bgT.length >= 3 && bgT.slice(0, 3).every((c, i) => near(c, SCRIM_RGB[i], 1)) && (bgT[3] ?? 1) === 1)) r.fail(`${tag}: typographic hero ground is ${h.bgColor}, want solid rgb(11, 10, 20)`);
          continue;
        }
        if (stacked) {
          if (h.gradients.length) r.fail(`${tag}: stacked hero must have no scrim, found ${h.gradients.map((g) => g.where).join(', ')}`);
          const bg = h.bgColor.match(/[\d.]+/g)?.map(Number) ?? [];
          if (!(bg.length >= 3 && bg.slice(0, 3).every((c, i) => near(c, SCRIM_RGB[i], 1)) && (bg[3] ?? 1) === 1)) r.fail(`${tag}: stacked hero ground is ${h.bgColor}, want solid rgb(11, 10, 20)`);
        } else {
          if (h.gradients.length !== 1) r.fail(`${tag}: want exactly one scrim gradient in the hero, found ${h.gradients.length}: ${h.gradients.map((g) => `${g.where} ${g.bg.slice(0, 70)}`).join(' | ')}`);
          else for (const p of judgeRamp(h.gradients[0].bg, SCRIM_RAMP, `${tag} ${h.kind} scrim`, h.hero.width)) r.fail(p);
        }
      }
      await ctx.close();
    }
  });
});
