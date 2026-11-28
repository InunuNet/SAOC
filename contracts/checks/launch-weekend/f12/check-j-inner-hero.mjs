#!/usr/bin/env node
// F12-A16 - inner hero, template-wide: on every NOS route whose hero is the inner kind, at >=1024 (1024, 1280, 1920, 2056).
// Updated 27 Nov 2026 by nos-hero-consistency (Brad: one locked hero height per breakpoint, the SAOC PageHero system). Every
// expected value is the CSS rule that wins the cascade, not a measurement:
// - photo hero box: height clamp(268px, 20.8vw, 480px) (nos-structure.css, Inner hero sizing, grid-template-rows row 1);
//   a typographic inner hero keeps its content-fit floor, min-height clamp(320px, 22vw, 380px).
// - h1 (nos-structure.css FQ-G1, after nos-theme.css R71): max-width 14ch, clamp(3rem, 1.8rem + 3.2vw, 4.75rem); a long title
//   (.is-long, LT-1) max-width none, clamp(2.5rem, 1.6rem + 2.6vw, 4rem). text-wrap balance (nos-theme.css R71, never overridden).
// - lede: a standfirst fills the copy column, max-width none (nos-theme.css R71); a theme-line lede ([data-nos-lede=theme]) keeps
//   R70's 30ch, and About's theme lede 20em (nos-structure.css .nos-hero-about).
// - The tickets hub masthead (.nk-masthead, nos-structure.css Masthead) is not the NosHero: h1 max-width none,
//   clamp(48px, 4.4vw, 88px), text-wrap balance, min-height 380px.
// - The International Guests and About h1 are two lines or fewer at 1280.
// R71's min-height 380 and clamp(48px,4.4vw,88px) h1, and the 46ch lede, are superseded.
import { main, openPage, withBrowser, NOS_ROUTES, near } from './_lib.mjs';

const WIDTHS = [1024, 1280, 1920, 2056];
const MAX_TWO_LINES = ['/national-show/international-guests', '/national-show/about'];
const ABOUT = '/national-show/about';
const PX_TOLERANCE = 0.6;
const BOX = { min: 268, vw: 0.208, max: 480 };
const TYPO_FLOOR = { min: 320, vw: 0.22, max: 380 };
// clamp(min rem, base rem + vw, max rem) as [min, base, vw, max].
const TITLE = { min: 3, base: 1.8, vw: 0.032, max: 4.75, cap: '14ch' };
const TITLE_LONG = { min: 2.5, base: 1.6, vw: 0.026, max: 4, cap: 'none' };
const MASTHEAD_TITLE = { min: 48, vw: 0.044, max: 88 };
const MASTHEAD_MIN_H = 380;
const THEME_CAP = '30ch';
const ABOUT_THEME_CAP = '20em';

const clamp = (lo, v, hi) => Math.min(hi, Math.max(lo, v));
const clampVw = (c, w) => clamp(c.min, c.vw * w, c.max);
const clampRem = (c, w, rem) => clamp(c.min * rem, c.base * rem + c.vw * w, c.max * rem);

function measure() {
  const hero = document.querySelector('[data-nos-hero="inner"]');
  if (!hero) return { kind: document.querySelector('[data-nos-hero]')?.getAttribute('data-nos-hero') ?? null };
  const cs = (e) => getComputedStyle(e);
  // Resolves a length (14ch, 20em) in an element's own font, so the computed max-width compares exactly.
  const resolve = (el, len) => {
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;display:block;width:${len};`;
    el.appendChild(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  };
  const title = hero.querySelector('h1');
  const lede = hero.querySelector('[data-nos-hero-lede]');
  const box = hero.querySelector('.nos-hero-box');
  const rg = document.createRange();
  rg.selectNodeContents(title);
  const lines = new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size;
  const theme = lede?.getAttribute('data-nos-lede') === 'theme';
  return {
    kind: 'inner',
    rem: parseFloat(cs(document.documentElement).fontSize),
    photo: hero.classList.contains('nos-hero-photo'),
    masthead: Boolean(title.closest('.nk-masthead')),
    mastheadMinH: title.closest('.nk-masthead') ? parseFloat(cs(title.closest('.nk-masthead')).minHeight) : null,
    boxH: box ? box.getBoundingClientRect().height : null,
    minH: parseFloat(cs(hero).minHeight),
    long: title.classList.contains('is-long'),
    title: {
      maxWidth: cs(title).maxWidth, size: parseFloat(cs(title).fontSize),
      wrap: cs(title).textWrapStyle || cs(title).textWrap, lines,
      ch14: resolve(title, '14ch'),
    },
    lede: lede ? {
      theme, maxWidth: cs(lede).maxWidth,
      ch30: resolve(lede, '30ch'), em20: resolve(lede, '20em'),
    } : null,
  };
}

function checkMasthead(r, tag, m, w) {
  const want = clampVw(MASTHEAD_TITLE, w);
  if (!near(m.title.size, want, PX_TOLERANCE)) r.fail(`${tag}: masthead h1 ${m.title.size}px, want clamp(48px,4.4vw,88px) = ${want.toFixed(2)}px`);
  if (m.title.maxWidth !== 'none') r.fail(`${tag}: masthead h1 max-width ${m.title.maxWidth}, want none`);
  if (m.title.wrap !== 'balance') r.fail(`${tag}: masthead h1 text-wrap ${m.title.wrap}, want balance`);
  if (m.mastheadMinH === null || m.mastheadMinH < MASTHEAD_MIN_H) r.fail(`${tag}: masthead min-height ${m.mastheadMinH}px, want ${MASTHEAD_MIN_H}px`);
}

function checkTitle(r, tag, m, w) {
  const spec = m.long ? TITLE_LONG : TITLE;
  const want = clampRem(spec, w, m.rem);
  if (!near(m.title.size, want, PX_TOLERANCE)) {
    r.fail(`${tag}: h1 ${m.title.size}px, want ${m.long ? 'LT-1' : 'FQ-G1'} clamp = ${want.toFixed(2)}px`);
  }
  if (spec.cap === 'none') {
    if (m.title.maxWidth !== 'none') r.fail(`${tag}: long h1 max-width ${m.title.maxWidth}, want none`);
  } else if (!near(parseFloat(m.title.maxWidth), m.title.ch14, PX_TOLERANCE)) {
    r.fail(`${tag}: h1 max-width ${m.title.maxWidth}, want 14ch = ${m.title.ch14.toFixed(1)}px`);
  }
  if (m.title.wrap !== 'balance') r.fail(`${tag}: h1 text-wrap ${m.title.wrap}, want balance`);
}

function checkLede(r, tag, m, route) {
  if (!m.lede) return;
  if (!m.lede.theme) {
    if (m.lede.maxWidth !== 'none') r.fail(`${tag}: lede max-width ${m.lede.maxWidth}, want none (fills the copy column)`);
    return;
  }
  const about = route === ABOUT;
  const want = about ? m.lede.em20 : m.lede.ch30;
  const cap = about ? ABOUT_THEME_CAP : THEME_CAP;
  if (!near(parseFloat(m.lede.maxWidth), want, PX_TOLERANCE)) {
    r.fail(`${tag}: theme lede max-width ${m.lede.maxWidth}, want ${cap} = ${want.toFixed(1)}px`);
  }
}

function checkHeight(r, tag, m, w) {
  if (m.photo) {
    const want = clampVw(BOX, w);
    if (m.boxH === null || !near(m.boxH, want, 1)) {
      r.fail(`${tag}: hero box ${m.boxH?.toFixed(1)}px, want clamp(268px, 20.8vw, 480px) = ${want.toFixed(1)}px`);
    }
    return;
  }
  const floor = clampVw(TYPO_FLOOR, w);
  if (!near(m.minH, floor, 1)) r.fail(`${tag}: typographic hero min-height ${m.minH}px, want clamp(320px, 22vw, 380px) = ${floor.toFixed(1)}px`);
}

await main('F12-A16 inner hero', async (r) => {
  await withBrowser(async (browser) => {
    const probe = await openPage(browser, { width: 1280, height: 800 }, '/national-show/archive');
    const years = await probe.page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/national-show/archive/"]')].map((a) => a.getAttribute('href')))].slice(0, 2));
    await probe.ctx.close();
    let inner = 0;
    for (const route of [...NOS_ROUTES, ...years]) {
      const { ctx, page, status } = await openPage(browser, { width: 1280, height: 800 }, route);
      if (status !== 200) { r.fail(`${route}: HTTP ${status}`); await ctx.close(); continue; }
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.waitForTimeout(150);
        const m = await page.evaluate(measure);
        if (m.kind !== 'inner') break;
        if (w === WIDTHS[0]) inner++;
        const tag = `${route} @${w}`;
        if (m.masthead) {
          checkMasthead(r, tag, m, w);
        } else {
          checkHeight(r, tag, m, w);
          checkTitle(r, tag, m, w);
          checkLede(r, tag, m, route);
        }
        if (w === 1280 && MAX_TWO_LINES.includes(route) && m.title.lines > 2) r.fail(`${tag}: h1 wraps to ${m.title.lines} lines, want at most 2`);
      }
      await ctx.close();
    }
    if (inner < 8) r.fail(`only ${inner} inner-hero routes found, expected at least 8`);
  });
});
