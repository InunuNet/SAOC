// F3-R29 archive edition cards (NOS Design R29): typographic, no stock flowers. A card is [data-nos-edition-card] containing, in this
// vertical order: [data-nos-edition-year] (the year in the Fraunces numerals role: Fraunces 300, opsz 72 or 96, lining + tabular numerals,
// size clamp(2.6rem, 2rem + 2vw, 3.8125rem) per index.html:171), then [data-nos-edition-title] (an h3, Fraunces 400), then
// [data-nos-edition-venue] (Karla 400, >=14px). No img, svg, canvas, picture or background-image inside. Card surface (R17/D1): white or gold-100,
// 1px --line border, 16px radius. Asserted on /national-show/archive and on the hub's past-editions section, 1280 and 390.
// HONEST EMPTY STATE (F6): only a published Sanity past show produces a card; there is no static fallback. With no published show there are no cards and
// the page must say so honestly: /archive renders ONE surface with an awaiting-records marker ([data-confirmation-badge]) and an h2, no year link and no
// placeholder card; the hub renders no past-editions section at all (no empty "Past editions" h2, no year link). NOS_EXPECT_PAST_SHOWS=1 (set by the
// gate against a dataset with published past shows) additionally FAILS an empty page, so the card assertions cannot be skipped silently.
import { main, openPage, withBrowser, VP_DESKTOP, VP_PHONE, rgbOf, rgbNear, LINE_RGB, GOLD_100_RGB, opszOf, firstFamily } from './_f3lib.mjs';

const ROUTES = ['/national-show/archive', '/national-show'];
const WHITE = [255, 255, 255];

function measure() {
  const norm = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
  const cards = [...document.querySelectorAll('[data-nos-edition-card]')];
  return cards.map((c) => {
    const pick = (sel) => { const e = c.querySelector(sel); if (!e) return null; const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { tag: e.tagName.toLowerCase(), text: norm(e.textContent), family: s.fontFamily, weight: Number(s.fontWeight), size: parseFloat(s.fontSize), fvs: s.fontVariationSettings, fvn: s.fontVariantNumeric, top: r.top + scrollY }; };
    const cs = getComputedStyle(c);
    const bgImgs = [c, ...c.querySelectorAll('*')].flatMap((e) => [null, '::before', '::after'].map((p) => getComputedStyle(e, p).backgroundImage)).filter((b) => b && /url\(/.test(b));
    return {
      year: pick('[data-nos-edition-year]'), title: pick('[data-nos-edition-title]'), venue: pick('[data-nos-edition-venue]'),
      media: [...c.querySelectorAll('img, svg, canvas, picture, video')].map((e) => e.tagName.toLowerCase()),
      bgImgs: bgImgs.length,
      bg: cs.backgroundColor, borderW: parseFloat(cs.borderTopWidth), borderColor: cs.borderTopColor, borderStyle: cs.borderTopStyle, radius: parseFloat(cs.borderTopLeftRadius),
    };
  });
}

function emptyState() {
  const n = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
  const main = document.querySelector('main');
  const h2s = [...main.querySelectorAll('h2')].map((h) => n(h.textContent));
  return { h2s, badge: !!main.querySelector('[data-confirmation-badge], [data-exhibitor-marker]'), yearLinks: main.querySelectorAll('a[href*="/national-show/archive/"]').length, media: main.querySelectorAll('[data-nos-edition-card]').length };
}

await main('F3-R29 edition-cards', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of ROUTES) {
      for (const [name, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
        const { ctx, page, status } = await openPage(browser, vp, route);
        const tag = `${route} @${name}`;
        if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
        const cards = await page.evaluate(measure);
        if (!cards.length) {
          if (process.env.NOS_EXPECT_PAST_SHOWS === '1') r.fail(`${tag}: NOS_EXPECT_PAST_SHOWS=1 but no [data-nos-edition-card] rendered`);
          const e = await page.evaluate(emptyState);
          if (e.yearLinks) r.fail(`${tag}: no edition cards but ${e.yearLinks} archive year link(s) render`);
          if (route === '/national-show/archive') {
            if (!e.badge) r.fail(`${tag}: honest empty state: no awaiting-records marker ([data-confirmation-badge]) on the empty archive`);
            if (!e.h2s.length) r.fail(`${tag}: honest empty state: no h2 stating the history is awaiting records`);
          } else if (e.h2s.some((t) => /past editions/i.test(t))) r.fail(`${tag}: honest empty state: an empty "Past editions" section renders with no cards (omit the section until a past show is published)`);
          r.note(`${tag}: no published past shows; honest empty state asserted (h2: ${e.h2s.join(' | ').slice(0, 80)})`);
          await ctx.close();
          continue;
        }
        cards.forEach((c, i) => {
          const id = `${tag} card ${i + 1}`;
          for (const k of ['year', 'title', 'venue']) if (!c[k] || !c[k].text) r.fail(`${id}: missing or empty [data-nos-edition-${k}]`);
          if (c.media.length) r.fail(`${id}: card contains ${c.media.join(', ')}; edition cards are typographic`);
          if (c.bgImgs) r.fail(`${id}: card has a background-image`);
          if (c.year) {
            if (!/fraunces/i.test(firstFamily(c.year.family)) || c.year.weight !== 300) r.fail(`${id}: year ${firstFamily(c.year.family)} ${c.year.weight}, want Fraunces 300 (numerals role)`);
            if (![72, 96].includes(opszOf(c.year.fvs))) r.fail(`${id}: year opsz ${opszOf(c.year.fvs)}, want 72 (96 at >=4.75rem)`);
            if (!/lining-nums/.test(c.year.fvn) || !/tabular-nums/.test(c.year.fvn)) r.fail(`${id}: year font-variant-numeric "${c.year.fvn}", want lining-nums tabular-nums`);
            if (c.year.size < 41.6 - 0.6 || c.year.size > 61 + 0.6) r.fail(`${id}: year ${c.year.size}px, want clamp(2.6rem, 2rem + 2vw, 3.8125rem) = 41.6..61px`);
          }
          if (c.title) {
            if (c.title.tag !== 'h3') r.fail(`${id}: title is <${c.title.tag}>, want <h3>`);
            if (!/fraunces/i.test(firstFamily(c.title.family)) || c.title.weight !== 400) r.fail(`${id}: title ${firstFamily(c.title.family)} ${c.title.weight}, want Fraunces 400`);
          }
          if (c.venue && (!/karla/i.test(firstFamily(c.venue.family)) || c.venue.weight !== 400 || c.venue.size < 14 - 0.1)) r.fail(`${id}: venue ${firstFamily(c.venue.family)} ${c.venue.weight} ${c.venue.size}px, want Karla 400 >=14px`);
          if (c.year && c.title && c.venue && !(c.year.top < c.title.top && c.title.top < c.venue.top)) r.fail(`${id}: order is not year, title, venue (tops ${c.year.top.toFixed(0)}, ${c.title.top.toFixed(0)}, ${c.venue.top.toFixed(0)})`);
          const bg = rgbOf(c.bg);
          if (!(rgbNear(bg, WHITE, 1.5) || rgbNear(bg, GOLD_100_RGB, 1.5))) r.fail(`${id}: card ground ${c.bg}, want white or gold-100`);
          if (!(Math.abs(c.borderW - 1) <= 0.1 && c.borderStyle === 'solid' && rgbNear(rgbOf(c.borderColor), LINE_RGB, 1.5))) r.fail(`${id}: border ${c.borderW}px ${c.borderStyle} ${c.borderColor}, want 1px solid --line`);
          if (!(Math.abs(c.radius - 16) <= 0.6)) r.fail(`${id}: radius ${c.radius}px, want 16px`);
        });
        await ctx.close();
      }
    }
  });
});
