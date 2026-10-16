// F3-R29 imagery (NOS Design R29). Each of the five rights-cleared stock photos is used at most once across ALL NOS routes, on the route
// goldens/f3/hero-photo-map.json assigns it (assignment pending NOS Design confirmation: a swap is a one-line edit of that golden).
// Tickets has no hero photo: variant "fan", royal ground, [data-nos-ticket-fan] whose own photos are exempt (accepted R16 exception).
// Every other route (inner pages, vendors sub-pages, archive years) has a TYPOGRAPHIC hero: <section data-nos-hero="inner" data-nos-hero-variant="type">
// on a solid #0B0A14 ground, h1 and standfirst on the same grid (same left edge, and that edge is the 1080px container's content edge, F3-C1),
// no image, svg, canvas, picture, background-image or scrim. Photo heroes carry data-nos-hero-variant="photo". Edition cards carry no photo.
// The emblem is never a photo substitute. No stock flower anywhere else: not in <img>, not in CSS backgrounds, not in preloads.
// Measured over every route (17 + archive years + public vendor sub-routes) at 1280 and 1440 (grid) and 390.
import { allRoutes, assetPath, STOCK_PHOTO_RE, readGolden, main, openPage, withBrowser, VP_DESKTOP, VP_PHONE, rgbOf, rgbNear, BLACK_RGB, ROYAL_RGB } from './_f3lib.mjs';

function measure() {
  const hero = document.querySelector('[data-nos-hero]');
  const R = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top + scrollY, width: r.width }; };
  const imgs = [...document.querySelectorAll('img, source')].filter((e) => !e.closest('#nh, #nd, #nf')).map((e) => ({
    src: e.getAttribute('src') ?? e.getAttribute('srcset') ?? '',
    cur: e.currentSrc || '',
    inHero: !!e.closest('[data-nos-hero]'),
    inCard: !!e.closest('[data-nos-edition-card]'),
    inFan: !!e.closest('[data-nos-ticket-fan]'),
    inTicketCard: (() => { for (let x = e.parentElement, i = 0; x && x !== document.body && i < 8; x = x.parentElement, i++) if ([...x.querySelectorAll('a, button')].some((c) => /^(add to booking|buy ticket)/i.test((c.textContent ?? '').trim()))) return true; return false; })(),
    pos: e.tagName === 'IMG' ? getComputedStyle(e).objectPosition : null,
    alt: e.getAttribute('alt') ?? null,
    tag: e.tagName.toLowerCase(),
  }));
  const bgs = [];
  for (const e of document.querySelectorAll('main *')) {
    if (e.closest('#nh, #nd, #nf')) continue;
    for (const p of [null, '::before', '::after']) {
      const bi = getComputedStyle(e, p).backgroundImage;
      if (bi && /url\(/.test(bi)) bgs.push({ bi, inHero: !!e.closest('[data-nos-hero]'), inCard: !!e.closest('[data-nos-edition-card]') });
    }
  }
  const heroMedia = hero ? [...hero.querySelectorAll('img, svg, canvas, picture, video, [data-nos-hero-media]')].map((e) => e.tagName.toLowerCase()) : [];
  const heroGrad = [];
  if (hero) for (const e of [hero, ...hero.querySelectorAll('*')]) for (const p of [null, '::before', '::after']) {
    const s = getComputedStyle(e, p);
    if (p && (s.content === 'none' || s.content === 'normal')) continue;
    if (/gradient/.test(s.backgroundImage)) heroGrad.push(e.tagName.toLowerCase());
  }
  const h1 = hero?.querySelector('h1');
  const lede = hero?.querySelector('[data-nos-hero-lede]');
  const wrap = document.querySelector('main [data-nos-wrap]');
  const wcs = wrap ? getComputedStyle(wrap) : null;
  // Rendered references only (<img>/<picture><source> sources and image preloads). The serialized document also carries the RSC flight payload and
  // not-found shell as <script> text, which names the photo map without rendering any photo, so it is not counted.
  const rendered = [...document.querySelectorAll('img, source, link[rel="preload"][as="image"]')].filter((e) => !e.closest('#nh, #nd, #nf')).map((e) => [e.getAttribute('src'), e.getAttribute('srcset'), e.getAttribute('imagesrcset'), e.getAttribute('href')].filter(Boolean).join(' ')).join(' ');
  return {
    vw: document.documentElement.clientWidth,
    variant: hero?.getAttribute('data-nos-hero-variant') ?? null,
    kind: hero?.getAttribute('data-nos-hero') ?? null,
    bg: hero ? getComputedStyle(hero).backgroundColor : null,
    imgs, bgs, heroMedia, heroGrad,
    h1Left: h1 ? R(h1).left : null,
    ledeLeft: lede ? R(lede).left : null,
    wrapContentLeft: wrap ? R(wrap).left + parseFloat(wcs.paddingLeft) : null,
    hasFan: !!document.querySelector('[data-nos-hero] [data-nos-ticket-fan]'),
    orchidInHtml: (decodeURIComponent(rendered).match(/orchid-(dark|pink|purple|violet|yellow)/gi) ?? []).length,
    emblems: [...document.querySelectorAll('main img, main svg[role="img"], main svg[aria-label]')].filter((e) => /emblem|eulophia|disa-?graminifolia/i.test([e.getAttribute('src'), e.getAttribute('alt'), e.getAttribute('aria-label')].join(' ')) && (e.closest('[data-nos-hero]') || e.closest('[data-nos-edition-card]'))).length,
  };
}

await main('F3-R29 imagery', async (r) => {
  const golden = readGolden('hero-photo-map.json');
  const map = golden.routes;
  const fans = golden.fanRoutes;
  const photoOwner = new Map(Object.entries(map).map(([route, src]) => [src, route]));
  if (photoOwner.size !== Object.keys(map).length) r.fail('hero-photo-map.json assigns one photo to two routes');
  const seen = new Map(); // asset path -> routes it appears on
  await withBrowser(async (browser) => {
    const routes = await allRoutes(browser);
    for (const route of routes) {
      for (const [name, vp] of [['1280', VP_DESKTOP], ['1440', { width: 1440, height: 900 }], ['390', VP_PHONE]]) {
        const { ctx, page, status } = await openPage(browser, vp, route);
        const tag = `${route} @${name}`;
        if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
        const m = await page.evaluate(measure);
        const assigned = map[route] ?? null;
        // Ticket product cards (shared TicketTypeCard) carry a per-ticket stock photo; they are exempt ONLY when NOS Design ruled so (golden ticketCardPhotos.exempt).
        const cardExempt = golden.ticketCardPhotos?.exempt === true && (golden.ticketCardPhotos.routes ?? []).includes(route);
        const photos = m.imgs.filter((i) => !i.inFan && !(cardExempt && i.inTicketCard)).map((i) => assetPath(i.cur || i.src)).filter((p) => STOCK_PHOTO_RE.test(p));
        const photoSet = [...new Set(photos)];
        if (name === '1280') for (const p of photoSet) seen.set(p, [...(seen.get(p) ?? []), route]);
        if (photoSet.length > 1) r.fail(`${tag}: ${photoSet.length} different stock photos on one route (${photoSet.join(', ')}); a route uses at most one`);
        for (const p of photoSet) if (photoOwner.get(p) !== route) r.fail(`${tag}: stock photo ${p} appears here but is assigned to ${photoOwner.get(p) ?? 'no route'}`);
        if (m.bgs.some((b) => STOCK_PHOTO_RE.test(b.bi))) r.fail(`${tag}: a stock photo is used as a CSS background-image`);
        // Tickets accepts variant "fan" (royal ground + [data-nos-ticket-fan]) or "type" (typographic like every other route); the v13 fan is deferred to F5.
        if (fans.includes(route) && !['fan', 'type'].includes(m.variant ?? '')) r.fail(`${tag}: ticket hero variant "${m.variant}", want "fan" or "type"`);
        if (fans.includes(route) && m.variant === 'fan') {
          // Tickets: royal ground with the ticket fan; no hero photo. The fan's own product photos are exempt (accepted R16 exception).
          if (!rgbNear(rgbOf(m.bg ?? ''), ROYAL_RGB, 1)) r.fail(`${tag}: ticket hero ground ${m.bg}, want solid royal rgb(33, 26, 87)`);
          if (m.imgs.some((i) => i.inHero && !i.inFan)) r.fail(`${tag}: ticket hero has a photo outside the fan`);
          if (photoSet.length) r.fail(`${tag}: stock photo outside the ticket fan (${photoSet.join(', ')})`);
          if (!m.hasFan) r.fail(`${tag}: no [data-nos-ticket-fan] in the hero`);
          await ctx.close();
          continue;
        }
        if (m.imgs.some((i) => i.inCard)) r.fail(`${tag}: an <img> sits inside an edition card; archive edition cards are typographic`);
        if (m.bgs.some((b) => b.inCard)) r.fail(`${tag}: an edition card has a background image`);
        if (m.emblems) r.fail(`${tag}: the emblem is used inside a hero or edition card as a photo substitute`);
        if (name === '1280' && golden.objectPosition?.[route]) {
          const heroImg = m.imgs.find((i) => i.inHero && i.tag === 'img');
          if (heroImg?.pos !== golden.objectPosition[route]) r.fail(`${tag}: hero photo object-position "${heroImg?.pos}", want "${golden.objectPosition[route]}"`);
        }
        if (!m.variant) r.fail(`${tag}: [data-nos-hero] has no data-nos-hero-variant ("photo" or "type")`);
        if (assigned) {
          if (m.variant !== 'photo') r.fail(`${tag}: this route owns ${assigned} but its hero variant is "${m.variant}", want "photo"`);
          const heroPhotos = m.imgs.filter((i) => i.inHero).map((i) => assetPath(i.cur || i.src));
          if (!heroPhotos.some((p) => p === assigned)) r.fail(`${tag}: hero photo is ${JSON.stringify(heroPhotos)}, want ${assigned}`);
        } else {
          if (m.variant !== 'type') r.fail(`${tag}: no photo is assigned, so the hero must be typographic (variant "${m.variant}")`);
          if (m.orchidInHtml && !(cardExempt && m.imgs.filter((i) => !i.inTicketCard).every((i) => !STOCK_PHOTO_RE.test(assetPath(i.cur || i.src))))) r.fail(`${tag}: ${m.orchidInHtml} rendered <img>/<picture>/preload reference(s) to a stock photo on a route with no photo`);
        }
        if (m.variant === 'type') {
          if (m.kind !== 'inner') r.fail(`${tag}: typographic hero must be data-nos-hero="inner", is "${m.kind}"`);
          if (!rgbNear(rgbOf(m.bg ?? ''), BLACK_RGB, 1)) r.fail(`${tag}: typographic hero ground ${m.bg}, want solid rgb(11, 10, 20)`);
          if (m.heroMedia.length) r.fail(`${tag}: typographic hero contains ${m.heroMedia.join(', ')}; no image or media element`);
          if (m.imgs.some((i) => i.inHero) || m.bgs.some((b) => b.inHero)) r.fail(`${tag}: typographic hero has an image or background-image`);
          if (m.heroGrad.length) r.fail(`${tag}: typographic hero has a gradient (${m.heroGrad.join(', ')}); no scrim without a photo`);
          if (m.h1Left == null) r.fail(`${tag}: typographic hero has no h1`);
          else {
            if (m.ledeLeft != null && Math.abs(m.h1Left - m.ledeLeft) > 1) r.fail(`${tag}: h1 left ${m.h1Left.toFixed(1)} and standfirst left ${m.ledeLeft.toFixed(1)} are not on the same grid`);
            // RETIRED by launch-weekend F17 (goldens/f17/supersession.json; F12-A15 is the axis authority): the 1080px container content-edge test.
            // R71 moved the shared container to the NOS header axis (1320 + 2*gutter); the check below still proves hero and section share one edge.
            if (m.wrapContentLeft != null && Math.abs(m.h1Left - m.wrapContentLeft) > 1) r.fail(`${tag}: h1 left ${m.h1Left.toFixed(1)} differs from the first [data-nos-wrap] content edge ${m.wrapContentLeft.toFixed(1)}`);
          }
        }
        await ctx.close();
      }
    }
  });
  for (const [p, routes] of seen) if (routes.length > 1) r.fail(`stock photo ${p} appears on ${routes.length} routes: ${routes.join(', ')}`);
  for (const [route, src] of Object.entries(map)) if (!(seen.get(src) ?? []).includes(route)) r.fail(`${route}: assigned photo ${src} was not found on the route`);
});
