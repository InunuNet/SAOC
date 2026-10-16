// F3-R27 hub (NOS Design ruling R27): the hub keeps ONE destinations list in the v4 "Planning a visit" list pattern (index.html:176-190 CSS,
// 604-618 markup), at most 6 items, and the bottom duplicate link grid is gone. Today the hub renders three link surfaces: the 5-card planning
// grid, the four-group "Explore the National Show" block (16 links) and the foot ShowSectionNav (17 links).
// DOM contract: ul[data-nos-destinations] > li > a > (title, description, .go[aria-hidden]) inside section.planning (gold ground, I:176).
// Measured at 1280 and 390: exactly one destinations list, 3..6 items; no <nav> anywhere in the hub's content (no sub-nav on the hub, no foot grid);
// no other list/nav/grid in the content groups 4 or more /national-show/* links; the "Explore the National Show" / "Find your way" block is gone;
// item pattern: title Fraunces 400 opsz 32 25px royal (I:184), description Karla 16px ink-700 (I:186), arrow box 44x44 radius 10px (I:187),
// 1px --line rule between items (I:182), link padding 24px 0 (I:183), section ground --gold (I:176).
import { HUB_ROUTE, main, openPage, withBrowser, VP_DESKTOP, VP_PHONE, rgbOf, rgbNear, GOLD_RGB, ROYAL_RGB, INK_700_RGB, LINE_RGB, opszOf } from './_f3lib.mjs';

function measure() {
  const hero = document.querySelector('[data-nos-hero]');
  const root = hero?.parentElement ?? document.querySelector('main');
  const lists = [...document.querySelectorAll('[data-nos-destinations]')];
  const list = lists[0] ?? null;
  const css = (e, p) => getComputedStyle(e)[p];
  const items = list ? [...list.querySelectorAll(':scope > li')] : [];
  const itemInfo = items.map((li) => {
    const a = li.querySelector(':scope > a');
    const kids = a ? [...a.children].filter((c) => !c.hasAttribute('aria-hidden')) : [];
    const title = kids[0] ?? null;
    const desc = kids[1] ?? null;
    const go = a?.querySelector('[aria-hidden="true"]') ?? null;
    const t = title ? getComputedStyle(title) : null;
    const d = desc ? getComputedStyle(desc) : null;
    const g = go ? getComputedStyle(go) : null;
    const gr = go ? go.getBoundingClientRect() : null;
    const lcs = getComputedStyle(li);
    const acs = a ? getComputedStyle(a) : null;
    return {
      href: a?.getAttribute('href') ?? null,
      title: title ? (title.textContent ?? '').trim() : '',
      desc: desc ? (desc.textContent ?? '').trim() : '',
      tFamily: t?.fontFamily, tWeight: t ? Number(t.fontWeight) : null, tSize: t ? parseFloat(t.fontSize) : null, tFvs: t?.fontVariationSettings, tColor: t?.color,
      dFamily: d?.fontFamily, dSize: d ? parseFloat(d.fontSize) : null, dColor: d?.color,
      goW: gr?.width ?? null, goH: gr?.height ?? null, goRadius: g ? parseFloat(g.borderTopLeftRadius) : null,
      borderTopW: parseFloat(lcs.borderTopWidth), borderTopColor: lcs.borderTopColor, borderTopStyle: lcs.borderTopStyle,
      padT: acs ? parseFloat(acs.paddingTop) : null, padB: acs ? parseFloat(acs.paddingBottom) : null,
      aH: a ? a.getBoundingClientRect().height : null,
    };
  });
  const section = list?.closest('section') ?? null;
  const h2 = section?.querySelector('h2') ?? null;
  // Link groups outside the hero and the destinations list: group NOS-route anchors by their closest list/nav container.
  const groups = new Map();
  for (const a of root.querySelectorAll('a[href^="/national-show/"]')) {
    if (a.closest('[data-nos-hero]') || a.closest('[data-nos-destinations]')) continue;
    const key = a.closest('ul, ol, nav, dl') ?? a.parentElement;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const bigGroups = [...groups.entries()].filter(([, n]) => n >= 4).map(([el, n]) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} (${n} links)`);
  const text = (root.textContent ?? '').replace(/\s+/g, ' ');
  return {
    listCount: lists.length,
    listTag: list?.tagName.toLowerCase() ?? null,
    items: itemInfo,
    sectionBg: section ? css(section, 'backgroundColor') : null,
    sectionClass: section ? String(section.className).slice(0, 50) : null,
    h2: h2 ? (h2.textContent ?? '').trim() : null,
    labelled: section ? !!document.getElementById(section.getAttribute('aria-labelledby') ?? '') : false,
    navs: [...root.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label') ?? '(unlabelled)'),
    bigGroups,
    dupBlock: /Explore the National Show|Find your way/.test(text),
  };
}

await main('F3-R27 hub-links', async (r) => {
  await withBrowser(async (browser) => {
    for (const [name, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
      const { ctx, page, status } = await openPage(browser, vp, HUB_ROUTE);
      if (status !== 200) { r.fail(`@${name}: HTTP ${status}`); await ctx.close(); continue; }
      const m = await page.evaluate(measure);
      const tag = `hub @${name}`;
      if (m.listCount !== 1) r.fail(`${tag}: want exactly one [data-nos-destinations] list, found ${m.listCount}`);
      if (m.listTag && m.listTag !== 'ul') r.fail(`${tag}: destinations list is <${m.listTag}>, want <ul>`);
      if (m.items.length < 3 || m.items.length > 6) r.fail(`${tag}: destinations list has ${m.items.length} items, want 3..6`);
      if (m.navs.length) r.fail(`${tag}: ${m.navs.length} <nav> in the hub content (${m.navs.join(', ')}); the hub has no sub-nav and no foot link grid`);
      for (const g of m.bigGroups) r.fail(`${tag}: duplicate link group ${g}; the hub keeps ONE destinations list`);
      if (m.dupBlock) r.fail(`${tag}: the "Explore the National Show" / "Find your way" group block is still rendered`);
      if (m.h2 !== 'Planning a visit') r.fail(`${tag}: destinations section h2 is "${m.h2}", want "Planning a visit"`);
      if (!m.labelled) r.fail(`${tag}: destinations section has no aria-labelledby pointing at its h2`);
      if (m.sectionBg && !rgbNear(rgbOf(m.sectionBg), GOLD_RGB, 1.5)) r.fail(`${tag}: destinations section ground ${m.sectionBg}, want --gold rgb(243, 242, 214) (I:176)`);
      m.items.forEach((it, i) => {
        const id = `${tag} item ${i + 1} "${it.title}"`;
        if (!it.href?.startsWith('/national-show')) r.fail(`${id}: href ${it.href}, want a /national-show route`);
        if (!it.title || !it.desc) r.fail(`${id}: needs a title and a description (title "${it.title}", description "${it.desc}")`);
        if (!/fraunces/i.test((it.tFamily ?? '').split(',')[0]) || it.tWeight !== 400) r.fail(`${id}: title ${it.tFamily?.slice(0, 24)} ${it.tWeight}, want Fraunces 400 (I:184)`);
        if (opszOf(it.tFvs) !== 32) r.fail(`${id}: title opsz ${opszOf(it.tFvs)}, want 32 (I:184)`);
        if (!(Math.abs((it.tSize ?? 0) - 25) <= 0.6)) r.fail(`${id}: title ${it.tSize}px, want 25px (--fs-lg)`);
        if (!rgbNear(rgbOf(it.tColor ?? ''), ROYAL_RGB)) r.fail(`${id}: title colour ${it.tColor}, want royal`);
        if (!/karla/i.test((it.dFamily ?? '').split(',')[0]) || !(Math.abs((it.dSize ?? 0) - 16) <= 0.6)) r.fail(`${id}: description ${it.dFamily?.slice(0, 20)} ${it.dSize}px, want Karla 16px (I:186)`);
        if (!rgbNear(rgbOf(it.dColor ?? ''), INK_700_RGB)) r.fail(`${id}: description colour ${it.dColor}, want ink-700`);
        if (!(Math.abs((it.goW ?? 0) - 44) <= 0.6 && Math.abs((it.goH ?? 0) - 44) <= 0.6)) r.fail(`${id}: arrow box ${it.goW}x${it.goH}, want 44x44 (I:187)`);
        if (!(Math.abs((it.goRadius ?? 0) - 10) <= 0.6)) r.fail(`${id}: arrow radius ${it.goRadius}px, want 10px`);
        if (!(Math.abs((it.padT ?? 0) - 24) <= 0.6 && Math.abs((it.padB ?? 0) - 24) <= 0.6)) r.fail(`${id}: link padding ${it.padT}/${it.padB}px, want 24px (I:183)`);
        if (i > 0 && !(it.borderTopW >= 0.9 && it.borderTopStyle === 'solid' && rgbNear(rgbOf(it.borderTopColor), LINE_RGB))) r.fail(`${id}: rule above is ${it.borderTopW}px ${it.borderTopStyle} ${it.borderTopColor}, want 1px solid --line (I:182)`);
      });
      await ctx.close();
    }
  });
});
