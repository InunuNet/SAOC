// Geometry gate (inner heroes): bloom bottom-left 0-44%, copy from 52%, scrim local to the copy, stacked below 768 (2/1 band on solid
// sage, ruled for SAOC), eyebrow optional, typographic hero on the solid ground for the legal pages and /members.
// DOM contract the dev implements: section[data-page-hero] > a media wrapper [data-page-hero-media] holding the img, an aria-hidden
// [data-hero-scrim="copy"] element, and a copy column [data-page-hero-copy] with [data-page-hero-eyebrow], h1 and optional
// [data-page-hero-lede] and actions. The typographic variant is section[data-page-hero][data-page-hero-variant="type"] with the copy
// column only. The scrim claim is measured on pixels, not on class names: with the text hidden, the hero's left 44% must be identical to
// the photograph painted alone (anything else over the bloom, a full wash included, fails).
import { writeFileSync } from 'node:fs';
import { GOLDEN, SHOT_DIR, T, docRect, freeze, heroBackgroundShot, heroPhotoOnlyShot, launchChromium, meanAbsDiff, meanColor, newContext, openHeroRoute, pixelPage, withServer } from './_lib.mjs';

const WIDE = [{ name: '2056', width: 2056, height: 1200 }, { name: '1440', width: 1440, height: 900 }, { name: '1280', width: 1280, height: 800 }, { name: '1024', width: 1024, height: 800 }, { name: '768', width: 768, height: 1024 }];
const STACKED = [{ name: '767', width: 767, height: 1024 }, { name: '390', width: 390, height: 844 }];
const HERO = 'section[data-page-hero]';
const IMG = `${HERO} img`;
const solid = (rgb) => rgb.every((v, i) => Math.abs(v - T.solidGroundRgb[i]) <= T.solidGroundTolerance);

await withServer(2, 'geometry (saoc)', async (server, c) => {
  const browser = await launchChromium();
  const px = await pixelPage(browser);
  try {
    for (const vp of [...WIDE, ...STACKED]) {
      const stacked = vp.width < T.stackedBelow;
      const context = await newContext(browser, { ...vp, dsf: 1 });
      const page = await context.newPage();
      for (const route of GOLDEN.heroRoutes) {
        const tag = `[saoc ${vp.name} ${route.path}]`;
        const path = await openHeroRoute(page, server, route, c, tag);
        if (!path) continue;
        await freeze(page);
        const type = route.variant === 'type';
        c.check(`${tag} variant marker matches the golden (${type ? 'type' : 'photo'})`, (await page.locator(`${HERO}[data-page-hero-variant="type"]`).count()) === (type ? 1 : 0));
        if (!type) await page.waitForFunction((s) => { const i = document.querySelector(s); return i && i.complete && i.naturalWidth > 0; }, IMG, { timeout: 20000 });
        if (!type) await page.evaluate(async (s) => { await document.querySelector(s).decode(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }, IMG);
        const hero = await docRect(page, HERO);
        c.check(`${tag} has [data-page-hero-copy]`, (await page.locator(`${HERO} [data-page-hero-copy]`).count()) === 1);
        c.check(`${tag} no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        c.check(`${tag} exactly one h1 in the hero`, (await page.locator(`${HERO} h1`).count()) === 1);
        const copy = await page.evaluate((hs) => {
          const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; };
          const parts = {};
          for (const [k, s] of Object.entries({ eyebrow: '[data-page-hero-eyebrow]', h1: 'h1', lede: '[data-page-hero-lede]' })) { const el = document.querySelector(`${hs} ${s}`); if (el) parts[k] = rect(el); }
          parts.copy = rect(document.querySelector(`${hs} [data-page-hero-copy]`));
          const h1 = document.querySelector(`${hs} h1`);
          parts.h1Align = getComputedStyle(h1).textAlign;
          parts.h1Margin = parseFloat(getComputedStyle(h1).marginTop);
          parts.h1Lines = Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight));
          return parts;
        }, HERO);
        c.note(`note: ${tag} h1 lines ${copy.h1Lines}, copy column x ${Math.round(copy.copy.x - hero.x)}..${Math.round(copy.copy.x + copy.copy.w - hero.x)} of ${Math.round(hero.w)}`);
        c.check(`${tag} h1 is left-aligned (not centred)`, ['left', 'start'].includes(copy.h1Align), copy.h1Align);
        // Eyebrow-less hero (SAOC polish F4): no pill, and the h1 carries no top margin. Probed whenever a route renders one.
        if (!copy.eyebrow) { c.check(`${tag} eyebrow-less hero: h1 margin-top 0 (measured ${copy.h1Margin})`, copy.h1Margin === 0); c.note(`note: ${tag} eyebrow-less hero probed`); }
        c.check(`${tag} hero min-height >= 480 (stacked: the band plus the copy)`, stacked || hero.h >= 479);

        if (type) {
          c.check(`${tag} typographic: no img, no media wrapper, no scrim`, (await page.locator(`${IMG}, ${HERO} [data-page-hero-media], ${HERO} [data-hero-scrim]`).count()) === 0);
          const shot = await heroBackgroundShot(page, HERO);
          for (const [fx, fy] of [[0.04, 0.1], [0.5, 0.1], [0.96, 0.5], [0.3, 0.9]]) {
            const rgb = await meanColor(px, shot.b64, { x: fx * hero.w, y: fy * hero.h, w: 6, h: 6 });
            c.check(`${tag} typographic: solid sage ground rgb(${T.solidGroundRgb}) at (${fx},${fy}) (measured ${rgb.map(Math.round)})`, solid(rgb));
          }
          for (const [k, r] of Object.entries(copy)) { if (typeof r === 'object') c.check(`${tag} typographic: ${k} inside the hero`, r.x >= hero.x - 1 && r.x + r.w <= hero.x + hero.w + 1); }
        } else {
          const img = await docRect(page, IMG);
          const media = await docRect(page, `${HERO} [data-page-hero-media]`);
          c.check(`${tag} has [data-page-hero-media]`, Boolean(media));
          c.check(`${tag} the photograph is decorative (alt="" and aria-hidden)`, await page.evaluate((s) => { const i = document.querySelector(s); return i.getAttribute('alt') === '' && i.getAttribute('aria-hidden') === 'true'; }, IMG));
          if (!stacked) {
            c.check(`${tag} photograph is full bleed (img left 0, width = hero width +-1)`, Math.abs(img.x - hero.x) <= 1 && Math.abs(img.w - hero.w) <= 1, JSON.stringify({ img, hero }));
            for (const [k, r] of Object.entries(copy)) {
              if (typeof r !== 'object' || k === 'copy') continue;
              c.check(`${tag} ${k} starts at or right of ${T.copyStart * 100}% of the hero (x ${Math.round(r.x - hero.x)} >= ${Math.round(T.copyStart * hero.w - 1)})`, r.x - hero.x >= T.copyStart * hero.w - 1);
              c.check(`${tag} ${k} stays inside the hero`, r.x + r.w <= hero.x + hero.w + 1);
            }
            c.check(`${tag} the copy column starts at or right of ${T.copyStart * 100}%`, copy.copy.x - hero.x >= T.copyStart * hero.w - 1);
            c.check(`${tag} an aria-hidden [data-hero-scrim="copy"] exists`, (await page.locator(`${HERO} [data-hero-scrim="copy"][aria-hidden="true"]`).count()) === 1);
            const objectPosition = await page.evaluate((s) => getComputedStyle(document.querySelector(s)).objectPosition, IMG);
            if (route.position === 'pending' || route.position === 'gap') c.note(`note: ${tag} crop is an open gap for NOS Design (10-26); HM-2/HM-3/overflow only; rendered object-position ${objectPosition}`);
            else c.check(`${tag} rendered object-position ${objectPosition} equals the ruled ${route.position}`, objectPosition === route.position);
            const normal = await heroBackgroundShot(page, HERO);
            const photo = await heroPhotoOnlyShot(page, HERO, 'img');
            const diff = await meanAbsDiff(px, normal.b64, photo.b64, { x0: 0, x1: T.bloomCleanZoneEnd, y0: 0, y1: 1 });
            c.check(`${tag} bloom side (left ${T.bloomCleanZoneEnd * 100}%) is the bare photograph: mean abs diff ${diff.toFixed(2)} <= ${T.cleanZoneMeanAbsDiffMax}`, diff <= T.cleanZoneMeanAbsDiffMax);
          } else {
            const clientW = await page.evaluate(() => document.documentElement.clientWidth); // html{scrollbar-gutter:stable} (#92) reserves 15px at 767 and 390
            c.check(`${tag} stacked: the photograph band spans the viewport width (+-1) (clientWidth ${clientW})`, Math.abs(img.w - clientW) <= 1, `${img.w}`);
            c.check(`${tag} stacked: band height = width / ${T.bandAspect} +-${T.bandAspectTolerancePx}px (${Math.round(img.w / T.bandAspect)})`, Math.abs(img.h - img.w / T.bandAspect) <= T.bandAspectTolerancePx, `${img.h}`);
            c.check(`${tag} stacked: the band sits at the top of the hero`, Math.abs(img.y - hero.y) <= 1);
            for (const [k, r] of Object.entries(copy)) {
              if (typeof r !== 'object' || k === 'copy') continue;
              c.check(`${tag} stacked: ${k} is below the band`, r.y >= img.y + img.h - 1, `${Math.round(r.y)} vs ${Math.round(img.y + img.h)}`);
            }
            const normal = await heroBackgroundShot(page, HERO);
            const photo = await heroPhotoOnlyShot(page, HERO, 'img');
            const diff = await meanAbsDiff(px, normal.b64, photo.b64, { x0: 0, x1: 1, y0: 0, y1: img.h / hero.h });
            c.check(`${tag} stacked: nothing but the photograph over the band: mean abs diff ${diff.toFixed(2)} <= ${T.cleanZoneMeanAbsDiffMax}`, diff <= T.cleanZoneMeanAbsDiffMax);
            const rgb = await meanColor(px, normal.b64, { x: 4, y: Math.round(img.y + img.h - hero.y + 4), w: 8, h: 8 });
            c.check(`${tag} stacked: copy sits on the solid sage ground rgb(${T.solidGroundRgb}) +-${T.solidGroundTolerance} (measured ${rgb.map(Math.round)})`, solid(rgb));
          }
        }
        if (GOLDEN.viewports.shots.includes(vp.name)) {
          const file = `${SHOT_DIR}/${route.path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'}-${vp.name}.png`;
          writeFileSync(file, await page.screenshot({ fullPage: true, clip: { x: hero.x, y: hero.y, width: hero.w, height: hero.h } }));
        }
      }
      await context.close();
    }
  } finally { await px.close(); await browser.close(); }
});
