// nav-focus-underline HD-1 -- paste into the browser (javascript_tool) on a page of either host, scrolled to the top.
// Returns the metrics checks/compare-geometry.mjs reads, keyed as in goldens/header-geometry.json. Needs the data-hd hooks:
// bar, brand, nav, item, label, cta, search, menu. Run once per host per viewport width; for the active-bar metrics load a route
// whose nav item is current (e.g. /about on SAOC, /faq on NOS) at the widths >= breakpoints.full.
(() => {
  const r1 = (n) => Math.round(n * 10) / 10;
  const hd = (name) => document.querySelector(`[data-hd="${name}"]`);
  const shown = (el) => (el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' ? el : null);
  const header = document.querySelector('header');
  const cs = (el, pseudo) => getComputedStyle(el, pseudo);
  const px = (v) => parseFloat(v);
  const hr = header.getBoundingClientRect();
  const bar = hd('bar');
  const brand = shown(hd('brand'));
  const items = [...document.querySelectorAll('[data-hd="item"]')].filter(shown);
  const cta = shown(hd('cta'));
  const search = shown(hd('search'));
  const nav = shown(hd('nav'));
  const menu = shown(hd('menu'));
  const main = document.querySelector('#main-content');
  const h1 = main && main.querySelector('h1');
  const current = items.find((el) => el.hasAttribute('aria-current'));
  const label = current && current.querySelector('[data-hd="label"]');
  const out = {
    width: innerWidth,
    scrollY: scrollY,
    utilityBars: document.querySelectorAll('[aria-label="Utility bar"]').length,
    headerHeight: r1(hr.height),
    headerPosition: cs(header).position,
    barMaxWidth: bar ? px(cs(bar).maxWidth) || null : null,
    barPaddingTop: bar ? px(cs(bar).paddingTop) : null,
    barPaddingLeft: bar ? px(cs(bar).paddingLeft) : null,
    barGap: bar ? px(cs(bar).columnGap) : null,
    brandLeft: brand ? r1(brand.getBoundingClientRect().left) : null,
    brandTop: brand ? r1(brand.getBoundingClientRect().top - hr.top) : null,
    brandWidth: brand ? r1(brand.getBoundingClientRect().width) : null,
    brandCenterOffset: brand && bar ? r1(brand.getBoundingClientRect().top + brand.getBoundingClientRect().height/2 - (bar.getBoundingClientRect().top + bar.getBoundingClientRect().height/2)) : null,
    barContentWidth: bar ? r1(bar.clientWidth - px(cs(bar).paddingLeft) - px(cs(bar).paddingRight)) : null,
    brandWidthBound: bar ? r1(Math.min(bar.clientWidth - px(cs(bar).paddingLeft) - px(cs(bar).paddingRight), 405)) : null,
    gapBrandNav: brand && nav ? r1(nav.getBoundingClientRect().left - brand.getBoundingClientRect().right) : null,
    gapNavSearch: nav && search ? r1(search.getBoundingClientRect().left - nav.getBoundingClientRect().right) : null,
    gapSearchCta: search && cta ? r1(cta.getBoundingClientRect().left - search.getBoundingClientRect().right) : null,
    gapNavCta: nav && cta && !search ? r1(cta.getBoundingClientRect().left - nav.getBoundingClientRect().right) : null,
    barRows: bar ? new Set([...bar.children].filter(shown).map((el) => Math.round(el.getBoundingClientRect().top))).size : null,
    brandHeight: brand ? r1(brand.getBoundingClientRect().height) : null, // informational: heights differ by aspect once the widths are equal
    navSingleLine: items.length ? new Set(items.map((el) => Math.round(el.getBoundingClientRect().top))).size === 1 : null,
    itemHeightMin: items.length ? r1(Math.min(...items.map((el) => el.getBoundingClientRect().height))) : null,
    itemHeightMax: items.length ? r1(Math.max(...items.map((el) => el.getBoundingClientRect().height))) : null,
    itemFontSize: items.length ? cs(items[0]).fontSize : null,
    itemFontWeight: items.length ? cs(items[0]).fontWeight : null,
    itemLineHeight: items.length ? cs(items[0]).lineHeight : null,
    itemLetterSpacing: items.length ? cs(items[0]).letterSpacing : null,
    itemTextTransform: items.length ? cs(items[0]).textTransform : null,
    itemPaddingLeft: items.length ? px(cs(items[0]).paddingLeft) : null,
    itemGap: items.length > 1 ? r1(items[1].getBoundingClientRect().left - items[0].getBoundingClientRect().right) : null,
    ctaText: cta ? cta.textContent.trim() : null,
    ctaHeight: cta ? r1(cta.getBoundingClientRect().height) : null,
    ctaRight: cta ? r1(cta.getBoundingClientRect().right) : null,
    ctaRightInset: cta && bar ? r1(bar.getBoundingClientRect().right - px(cs(bar).paddingRight) - cta.getBoundingClientRect().right) : null,
    ctaPaddingTop: cta ? px(cs(cta).paddingTop) : null,
    ctaPaddingLeft: cta ? px(cs(cta).paddingLeft) : null,
    ctaRadius: cta ? cs(cta).borderTopLeftRadius : null,
    ctaFontSize: cta ? cs(cta).fontSize : null,
    ctaFontWeight: cta ? cs(cta).fontWeight : null,
    ctaLineHeight: cta ? cs(cta).lineHeight : null,
    ctaLetterSpacing: cta ? cs(cta).letterSpacing : null,
    ctaTextTransform: cta ? cs(cta).textTransform : null,
    searchWidth: search ? r1(search.getBoundingClientRect().width) : null,
    searchHeight: search ? r1(search.getBoundingClientRect().height) : null,
    menuHeight: menu ? r1(menu.getBoundingClientRect().height) : null,
    menuText: menu ? menu.textContent.trim().toLowerCase() : null,
    activeBarBottom: label ? cs(label, '::after').bottom : null,
    activeBarHeight: label ? cs(label, '::after').height : null,
    mainGap: main ? r1(main.getBoundingClientRect().top - hr.bottom) : null,
    overflowX: document.documentElement.scrollWidth - innerWidth,
    contentLeft: h1 ? r1(h1.getBoundingClientRect().left) : null,
  };
  return JSON.stringify(out);
})();
