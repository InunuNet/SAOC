// F1c hero-band gate shared by A2 (768, 1440, 2056) and A8 (1024, 1280). NOS Design ruling HM-8 (final):
// the 480 +-4 lock applies ONLY to photographic heroes (/about, /judging, /sponsors: a route with a hero image). Typographic heroes size to content from 1024:
// band = copy block + 2 x clamp(64px, 6vw, 96px) +-2. Below 1024 a typographic hero keeps its 480 minimum, so 768 is unchanged (all 8 routes 480 +-4).
// Also at every gated width >=1024: photographic h1.left is one axis (+-1) across routes; a typographic h1 sits on the breadcrumb's left (+-1).
import { openPage, check, societyDetail, INNER_ROUTES } from './lib.mjs';
export const PHOTO_ROUTES = ['/about', '/judging', '/sponsors'];
export const TYPE_ROUTES = INNER_ROUTES.filter((r) => !PHOTO_ROUTES.includes(r));
// Typographic routes named in the ruling that are not in INNER_ROUTES: /404 (status 404), /events/submit, the first /societies/[slug]. Gated from 1024 only.
export const NOT_FOUND = '/this-page-does-not-exist-sdc';
const LOCK = 480; const LOCK_TOL = 4; const BAND_TOL = 2;
export const bandPadding = (w) => Math.min(96, Math.max(64, 0.06 * w));
const PROBE = `() => { const h = document.querySelector('[data-page-hero]'); if (!h) return null; const copy = h.querySelector('[data-page-hero-copy]'); const c = getComputedStyle(copy); const h1 = h.querySelector('h1'); const bc = document.querySelector('nav[aria-label="Breadcrumb"] a');
  return { h: h.getBoundingClientRect().height, copyH: copy.getBoundingClientRect().height, variant: h.dataset.pageHeroVariant === 'type' ? 'type' : 'photo', pad: c.paddingTop + '/' + c.paddingBottom, h1Left: h1 ? h1.getBoundingClientRect().left : null, bcLeft: bc ? bc.getBoundingClientRect().left : null, vw: innerWidth }; }`;

export async function gateWidths({ base, browser, ctxOpts }, widths) {
  const society = await societyDetail(base);
  for (const width of widths) {
    const wide = width >= 1024; const routes = [...INNER_ROUTES, ...(wide ? ['/events/submit', ...(society ? [society] : []), NOT_FOUND] : [])];
    const rows = [];
    for (const path of routes) {
      const { page, ctx, status } = await openPage(browser, ctxOpts, base, path, width); const w = `${path}@${width}`;
      check(status === (path === NOT_FOUND ? 404 : 200), `${w} status ${status}`);
      const r = await page.evaluate(`(${PROBE})()`);
      check(r !== null, `${w}: no [data-page-hero]`);
      if (r) rows.push({ path, ...r });
      await ctx.close();
    }
    const photo = rows.filter((x) => PHOTO_ROUTES.includes(x.path)); const type = rows.filter((x) => !PHOTO_ROUTES.includes(x.path));
    for (const x of photo) check(x.variant === 'photo', `${x.path}@${width}: expected a photographic hero, got the typographic variant`);
    if (wide) for (const x of type) check(x.variant === 'type', `${x.path}@${width}: expected a typographic hero, got a photographic one`);
    if (!wide) { // 768: unchanged, every route (typographic included) 480 +-4, one copy padding
      const hs = rows.map((x) => x.h); const list = rows.map((x) => `${x.path}=${x.h.toFixed(0)}`).join(' ');
      check(Math.max(...hs) - Math.min(...hs) <= LOCK_TOL, `@${width}: hero heights differ by ${(Math.max(...hs) - Math.min(...hs)).toFixed(0)}px (${list}), want <=${LOCK_TOL}`);
      for (const x of rows) check(Math.abs(x.h - LOCK) <= LOCK_TOL, `${x.path}@${width}: ${x.h.toFixed(0)}px, locked value is ${LOCK}`);
      check(new Set(rows.map((x) => x.pad)).size === 1, `@${width}: copy padding differs between routes (${[...new Set(rows.map((x) => x.pad))].join(' | ')}); height must not be equalised by padding`);
      continue;
    }
    console.log(`REPORT @${width}: ${rows.map((x) => `${x.path}=${x.h.toFixed(0)}(${x.variant})`).join(' ')}`);
    for (const x of photo) check(Math.abs(x.h - LOCK) <= LOCK_TOL, `${x.path}@${width}: photographic hero is ${x.h.toFixed(0)}px, locked value is ${LOCK} +-${LOCK_TOL}`);
    check(new Set(photo.map((x) => x.pad)).size === 1, `@${width}: photographic copy padding differs between routes (${[...new Set(photo.map((x) => x.pad))].join(' | ')})`);
    for (const x of type) { const want = x.copyH + 2 * bandPadding(x.vw); check(Math.abs(x.h - want) <= BAND_TOL, `${x.path}@${width}: typographic band is ${x.h.toFixed(1)}px, want copy ${x.copyH.toFixed(1)} + 2 x ${bandPadding(x.vw).toFixed(1)} = ${want.toFixed(1)} +-${BAND_TOL}`); }
    const pl = photo.map((x) => x.h1Left); if (pl.length) check(Math.max(...pl) - Math.min(...pl) <= 1, `@${width}: photographic h1.left differs across routes (${photo.map((x) => `${x.path}=${x.h1Left.toFixed(1)}`).join(' ')}), want one axis +-1`);
    for (const x of type) if (x.bcLeft !== null) check(Math.abs(x.h1Left - x.bcLeft) <= 1, `${x.path}@${width}: h1.left ${x.h1Left.toFixed(1)} is off the breadcrumb axis ${x.bcLeft.toFixed(1)}`);
    const tl = type.map((x) => x.h1Left); check(Math.max(...tl) - Math.min(...tl) <= 1, `@${width}: typographic h1.left differs across routes (${type.map((x) => `${x.path}=${x.h1Left.toFixed(1)}`).join(' ')})`);
  }
}
