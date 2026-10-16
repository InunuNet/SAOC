// F2-H2: hub hero items 3-7 and the inner hero's structure, measured in real Chromium.
//  NOS Design R15/9 (2026-10-16): BOTH heroes stack at <=1023 (hub and inner), photo 4:3 (4:3 or 16:9 at 768-1023); at >=1024 the copy
//       column is capped at min(640px, 50%). Facts-after-CTAs and full-width CTAs stay at the mock's <=700.
//  Rulings 2026-10-15: fold = h1, lede and both CTAs by y=800 (facts left the fold: F3 C-2 orders CTAs, price, countdown, facts), countdown directly below the CTAs; inner h1 14ch, no inner eyebrow.
//  Hub  (index.html:136-148, 304-318): no eyebrow / edition line; h1 is the first text and sits >=72px below the top (>=40 stacked);
//       h1 max 11ch; countdown (if rendered) sits below the facts and inside the fold; at 1280x800 the whole hero ends at
//       or above y=800 and min-height = clamp(600px, 100svh - 97px, 820px); photo inset 22% and masked at >=701; stacked
//       <=700: column, photo static BELOW all copy at 4:3, no mask, min-height 0, CTAs full width, facts after the CTAs.
//  Inner (index.html:245-256): min-height clamp(360px, 32vw, 460px) at >=621; h1 max 9ch; photo absolute behind the copy
//       at >=621; <=620 photo static below the copy at 4:3, min-height 0.
import { NOS_ROUTES, HUB, HUB_H1_CH, INNER_H1_CH, HUB_STACK_MAX, INNER_STACK_MAX, NARROW_MAX, COLUMN_CAP_PX, HERO_WIDTHS, VP_DESKTOP, main, openPage, withBrowser, heroInfo, near } from './_f2lib.mjs';

const WIDTHS = [...HERO_WIDTHS, 701, 700];

await main('F2-H2 hero-layout', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      const isHub = route === HUB;
      const { ctx, page } = await openPage(browser, VP_DESKTOP, route);
      for (const w of WIDTHS) {
        const vh = w === 1280 ? 800 : 844;
        await page.setViewportSize({ width: w, height: vh });
        await page.waitForTimeout(150);
        const tag = `${route} @${w}x${vh}`;
        const h = await page.evaluate(heroInfo);
        if (!h) { r.fail(`${tag}: no [data-nos-hero]`); continue; }
        const stackMax = isHub ? HUB_STACK_MAX : INNER_STACK_MAX;
        const stacked = w <= stackMax;
        const fail = (m) => r.fail(`${tag}: ${m}`);
        const maxCh = isHub ? HUB_H1_CH : INNER_H1_CH;
        if (h.h1 && h.ch && h.h1.width > maxCh * h.ch + 1) fail(`h1 is ${h.h1.width.toFixed(0)}px wide, max ${maxCh}ch = ${(maxCh * h.ch).toFixed(0)}px`);
        if (h.variant === 'type') {
          // F3 R29: typographic hero: no photo, so no photo geometry. The h1 width cap above and the no-eyebrow rule still apply.
          if (h.eyebrows) fail(h.eyebrows + ' [data-nos-hero-eyebrow] in an inner hero (ruling 2026-10-15 Q4: no eyebrow in inner heroes)');
          continue;
        }
        if (h.img == null) fail('no photograph <img> in the hero');

        if (stacked) {
          if (!(h.minHeight === 0)) fail(`stacked hero min-height ${h.minHeight}px, want 0`);
          if (h.img && h.img.top < h.copyBottom - 1) fail(`photo top ${h.img.top.toFixed(0)} is above the last copy bottom ${h.copyBottom.toFixed(0)}; the photo must sit below, never behind`);
          if (h.img) {
            const ar = h.img.width / h.img.height;
            const okAr = near(ar, 4 / 3, 0.03) || (w >= 768 && near(ar, 16 / 9, 0.03));
            if (!okAr) fail(`photo is ${h.img.width.toFixed(0)}x${h.img.height.toFixed(0)} (${ar.toFixed(3)}), want 4:3${w >= 768 ? ' or 16:9' : ''}`);
          }
          if (h.mask !== 'none') fail(`photo mask "${h.mask.slice(0, 40)}" must be removed when stacked`);
        } else {
          if (h.img && h.h1 && !(h.img.top <= h.h1.top)) fail(`photo top ${h.img.top.toFixed(0)} is below the h1 top ${h.h1.top.toFixed(0)}; at desktop the photo sits behind the copy`);
          if (h.h1) {
            const rights = [h.h1.right, ...h.texts.filter((x) => !x.inH1).map((x) => x.x + x.w), ...h.buttons.map((b) => b.right)];
            const colW = Math.max(...rights) - h.h1.left;
            const cap = Math.min(COLUMN_CAP_PX, 0.5 * h.hero.width);
            if (colW > cap + 1) fail(`copy column is ${colW.toFixed(0)}px wide, R15/9 caps it at min(640px, 50%) = ${cap.toFixed(0)}px`);
          }
        }

        if (isHub) {
          if (h.eyebrows) fail(`hub hero still has ${h.eyebrows} [data-nos-hero-eyebrow] (no eyebrow, item 3)`);
          if (/the flagship|edition\s+[ivxlcdm]+\b/i.test(h.heroText)) fail(`hub hero still carries "The Flagship" / "Edition ..." text`);
          const first = h.texts.filter((x) => !x.inH1).sort((a, b) => a.y - b.y || a.x - b.x)[0];
          if (first && h.h1 && first.y < h.h1.top - 1) fail(`text "${first.text}" sits above the h1; the h1 must lead the hero`);
          if (h.h1) {
            const pad = h.h1.top - h.hero.top;
            if (pad < (stacked ? 40 : 72) - 1) fail(`h1 is ${pad.toFixed(0)}px below the hero top, want >= ${stacked ? 40 : 72}px`);
          }
          if (h.countdown.length) {
            const lastBtn = Math.max(0, ...h.buttons.map((b) => b.bottom));
            if (!h.orderOk) fail('countdown precedes the CTAs in the DOM; it goes directly below them');
            for (const c of h.countdown) {
              if (c.top < lastBtn - 1) fail('countdown ' + c['key'] + ' top ' + c.top.toFixed(0) + ' is above the CTAs bottom ' + lastBtn.toFixed(0) + '; it sits directly below the CTAs');
              if (h.dl && h.dl.top < c.bottom - 1) fail('facts top ' + h.dl.top.toFixed(0) + ' is above the countdown ' + c['key'] + ' bottom ' + c.bottom.toFixed(0) + '; F3 C-2 puts the facts below the countdown');
              if (h.dl && c.top < h.dl.bottom - 1 && c.bottom > h.dl.top + 1) fail('countdown ' + c['key'] + ' overlaps the facts vertically (beside them); never beside the facts');
            }
          }
          if (stacked) {
            if (h.flexDirection !== 'column') fail(`stacked hero flex-direction ${h.flexDirection}, want column`);
          }
          if (w <= NARROW_MAX) {
            const lastBtn = Math.max(0, ...h.buttons.map((b) => b.bottom));
            if (h.dl && h.dl.top < lastBtn - 1) fail(`facts top ${h.dl.top.toFixed(0)} is above the CTAs bottom ${lastBtn.toFixed(0)}; index.html:307 puts facts after the CTAs when stacked`);
            for (const b of h.buttons) if (b.width < 0.8 * w) fail(`CTA is ${b.width.toFixed(0)}px wide, want full width (index.html:318)`);
          }
          if (!stacked) {
            const expMin = Math.min(Math.max(600, h.innerHeight - 97), 820);
            if (!near(h.minHeight, expMin, 1)) fail(`hero min-height ${h.minHeight}px, want clamp(600px, 100svh - 97px, 820px) = ${expMin}px`);
            if (h.media && !near((h.media.left - h.hero.left) / h.hero.width, 0.22, 0.012)) fail(`photo inset ${(((h.media.left - h.hero.left) / h.hero.width) * 100).toFixed(1)}% from the left, want 22%`);
            if (h.mask === 'none') fail('photo has no left feather mask at desktop (index.html:137)');
            if (w === 1280) {
              // NOS Design ruling 2026-10-15 (Q1): the first screen shows h1, lede, facts and BOTH CTAs; the countdown may fall below the fold.
              // F3 C-2 (NOS Design, 2026-10-16) supersedes the facts-in-the-fold part of the Q1 ruling: the hub order is CTAs, (price), countdown, then facts, so the facts
              // fall below the countdown and may fall below the fold. The fold holds the h1, the lede and BOTH CTAs.
              const parts = [['h1', h.h1], ['lede', h.lede], ...h.buttons.map((b, i) => ['CTA ' + (i + 1), b])];
              for (const [k, el] of parts) {
                if (el && el.bottom > 800.5) fail(k + ' bottom ' + el.bottom.toFixed(1) + ' is below the 800px fold (hero ' + h.hero.height.toFixed(0) + 'px from y=' + h.hero.top.toFixed(0) + '); report this measured px, do not move other values');
              }
            }
          }
        } else {
          if (h.eyebrows) fail(h.eyebrows + ' [data-nos-hero-eyebrow] in an inner hero (ruling 2026-10-15 Q4: no eyebrow in inner heroes)');
          const firstRun = h.texts.filter((x) => !x.inH1).sort((a, b) => a.y - b.y || a.x - b.x)[0];
          if (firstRun && h.h1 && firstRun.y < h.h1.top - 1) fail('text "' + firstRun.text + '" sits above the h1; inner heroes have no eyebrow');
          if (!stacked) {
            const expMin = Math.min(Math.max(360, 0.32 * w), 460);
            if (!near(h.minHeight, expMin, 1)) fail(`inner hero min-height ${h.minHeight.toFixed(1)}px, want clamp(360px, 32vw, 460px) = ${expMin.toFixed(1)}px`);
          }
        }
      }
      await ctx.close();
    }
  });
});
