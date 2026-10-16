#!/usr/bin/env node
// F12-A6 - R70 symposium: h1 and title, theme-line lede (styled), body theme section, hero geometry, jump link gone.
import { main, openPage, withBrowser, VP, V, COPY, BONE, rgbOf, rgbNear, near, norm, firstFamily, px } from './_lib.mjs';

const S = V.symposium;
const ROUTE = '/national-show/symposium';
const QUOTES = /["“”„‟″«»]/;

function measure(wantDescription) {
  const q = (s, r = document) => r.querySelector(s);
  const cs = (e) => getComputedStyle(e);
  const t = (e) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const hero = q('[data-nos-hero]');
  if (!hero) return { error: 'no hero' };
  const h1 = q('h1', hero), lede = q('[data-nos-hero-lede]', hero);
  const main = q('main') ?? document.body;
  const chFn = (el, n) => {
    const c = cs(el);
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;width:${n}ch;font-family:${c.fontFamily};font-size:${c.fontSize};font-weight:${c.fontWeight};font-style:${c.fontStyle};`;
    el.parentElement.appendChild(d);
    const w = d.getBoundingClientRect().width;
    d.remove();
    return w;
  };
  // lines of the h1: group word rects by top
  const words = [];
  const tw = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const re = /\S+/g; let m;
    while ((m = re.exec(n.textContent))) { const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length); words.push({ w: m[0], top: Math.round(rg.getBoundingClientRect().top) }); }
  }
  const lineTops = [...new Set(words.map((x) => x.top))];
  const lastLineWords = words.filter((x) => x.top === lineTops[lineTops.length - 1]).length;
  const hcs = cs(h1), hero_cs = cs(hero);
  const state = q('[data-nos-content-state]')?.getAttribute('data-nos-content-state') ?? null;
  const themeSec = q('[data-section-key="theme"]');
  const themeH2 = themeSec ? q('h2', themeSec) : null;
  const themeText = themeSec ? [...themeSec.querySelectorAll('p, li')].filter((e) => !e.closest('.nos-show-page-notice')).map(t).join(' ') : null;
  const belowHero = [...main.querySelectorAll('*')].filter((e) => !hero.contains(e) && !e.closest('header, footer, nav[aria-label$=" pages"]')).map((e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')).join(' ').replace(/\s+/g, ' ');
  const metaOf = (sel) => document.querySelector(sel)?.getAttribute('content') ?? null;
  return {
    vw: innerWidth, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    title: document.title, ogTitle: metaOf('meta[property="og:title"]'), twTitle: metaOf('meta[name="twitter:title"]'), ogImage: metaOf('meta[property="og:image"]'),
    h1: t(h1), h1Lines: lineTops.length, lastLineWords, h1MaxW: hcs.maxWidth, h1Wrap: hcs.textWrapStyle || hcs.textWrap,
    heroKind: hero.getAttribute('data-nos-hero'), heroMinH: parseFloat(hero_cs.minHeight), heroH: hero.getBoundingClientRect().height,
    lede: lede ? { text: t(lede), family: cs(lede).fontFamily, style: cs(lede).fontStyle, size: parseFloat(cs(lede).fontSize), lh: parseFloat(cs(lede).lineHeight), maxW: parseFloat(cs(lede).maxWidth), ch30: chFn(lede, 30), color: cs(lede).color } : null,
    heroText: t(hero),
    jump: { byText: [...document.querySelectorAll('a, button')].filter((e) => /^Presenters \(\d+\)$/.test(t(e))).length, cls: document.querySelectorAll('.pc-jump, .pc-jump-link').length, anchors: document.querySelectorAll('a[href^="#presenters-"]').length },
    state, theme: themeSec ? { h2: t(themeH2), text: themeText } : null,
    capitalH2: [...main.querySelectorAll('h2')].some((h) => t(h) === 'Symposium Theme'),
    belowHeroHasThemeLine: belowHero.includes(wantDescription.themeLine),
  };
}

await main('F12-A6 symposium', async (r) => {
  await withBrowser(async (browser) => {
    const { ctx, page, status } = await openPage(browser, VP.desktop, ROUTE);
    if (status !== 200) { r.fail(`${ROUTE}: HTTP ${status}`); await ctx.close(); return; }
    let reportedState = false;
    for (const vp of [VP.desktop, VP.wide, { width: 1440, height: 900 }, { width: 1024, height: 768 }, VP.phone]) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(250);
      const m = await page.evaluate(measure, { themeLine: COPY.themeLine.text });
      const tag = `@${vp.width}`;
      if (m.error) { r.fail(`${tag}: ${m.error}`); continue; }
      if (m.overflowX > 1) r.fail(`${tag}: horizontal overflow ${m.overflowX}px`);
      if (m.h1 !== S.h1) r.fail(`${tag}: h1 "${m.h1}", want exactly "${S.h1}"`);
      for (const [k, v] of [['<title>', m.title], ['og:title', m.ogTitle], ['twitter:title', m.twTitle], ['og:image', m.ogImage ? decodeURIComponent(m.ogImage.replace(/\+/g, ' ')) : null]]) {
        if (v && v.includes(S.removedTitleText)) r.fail(`${tag}: ${k} still says "${S.removedTitleText}": ${v}`);
      }
      if (!m.title.includes(S.h1)) r.fail(`${tag}: <title> "${m.title}" lacks "${S.h1}"`);
      if (m.heroText.includes(S.removedLede)) r.fail(`${tag}: the Purpose-line lede is still in the hero`);
      if (!m.lede) r.fail(`${tag}: no [data-nos-hero-lede]`);
      else {
        const l = m.lede;
        if (l.text !== COPY.themeLine.text) r.fail(`${tag}: lede "${l.text}", want the theme line verbatim`);
        if (QUOTES.test(l.text)) r.fail(`${tag}: lede contains a quote character`);
        if (!/fraunces/i.test(firstFamily(l.family)) || l.style !== 'italic') r.fail(`${tag}: lede ${firstFamily(l.family)} ${l.style}, want Fraunces italic`);
        const wantSize = Math.min(S.ledeSizeMaxPx, Math.max(S.ledeSizeMinPx, (S.ledeSizeVw / 100) * vp.width));
        if (!near(l.size, wantSize, 0.4)) r.fail(`${tag}: lede ${l.size}px, want clamp(22px,2vw,30px) = ${wantSize.toFixed(2)}px`);
        if (!near(l.lh, S.ledeLineHeight * l.size, 0.4)) r.fail(`${tag}: lede line-height ${l.lh}px, want 1.3 = ${(S.ledeLineHeight * l.size).toFixed(2)}px`);
        if (!near(l.maxW, l.ch30, 1.5)) r.fail(`${tag}: lede max-width ${l.maxW}px, want 30ch = ${l.ch30.toFixed(1)}px`);
        if (!rgbNear(rgbOf(l.color), BONE)) r.fail(`${tag}: lede colour ${l.color}, want --bone`);
      }
      if (m.jump.byText || m.jump.cls || m.jump.anchors) r.fail(`${tag}: the "Presenters (N)" jump link is still rendered (${JSON.stringify(m.jump)})`);
      if (m.belowHeroHasThemeLine) r.fail(`${tag}: the theme line is still in the body below the hero (it moved to the hero)`);
      if (m.capitalH2) r.fail(`${tag}: an h2 still reads "Symposium Theme" (want "${S.themeH2}")`);
      if (vp.width >= S.heroMinHeightFromWidth) {
        if (m.heroMinH < S.heroMinHeight - 0.5 || m.heroH < S.heroMinHeight - 0.5) r.fail(`${tag}: inner hero min-height ${m.heroMinH}px, height ${m.heroH.toFixed(0)}px, want >= 380px`);
        if (m.h1MaxW !== 'none') r.fail(`${tag}: inner h1 max-width ${m.h1MaxW}, want none at >=1024`);
        if (m.h1Wrap !== 'balance') r.fail(`${tag}: inner h1 text-wrap ${m.h1Wrap}, want balance`);
        if (m.h1Lines > 1 && m.lastLineWords < 2) r.fail(`${tag}: h1 wraps with a single word alone on the last line (${m.h1Lines} lines)`);
      }
      if (!reportedState) {
        reportedState = true;
        r.note(`content state: ${m.state}`);
        if (m.state === 'published') {
          if (!m.theme) r.fail(`published but no [data-section-key="theme"] section`);
        }
      }
      if (m.theme) {
        if (m.theme.h2 !== S.themeH2) r.fail(`${tag}: theme section h2 "${m.theme.h2}", want "${S.themeH2}"`);
        if (m.theme.text !== COPY.themeDescriptionSentence.text) r.fail(`${tag}: theme section body "${m.theme.text}", want only Lee-Ann's description sentence`);
      }
    }
    await ctx.close();
  });
});
