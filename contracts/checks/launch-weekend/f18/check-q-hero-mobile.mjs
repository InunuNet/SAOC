#!/usr/bin/env node
// F18-A25 (R80 #1, F18b/c): the NOS hub hero below 768. At 390x844: the photograph [data-nos-hero-media] comes first (above the h1), 260 to 340px high, object-position kept on the bloom (64% 50%),
// then h1, lede, the Tickets button fully above the fold (bottom <= 844), then the countdown, then the facts, in that vertical order; no horizontal overflow; the first and second hero buttons are
// still "Tickets" and "Plan your visit". Guards: at 768x1024 the hub hero keeps the F3 copy-first stack (the media after the title), and at 1280 the hero is the F12 overlay (media behind the copy).
// Inner photo heroes (every [data-nos-hero="inner"][data-nos-hero-variant="photo"] route found on the NOS routes) are measured at 390: the h1 top stays inside the first 70% of the viewport and nothing overflows.
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-q-hero-mobile.mjs
import { main, openPage, withBrowser, T, NOS_ROUTES } from './_lib.mjs';

const H = T.heroMobile;

function hub() {
  const hero = document.querySelector('[data-nos-hero="hub"]');
  if (!hero) return { error: 'no hub hero' };
  const top = (e) => (e ? e.getBoundingClientRect().top + scrollY : null);
  const bottom = (e) => (e ? e.getBoundingClientRect().bottom + scrollY : null);
  const media = hero.querySelector('[data-nos-hero-media]');
  const img = media?.querySelector('img');
  const buttons = [...hero.querySelectorAll('[data-nos-hero-button]')];
  return {
    mediaTop: top(media), mediaH: media ? media.getBoundingClientRect().height : null, mediaPos: media ? getComputedStyle(media).position : null,
    pos: img ? getComputedStyle(img).objectPosition : null,
    titleTop: top(hero.querySelector('.nos-hero-title')), ledeTop: top(hero.querySelector('[data-nos-hero-lede], .nos-hero-lede')),
    ticketsBottom: bottom(buttons[0]), ticketsTop: top(buttons[0]), cdTop: top(hero.querySelector('[data-nos-hero-text="countdown-opens-in"]')), factsTop: top(hero.querySelector('.nos-hero-facts')),
    labels: buttons.map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase()),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}

await main('F18-A25 hub hero image-first below 768', async (r) => {
  await withBrowser(async (browser) => {
    const { ctx, page, status } = await openPage(browser, { width: H.viewport[0], height: H.viewport[1] }, '/national-show');
    if (status !== 200) { r.fail(`/national-show: HTTP ${status}`); await ctx.close(); return; }
    let m = await page.evaluate(hub);
    if (m.error) r.fail(`@390: ${m.error}`);
    else {
      if (m.mediaTop === null) r.fail('@390: no [data-nos-hero-media] in the hub hero');
      else {
        if (!(m.mediaTop < m.titleTop)) r.fail(`@390: the photograph (top ${Math.round(m.mediaTop)}) is not above the h1 (top ${Math.round(m.titleTop)})`);
        if (m.mediaH < H.mediaMinPx || m.mediaH > H.mediaMaxPx) r.fail(`@390: the photograph is ${Math.round(m.mediaH)}px high, want ${H.mediaMinPx}-${H.mediaMaxPx}`);
        if (m.pos !== H.objectPosition) r.fail(`@390: object-position is "${m.pos}", want "${H.objectPosition}" (the bloom)`);
      }
      const seq = [['title', m.titleTop], ['lede', m.ledeTop], ['tickets', m.ticketsTop], ['countdown', m.cdTop], ['facts', m.factsTop]];
      for (let i = 1; i < seq.length; i += 1) if (seq[i][1] === null || seq[i - 1][1] === null || seq[i][1] < seq[i - 1][1]) r.fail(`@390: vertical order broken at ${seq[i - 1][0]} -> ${seq[i][0]} (${seq.map((s) => `${s[0]}:${s[1] === null ? 'null' : Math.round(s[1])}`).join(', ')})`);
      if (m.ticketsBottom > H.viewport[1]) r.fail(`@390: the Tickets button ends at y=${Math.round(m.ticketsBottom)}, below the fold (${H.viewport[1]})`);
      if (m.labels[0] !== 'tickets' || m.labels[1] !== 'plan your visit') r.fail(`@390: hero buttons are [${m.labels.join(', ')}]`);
      if (m.overflow > 1) r.fail(`@390: horizontal overflow ${m.overflow}px`);
    }
    await page.setViewportSize({ width: H.stackedAt768[0], height: H.stackedAt768[1] });
    await page.waitForTimeout(250);
    m = await page.evaluate(hub);
    if (!m.error && m.mediaTop !== null && !(m.mediaTop > m.titleTop)) r.fail('@768: the F3 copy-first stack changed (the media must stay after the copy from 768 to 1023)');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(250);
    m = await page.evaluate(hub);
    if (!m.error && m.mediaPos === 'relative') r.fail('@1280: the hero media is no longer the absolute overlay (F12 hero changed)');
    await ctx.close();

    for (const route of NOS_ROUTES.filter((x) => x !== '/national-show')) {
      const p = await openPage(browser, { width: 390, height: 844 }, route);
      if (p.status === 200) {
        const i = await p.page.evaluate(() => {
          const h = document.querySelector('[data-nos-hero="inner"][data-nos-hero-variant="photo"]');
          if (!h) return null;
          return { h1: (document.querySelector('main h1')?.getBoundingClientRect().top ?? 0) + scrollY, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        if (i) {
          if (i.h1 > 844 * H.innerPhotoH1MaxTopFraction) r.fail(`${route} @390: the photo hero pushes the h1 to y=${Math.round(i.h1)} (> ${Math.round(844 * H.innerPhotoH1MaxTopFraction)})`);
          if (i.overflow > 1) r.fail(`${route} @390: horizontal overflow ${i.overflow}px`);
        }
      }
      await p.ctx.close();
    }
  });
});
