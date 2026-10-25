// A7: the standard, measured identically on every route in goldens/route-table.json at 390@3, 768@2, 1024@2 and 1440@2.
//   hero      a photo hero where the route has a crop (routes with photo null print NEEDS PHOTO, never a silent pass); served >= required
//             (required = ceil(max(boxW, boxH x srcW/srcH) x DPR), also at 2056@2); one h1; no h2 equals the h1
//   gap       sub-nav bottom (hero bottom when there is no sub-nav) to the first content in [data-doc-layout]: 64px >= 1024, 48px below
//   measure   .prose paragraphs 55-75ch (>= 768); one column below 960
//   grid      >= 961: aside right of the prose, ~5/7 of its width, sticky at 100px, the container at most 12% empty at 1440; < 960: aside follows
//   type      h2 and h3 computed style equals standard.json and is identical across routes
//   hygiene   no p whose only child is strong; no eyebrow above a heading; no coloured side border > 1px; no nested cards; no pill; targets;
//             no horizontal scroll
//   facts     (routes with facts) 2-4 dd/dt, every box fully inside the first viewport at 1440x900 and 390x844@3, contrast >= 4.5 on the
//             photo pixels behind each fact; sub-nav and first h2 visible at 1440x900
//   focus     a focused h1[tabindex="-1"] paints no outline, ring or shadow, on load and after client navigation
import { CROPS, EXCLUDED, ROUTES, STD, driveState, launchChromium, newContext, withServer } from './_lib.mjs';

const HERO_IMG = 'section[data-nos-hero] [data-nos-hero-media] img';
const wantGap = (w) => (w >= 1024 ? STD.gap.atOrAbove1024 : STD.gap.below1024);
const h2Px = (w) => Math.min(39, Math.max(32, 24 + 0.016 * w));
const typeSeen = {};

async function heroSharpness(page, route, vp, c, tag) {
  const crop = CROPS.find((k) => k.crop === route.photo);
  const found = await page.waitForFunction((sel) => { const i = document.querySelector(sel); return i && i.complete && i.naturalWidth > 0; }, HERO_IMG, { timeout: 20000 }).then(() => true, () => false);
  c.check(`${tag} hero photo present and loaded`, found);
  if (!found) return;
  const geo = await page.evaluate((sel) => { const img = document.querySelector(sel); const hero = document.querySelector('section[data-nos-hero]').getBoundingClientRect(); const b = img.getBoundingClientRect(); const h1 = document.querySelector('h1')?.getBoundingClientRect(); return { left: (b.left - hero.left) / hero.width * 100, right: (b.right - hero.left) / hero.width * 100, w: b.width, heroW: hero.width, top: b.top, h1Bottom: h1 ? h1.bottom : 0 }; }, HERO_IMG);
  if (vp.width >= 1024) c.check(`${tag} photo box runs 38%-100% of the hero (measured ${geo.left.toFixed(1)}%-${geo.right.toFixed(1)}%)`, Math.abs(geo.left - STD.hero.photoBox.atOrAbove1024.leftPctOfHero) <= STD.hero.photoBox.atOrAbove1024.tolerancePct && Math.abs(geo.right - 100) <= 1);
  else c.check(`${tag} stacked photo is full width and sits under the copy`, Math.abs(geo.w - geo.heroW) <= 1 && geo.top >= geo.h1Bottom - 1);
  const r = await page.evaluate(async (sel) => {
    const img = document.querySelector(sel); const b = img.getBoundingClientRect();
    const probe = new Image(); probe.src = img.currentSrc; await probe.decode();
    return { boxW: b.width, boxH: b.height, dpr: devicePixelRatio, src: img.currentSrc, served: probe.naturalWidth, servedH: probe.naturalHeight };
  }, HERO_IMG);
  if (!crop) { c.check(`${tag} route has a crop in the proposals`, false); return; }
  const aspect = crop.width / crop.height;
  const required = Math.ceil(Math.max(r.boxW, r.boxH * aspect) * r.dpr - 0.5);
  c.check(`${tag} served ${r.served} >= required ${required} = max(box ${Math.round(r.boxW)}, ${Math.round(r.boxH)} x ${aspect.toFixed(3)}) x ${r.dpr}`, r.served >= required, r.src);
  c.check(`${tag} required ${required} <= the cut's native ${crop.width} (not clamped)`, required <= crop.width);
}

async function factsContrast(page, tag, c) {
  // hide the text, screenshot each fact box over the photo, take the p95 background luminance, compare with the text colour
  const boxes = await page.evaluate(() => [...document.querySelectorAll('[data-hero-facts] dd, [data-hero-facts] dt')].map((e) => { const b = e.getBoundingClientRect(); const rgb = getComputedStyle(e).color.match(/[\d.]+/g).map(Number); return { x: b.x, y: b.y, w: b.width, h: b.height, rgb }; }));
  await page.addStyleTag({ content: '[data-hero-facts] *{color:transparent !important;text-shadow:none !important}' });
  const lum = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const L = (rgb) => 0.2126 * lum(rgb[0]) + 0.7152 * lum(rgb[1]) + 0.0722 * lum(rgb[2]);
  for (const [i, b] of boxes.entries()) {
    const buf = await page.screenshot({ clip: { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.max(1, b.w), height: Math.max(1, b.h) } });
    const p95 = await page.evaluate(async (b64) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const cv = new OffscreenCanvas(bmp.width, bmp.height); const ctx = cv.getContext('2d'); ctx.drawImage(bmp, 0, 0);
      const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data; const ls = [];
      const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      for (let p = 0; p < d.length; p += 4) ls.push(0.2126 * f(d[p]) + 0.7152 * f(d[p + 1]) + 0.0722 * f(d[p + 2]));
      ls.sort((a, z) => a - z); return ls[Math.floor(ls.length * 0.95)];
    }, buf.toString('base64'));
    const t = L(b.rgb); const ratio = (Math.max(t, p95) + 0.05) / (Math.min(t, p95) + 0.05);
    c.check(`${tag} fact ${i + 1} contrast ${ratio.toFixed(2)} >= ${STD.hero.contrastMin} on the photo pixels behind it`, ratio >= STD.hero.contrastMin);
  }
}


const SECTION_NAV = 'nav[data-doc-index][aria-label="Sections"]';

/** D7 (FINAL): below 1024 the index is a sticky horizontal scroller. Under 700 the header is not sticky and the scroller sticks at
 env(safe-area-inset-top, 0); from 700 it sticks at the sticky header's height. 32px trailing mask fade only while it overflows; scroll-snap;
 the active item is kept in view. It never overlaps the header and stays reachable when scrolled mid-page. */
async function scrollerChecks(page, vp, c, tag) {
  const s = await page.evaluate((sel) => {
    const nav = document.querySelector(sel); if (!nav) return null;
    const aside = nav.closest('[data-doc-aside]');
    const cands = [nav, nav.querySelector('ul'), aside].filter(Boolean);
    const sc = cands.find((e) => ['auto', 'scroll'].includes(getComputedStyle(e).overflowX)) ?? null;
    const header = document.querySelector('header'); const hs = header ? getComputedStyle(header) : null;
    const stick = [aside, nav].find((e) => e && getComputedStyle(e).position === 'sticky') ?? null;
    return { hasScroller: Boolean(sc), over: sc ? sc.scrollWidth > sc.clientWidth + 1 : false,
      mask: sc ? (getComputedStyle(sc).maskImage !== 'none' && getComputedStyle(sc).maskImage !== '') || (getComputedStyle(sc).webkitMaskImage ?? 'none') !== 'none' : false,
      snap: sc ? getComputedStyle(sc).scrollSnapType : 'none', stick: Boolean(stick), stickTop: stick ? getComputedStyle(stick).top : null,
      headerSticky: Boolean(hs && ['sticky', 'fixed'].includes(hs.position)), headerH: header ? header.getBoundingClientRect().height : 0 };
  }, SECTION_NAV);
  if (!s) { c.check(`${tag} nav[data-doc-index][aria-label="Sections"] exists`, false); return; }
  c.check(`${tag} the index is a horizontal scroller below 1024 (D7)`, s.hasScroller);
  c.check(`${tag} 32px trailing mask fade only while it overflows (overflow ${s.over}, mask ${s.mask})`, s.mask === s.over);
  c.check(`${tag} scroll-snap on the scroller (${s.snap})`, s.snap !== 'none');
  c.check(`${tag} the scroller is sticky`, s.stick);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
  await page.waitForTimeout(250);
  const g = await page.evaluate(({ sel, hs }) => { const a = document.querySelector(sel)?.closest('[data-doc-aside]') ?? document.querySelector(sel); const b = a.getBoundingClientRect(); const h = document.querySelector('header'); const hb = hs && h ? h.getBoundingClientRect().bottom : 0; return { top: b.top, hb }; }, { sel: SECTION_NAV, hs: s.headerSticky });
  c.check(`${tag} mid-page the scroller stays reachable and never overlaps the sticky header (top ${Math.round(g.top)}, header bottom ${Math.round(g.hb)})`, g.top >= g.hb - 1 && g.top <= g.hb + 8);
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** The checks that hold on every route: the PG-1 rhythm, no radius >= 999 except the eyebrow, no split h2, no h2 naming a sibling route,
 outline, h4, hero height, legend chip, facts attributes. */
async function extraChecks(page, route, vp, c, tag) {
  const x = await page.evaluate(({ eyebrowSel }) => {
    const lv = (e) => Number(e.tagName[1]);
    const heads = [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6, h1')];
    const uniq = [...new Set(heads)].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    let skip = 0; for (let i = 1; i < uniq.length; i += 1) if (lv(uniq[i]) > lv(uniq[i - 1]) + 1) skip += 1;
    const round = [...document.querySelectorAll('body *')].filter((e) => { if (e.closest(eyebrowSel)) return false; const s = getComputedStyle(e); const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].some((k) => parseFloat(s[`border${k}Radius`]) >= 999); }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)}`);
    const split = [...document.querySelectorAll('main h2')].filter((h) => { let item = h; while (item.parentElement && item.parentElement !== document.querySelector('main')) { const ps = getComputedStyle(item.parentElement); const row = ps.display === 'grid' ? ps.gridTemplateColumns.trim().split(/\s+/).length > 1 : (ps.display === 'flex' && ps.flexDirection.startsWith('row')); if (row && item.parentElement.children.length > 1) return item.textContent.trim() === h.textContent.trim() || item.querySelectorAll('p, ul, ol, details, table, img, a').length === 0; item = item.parentElement; } return false; }).map((h) => h.textContent.trim().slice(0, 30));
    const nkBad = [...document.querySelectorAll('.nk-ticket, .nk-perf, .nk-stamp')].filter((e) => !e.closest('[data-ticket-card]')).length;
    const testBar = document.querySelectorAll('[aria-label="Testing only, not live"]').length;
    const inner = document.querySelector('.nos-hero-inner'); const ic = inner ? getComputedStyle(inner) : null;
    const img = document.querySelector('section[data-nos-hero] [data-nos-hero-media] img'); const ib = img ? img.getBoundingClientRect() : null;
    const first = document.querySelector('[data-doc-main] > section:first-of-type, [data-doc-main] > *:first-child'); const fs = first ? getComputedStyle(first) : null;
    const navLabels = [...document.querySelectorAll('header a, .nos-subnav a')].map((a) => a.textContent.trim().replace(/\s+/g, ' ').toLowerCase()).filter(Boolean);
    const h2s = [...document.querySelectorAll('main h2')].map((h) => h.textContent.trim().replace(/\s+/g, ' '));
    const h4s = [...document.querySelectorAll('main h4')].map((h) => { const s = getComputedStyle(h); return { fam: s.fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase(), w: s.fontWeight, px: parseFloat(s.fontSize), mt: parseFloat(s.marginTop), mb: parseFloat(s.marginBottom) }; });
    const lh = (e) => { if (!e) return null; const s = getComputedStyle(e); return parseFloat(s.lineHeight) / parseFloat(s.fontSize); };
    const hero = document.querySelector('section[data-nos-hero]');
    const facts = document.querySelector('[data-hero-facts]');
    const legend = [...document.querySelectorAll('main *')].filter((e) => !e.closest('details') && e.children.length === 0 && /to be confirmed by the show committee/i.test(e.textContent)).length;
    const railed = [...document.querySelectorAll('main *')].filter((e) => { const s = getComputedStyle(e); return ['Left', 'Right'].some((k) => parseFloat(s[`border${k}Width`]) > 1) || ['Top', 'Bottom', 'Left', 'Right'].some((k) => s[`border${k}Style`] === 'dashed' && parseFloat(s[`border${k}Width`]) >= 2); }).length;
    return { nkBad, testBar, vw: innerWidth, innerMin: ic ? parseFloat(ic.minHeight) : null, innerAlign: ic ? ic.alignContent : null, innerPadT: ic ? parseFloat(ic.paddingTop) : null, innerPadB: ic ? parseFloat(ic.paddingBottom) : null, band: ib && ib.height ? ib.width / ib.height : null, skip, round, split, padTop: fs ? parseFloat(fs.paddingTop) : null, bTop: fs ? parseFloat(fs.borderTopWidth) : null, navLabels, h2s, h4s, h2lh: lh(document.querySelector('main h2')), h3lh: lh(document.querySelector('main h3')),
      heroH: hero ? hero.getBoundingClientRect().height : null, legend, railed, factsCount: facts ? facts.querySelectorAll('[data-hero-fact]').length : 0, factsAttr: facts ? facts.getAttribute('data-fact-count') : null, factTerms: facts ? [...facts.querySelectorAll('dt')].map((e) => e.textContent.trim()) : [], factValues: facts ? [...facts.querySelectorAll('dd')].map((e) => e.textContent.trim()) : [], factCount2: facts ? facts.querySelectorAll('[data-hero-fact]').length >= 2 : true, indexRows: [...document.querySelectorAll('nav[data-doc-index] a')].map((a) => { const b = a.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right }; }), factsOk: facts ? [...facts.querySelectorAll('[data-hero-fact]')].every((f) => f.children[0]?.tagName === 'DT' && f.children[1]?.tagName === 'DD') : true };
  }, { eyebrowSel: '[data-nos-hero-eyebrow]' });
  c.check(`${tag} .nk-ticket/.nk-perf/.nk-stamp only inside a purchasable [data-ticket-card] (WS-1)`, x.nkBad === 0, String(x.nkBad));
  c.check(`${tag} the TESTING ONLY bar is absent (it belongs to /tickets/* and the payment step only)`, x.testBar === 0, String(x.testBar));
  {
    const P = STD.hero.pg1;
    if (vp.width >= 768) {
      const wantMin = Math.min(P.max, Math.max(P.min, P.vw * vp.width)); const wantPad = Math.min(P.padMax, Math.max(P.padMin, P.padVw * vp.width));
      c.check(`${tag} .nos-hero-inner min-height ${x.innerMin} ~ ${wantMin.toFixed(0)} (PG-1 4)`, x.innerMin !== null && Math.abs(x.innerMin - wantMin) <= 2);
      c.check(`${tag} .nos-hero-inner align-content start and padding-block ${x.innerPadT}/${x.innerPadB} ~ ${wantPad.toFixed(0)}`, ['start', 'flex-start'].includes(x.innerAlign) && Math.abs(x.innerPadT - wantPad) <= 2 && Math.abs(x.innerPadB - wantPad) <= 2, x.innerAlign);
    } else {
      c.check(`${tag} below 768 the photo band is 2:1 (${x.band && x.band.toFixed(2)}) and the copy follows at padding-block ${P.mobilePad}px (${x.innerPadT}/${x.innerPadB})`, x.band !== null && Math.abs(x.band - P.mobileBandAspect) <= 0.06 && x.innerPadT === P.mobilePad && x.innerPadB === P.mobilePad);
    }
  }
  if (vp.width >= 1024 && x.indexRows.length) c.check(`${tag} index rows are >= 44px tall with disjoint boxes (${x.indexRows.length})`, x.indexRows.every((r, i) => r.b - r.t >= 43.5 && (i === 0 || r.t >= x.indexRows[i - 1].b - 0.5)));
  c.check(`${tag} heading outline has no skipped level`, x.skip === 0, String(x.skip));
  c.check(`${tag} no element other than the eyebrow computes border-radius >= 999`, x.round.length === 0, x.round.slice(0, 4).join('; '));
  c.check(`${tag} no split section: no row column holds only an h2 (PG-1 2)`, x.split.length === 0, x.split.join('; '));
  c.check(`${tag} first section has no padding-top and no border-top (PG-1 1)`, x.padTop === 0 && x.bTop === 0, `${x.padTop} ${x.bTop}`);
  c.check(`${tag} no "To be confirmed by the show committee" legend outside a disclosure`, x.legend === 0, String(x.legend));
  c.check(`${tag} no rail: no side border > 1px and no dashed 2px border (NOS Design c)`, x.railed === 0, String(x.railed));
  if (x.h2lh !== null) c.check(`${tag} h2 line-height ${x.h2lh.toFixed(2)} ~ ${STD.heading.h2LineHeight}`, Math.abs(x.h2lh - STD.heading.h2LineHeight) <= 0.03);
  if (x.h3lh !== null) c.check(`${tag} h3 line-height ${x.h3lh.toFixed(2)} ~ ${STD.heading.h3LineHeight}`, Math.abs(x.h3lh - STD.heading.h3LineHeight) <= 0.03);
  if (x.h4s.length) {
    c.check(`${tag} h4 only where the route table allows it (${x.h4s.length})`, route.h4 === true, `route.h4=${route.h4}`);
    c.check(`${tag} every h4 is Karla 600 16px, 24px above, 8px below (PYV-1)`, x.h4s.every((h) => h.fam.includes('karla') && h.w === '600' && Math.abs(h.px - 16) <= 0.5 && Math.abs(h.mt - 24) <= 1 && Math.abs(h.mb - 8) <= 1), JSON.stringify(x.h4s[0]));
  }
  for (const t of route.h2FlaggedForDrive ?? []) if (x.h2s.includes(t)) c.note(`${tag} FLAGGED FOR LEE-ANN'S DOC (builder copy, not rewritten): h2 "${t}"`);
  c.check(`${tag} no h2 names a sibling route unless it is a heading in her Drive doc or flagged for her doc`, x.h2s.every((t) => !x.navLabels.includes(t.toLowerCase()) || (route.h2FlaggedForDrive ?? []).includes(t) || (route.drive && driveState(route).text.includes(t))), x.h2s.filter((t) => x.navLabels.includes(t.toLowerCase())).join('; '));
  if (x.factsCount || x.factsAttr) {
    c.check(`${tag} no fact is filler (to be confirmed), no Cycle or invented-label fact, row only with >= 2 facts (${x.factTerms.join(' | ')})`, x.factCount2 && !x.factTerms.some((t) => /^cycle$/i.test(t)) && !x.factValues.some((v) => /to be confirmed/i.test(v)) && (!route.keyFacts || x.factTerms.every((t) => route.keyFacts.some((k) => k.term === t))), JSON.stringify(x.factValues));
    c.check(`${tag} [data-hero-facts] has data-fact-count == items (${x.factsAttr} vs ${x.factsCount}), dt before dd`, Number(x.factsAttr) === x.factsCount && x.factsOk);
  }
  if (vp.width >= 1440) { // PG-1 4, inherited from #76
    const cap = vp.width >= 2000 ? STD.hero.heightCap.at2056 : STD.hero.heightCap.at1440;
    c.check(`${tag} hero height ${Math.round(x.heroH)} <= ${cap} (PG-1 4)`, x.heroH !== null && x.heroH <= cap);
  }
}

await withServer(1, 'standard', async (server, c) => {
  const browser = await launchChromium();
  try {
    const needsPhoto = ROUTES.filter((r) => !r.photo).map((r) => r.nos);
    for (const e of EXCLUDED) c.note(`EXCLUDED ${e.nos}: ${e.excluded}`);
    c.note(`WS-1: ${STD.ws1.ticketEdge}`);
    c.note(`NEEDS PHOTO (Brad photography need, ${needsPhoto.length}): ${needsPhoto.join(' ')}`);
    for (const route of ROUTES) {
      for (const vp of STD.viewports) {
        const tag = `[${vp.name} ${route.nos}]`;
        const context = await newContext(browser, vp);
        const page = await context.newPage();
        const res = await page.goto(`${server.nos}${route.nos}`, { waitUntil: 'load' });
        c.check(`${tag} responds 200`, res?.status() === 200, String(res?.status()));
        if (res?.status() !== 200) { await context.close(); continue; }
        await page.waitForSelector('[data-doc-layout]', { timeout: 15000 }).catch(() => {});

        const m = await page.evaluate(({ vpW, aside }) => {
          const r = (e) => { const b = e.getBoundingClientRect(); return { top: b.top + scrollY, bottom: b.bottom + scrollY, left: b.left, right: b.right, w: b.width, h: b.height }; };
          const doc = document.querySelector('[data-doc-layout]');
          const sub = document.querySelector('.nos-subnav'); const hero = document.querySelector('section[data-nos-hero]');
          const anchor = sub ?? hero;
          const kids = doc ? [...doc.querySelectorAll('h2, h3, p, [data-doc-aside], [data-doc-main] > *')].filter((e) => e.getBoundingClientRect().height > 0) : [];
          const main = document.querySelector('[data-doc-main]'); const asideEl = document.querySelector('[data-doc-aside]');
          const prose = document.querySelector('main .doc-prose p');
          const probe = prose ? Object.assign(document.createElement('span'), { style: 'width:1ch;display:inline-block;position:absolute;visibility:hidden' }) : null;
          if (probe) prose.parentElement.appendChild(probe);
          const ch = probe ? probe.getBoundingClientRect().width : 0; probe?.remove();
          const wrap = document.querySelector('[data-doc-layout] [data-nos-wrap], [data-doc-layout]');
          const wcs = getComputedStyle(wrap);
          const h1s = [...document.querySelectorAll('h1')]; const h2s = [...document.querySelectorAll('main h2')];
          const cs = (e) => (e ? { fam: getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase(), w: getComputedStyle(e).fontWeight, px: parseFloat(getComputedStyle(e).fontSize) } : null);
          const bold = [...document.querySelectorAll('main p')].filter((p) => p.children.length === 1 && /^(STRONG|B)$/.test(p.firstElementChild.tagName) && p.textContent.trim() === p.firstElementChild.textContent.trim()).length;
          const eyebrow = [...document.querySelectorAll('main h2, main h3')].filter((h) => { const p = h.previousElementSibling; if (!p) return false; const s = getComputedStyle(p); return s.textTransform === 'uppercase' && parseFloat(s.fontSize) <= 13 && p.textContent.trim().length < 40; }).length;
          const sideBorder = [...document.querySelectorAll('main *')].filter((e) => { const s = getComputedStyle(e); return ['Left', 'Right'].some((k) => parseFloat(s[`border${k}Width`]) > 1 && s[`border${k}Style`] !== 'none' && s[`border${k}Color`] !== 'rgba(0, 0, 0, 0)'); }).length;
          const nested = document.querySelectorAll('main .nos-surface .nos-surface, main .nos-card .nos-card, main [data-doc-aside] [data-doc-aside]').length;
          const pills = [...document.querySelectorAll('main a, main button, main summary')].filter((e) => { const b = e.getBoundingClientRect(); if (!b.width || !b.height) return false; const rad = parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0; return rad > 0 && rad >= Math.min(b.width, b.height) / 2 - 1; }).length;
          const small = [...document.querySelectorAll('main a, main button, main summary')].filter((e) => { const b = e.getBoundingClientRect(); if (!b.width || !b.height) return false; const inIdx = e.closest('nav[data-doc-index]'); return b.height + 0.5 < (inIdx ? 44 : 24); }).map((e) => e.textContent.trim().slice(0, 24));
          return {
            hasDoc: Boolean(doc), anchorBottom: anchor ? r(anchor).bottom : null, hasSub: Boolean(sub),
            firstTop: kids.length ? Math.min(...kids.map((e) => r(e).top)) : null,
            h1: h1s.length, h1Text: h1s[0]?.textContent.trim().replace(/\s+/g, ' '), h2Texts: h2s.map((h) => h.textContent.trim().replace(/\s+/g, ' ')),
            variant: hero?.getAttribute('data-nos-hero-variant'), hasImg: Boolean(document.querySelector('section[data-nos-hero] [data-nos-hero-media] img')),
            main: main ? r(main) : null, aside: asideEl ? { ...r(asideEl), pos: getComputedStyle(asideEl).position, top: getComputedStyle(asideEl).top, kind: asideEl.getAttribute('data-doc-aside-kind'), first: Boolean(main && (asideEl.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING)), count: document.querySelectorAll('[data-doc-aside]').length } : null,
            proseW: prose ? prose.getBoundingClientRect().width : null, chars: prose && ch ? prose.getBoundingClientRect().width / ch : null,
            wrapInner: wrap ? r(wrap).w - parseFloat(wcs.paddingLeft) - parseFloat(wcs.paddingRight) : null, wrapLeft: wrap ? r(wrap).left + parseFloat(wcs.paddingLeft) : null,
            h2: cs(h2s[0]), h3: cs(document.querySelector('main h3')), bold, eyebrow, sideBorder, nested, pills, small,
            sw: document.documentElement.scrollWidth, iw: innerWidth, hasFacts: Boolean(document.querySelector('[data-hero-facts]')),
            indexNav: document.querySelector('nav[data-doc-index]') ? { ox: getComputedStyle(document.querySelector('nav[data-doc-index]').querySelector('ul') ?? document.body).overflowX } : null,
            vpW, wantAside: aside,
          };
        }, { vpW: vp.width, aside: route.aside });
        c.check(`${tag} [data-doc-layout] exists`, m.hasDoc);
        if (!m.hasDoc) { await context.close(); continue; }
        c.check(`${tag} exactly one h1`, m.h1 === 1, String(m.h1));
        c.check(`${tag} no h2 repeats the h1`, !m.h2Texts.includes(m.h1Text), m.h1Text);
        c.check(`${tag} gap ${Math.round((m.firstTop - m.anchorBottom) * 10) / 10} == ${wantGap(vp.width)}`, Math.abs(m.firstTop - m.anchorBottom - wantGap(vp.width)) <= STD.gap.tolerancePx);
        c.check(`${tag} no horizontal page scroll`, m.sw <= m.iw);
        c.check(`${tag} no <p> whose sole child is <strong>`, m.bold === 0, String(m.bold));
        c.check(`${tag} no eyebrow above a heading`, m.eyebrow === 0, String(m.eyebrow));
        c.check(`${tag} no coloured side border > 1px`, m.sideBorder === 0, String(m.sideBorder));
        c.check(`${tag} no nested cards`, m.nested === 0, String(m.nested));
        c.check(`${tag} no pills`, m.pills === 0, String(m.pills));
        c.check(`${tag} targets (index 44, other 24)`, m.small.length === 0, m.small.slice(0, 3).join('; '));
        if (route.photo) {
          c.check(`${tag} photo hero`, m.hasImg && m.variant === 'photo', String(m.variant));
          await heroSharpness(page, route, vp, c, tag);
        } else c.note(`${tag} NEEDS PHOTO (hero rendered as variant ${m.variant}); listed, not passed silently`);

        if (m.h2) {
          const key = `${vp.name}:h2`; const sig = `${m.h2.fam}/${m.h2.w}`; (typeSeen[key] ??= new Map()).set(sig, [...(typeSeen[key].get(sig) ?? []), route.nos]);
          c.check(`${tag} h2 is ${STD.heading.h2.family} ${STD.heading.h2.fontWeight} (${m.h2.fam} ${m.h2.w})`, m.h2.fam.includes(STD.heading.h2.family) && m.h2.w === STD.heading.h2.fontWeight);
          c.check(`${tag} h2 size ${m.h2.px} ~ ${h2Px(vp.width).toFixed(1)}`, Math.abs(m.h2.px - h2Px(vp.width)) <= STD.heading.tolerancePx);
        }
        if (m.h3) {
          const key = `${vp.name}:h3`; const sig = `${m.h3.fam}/${m.h3.w}/${m.h3.px}`; (typeSeen[key] ??= new Map()).set(sig, [...(typeSeen[key].get(sig) ?? []), route.nos]);
          c.check(`${tag} h3 is ${STD.heading.h3.family} ${STD.heading.h3.fontWeight} ${STD.heading.h3Px}px (${m.h3.fam} ${m.h3.w} ${m.h3.px})`, m.h3.fam.includes(STD.heading.h3.family) && m.h3.w === STD.heading.h3.fontWeight && Math.abs(m.h3.px - STD.heading.h3Px) <= STD.heading.tolerancePx);
        }

        if (route.kind === 'document' && m.chars) {
          if (vp.width >= 768) c.check(`${tag} measure ${m.chars.toFixed(0)}ch in ${STD.prose.minCh}-${STD.prose.maxCh}`, m.chars >= STD.prose.minCh && m.chars <= STD.prose.maxCh);
          else c.check(`${tag} measure ${m.chars.toFixed(0)}ch <= ${STD.prose.maxCh}`, m.chars <= STD.prose.maxCh);
        }
        {
          const want = route.aside === 'none' ? null : (route.aside === 'venue' || route.aside === 'contact') ? 'content' : 'index';
          if (!want) c.check(`${tag} listing route renders no [data-doc-aside]`, !m.aside);
          else {
            c.check(`${tag} exactly one [data-doc-aside] of kind ${want}`, Boolean(m.aside) && m.aside.count === 1 && m.aside.kind === want, JSON.stringify(m.aside && { kind: m.aside.kind, count: m.aside.count }));
            if (m.aside && vp.width >= STD.grid.minWidthForTwoColumns) {
              c.check(`${tag} aside is right of the prose column`, m.aside.left >= m.main.right - 1, `${m.aside.left} vs ${m.main.right}`);
              c.check(`${tag} aside is sticky at ${STD.grid.asideStickyTop}px`, m.aside.pos === 'sticky' && Math.abs(parseFloat(m.aside.top) - STD.grid.asideStickyTop) <= STD.grid.asideStickyTopTolerance, `${m.aside.pos} ${m.aside.top}`);
              const ratio = m.aside.w / m.main.w;
              c.check(`${tag} 7fr/5fr: aside/main width ${ratio.toFixed(2)} ~ 0.71`, ratio > 0.6 && ratio < 0.82);
              if (want === 'index') c.check(`${tag} the index aside is first in the DOM`, m.aside.first);
              if (vp.width >= 1440) {
                const covered = Math.max(m.main.right, m.aside.right) - Math.min(m.main.left, m.aside.left);
                const empty = 100 * (1 - covered / m.wrapInner);
                c.check(`${tag} container ${empty.toFixed(0)}% empty <= ${STD.grid.maxEmptyPctOfContainerAt1440}%`, empty <= STD.grid.maxEmptyPctOfContainerAt1440);
              }
            } else if (m.aside && want === 'content') c.check(`${tag} content aside follows the main column`, m.aside.top >= m.main.bottom - 1);
            else if (m.aside) await scrollerChecks(page, vp, c, tag);
          }
        }
        await extraChecks(page, route, vp, c, tag);

        // focus ring on the h1
        const ring = await page.evaluate(() => { const h = document.querySelector('h1'); if (!h) return null; h.setAttribute('tabindex', h.getAttribute('tabindex') ?? '-1'); h.focus(); const s = getComputedStyle(h); return { active: document.activeElement === h, os: s.outlineStyle, ow: parseFloat(s.outlineWidth), sh: s.boxShadow, tab: h.getAttribute('tabindex') }; });
        if (ring) c.check(`${tag} focused h1 paints no outline or shadow (${ring.os} ${ring.ow}px, ${ring.sh})`, (ring.os === 'none' || ring.ow === 0) && ring.sh === 'none');
        await context.close();
      }

      // sharpness at 2056@2 (DS-1: need >= 4112) for photo routes
      if (route.photo) {
        const vp = { name: '2056@2', width: 2056, height: 1200, dsf: 2 };
        const context = await newContext(browser, vp); const page = await context.newPage();
        await page.goto(`${server.nos}${route.nos}`, { waitUntil: 'load' });
        await heroSharpness(page, route, vp, c, `[${vp.name} ${route.nos}]`);
        await extraChecks(page, route, vp, c, `[${vp.name} ${route.nos}]`);
        await context.close();
      }

      // first screen (facts, sub-nav, first h2)
      for (const vp of STD.firstScreen) {
        const tag = `[first-screen ${vp.name} ${route.nos}]`;
        const context = await newContext(browser, vp); const page = await context.newPage();
        await page.goto(`${server.nos}${route.nos}`, { waitUntil: 'load' });
        const f = await page.evaluate(() => ({ ih: innerHeight, sub: document.querySelector('.nos-subnav')?.getBoundingClientRect().bottom ?? null, h2: document.querySelector('main h2')?.getBoundingClientRect() ?? null,
          facts: [...document.querySelectorAll('[data-hero-facts] dd, [data-hero-facts] dt')].map((e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; }), count: document.querySelectorAll('[data-hero-facts] dd').length,
          dd: document.querySelector('[data-hero-facts] dd') ? (() => { const s = getComputedStyle(document.querySelector('[data-hero-facts] dd')); return { fam: s.fontFamily.toLowerCase(), w: s.fontWeight }; })() : null }));
        if (f.count > 0 || (route.keyFacts ?? []).length > 0) {
          c.check(`${tag} ${STD.facts.min}-${STD.facts.max} facts (${f.count})`, f.count >= STD.facts.min && f.count <= STD.facts.max);
          c.check(`${tag} every fact box is fully inside the first viewport`, f.facts.length > 0 && f.facts.every((b) => b.top >= 0 && b.bottom <= f.ih && b.left >= 0 && b.right <= vp.width), JSON.stringify(f.facts.find((b) => b.bottom > f.ih)));
          if (f.dd) c.check(`${tag} fact values are Fraunces 300`, f.dd.fam.includes('fraunces') && f.dd.w === '300', JSON.stringify(f.dd));
          if (vp.width === 1440 && route.photo) await factsContrast(page, tag, c);
        }
        if (vp.width === 1440) {
          if (f.sub !== null) c.check(`${tag} sub-nav is visible (bottom ${Math.round(f.sub)} <= ${f.ih})`, f.sub <= f.ih);
          if (f.h2) c.check(`${tag} the first h2 is visible (top ${Math.round(f.h2.top)} < ${f.ih})`, f.h2.top < f.ih - 24 && f.h2.bottom <= f.ih);
          if (route.aside !== 'none' && route.aside !== 'venue' && route.aside !== 'contact') {
            const card = await page.evaluate(() => { const e = document.querySelector('[data-doc-aside]'); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; });
            c.check(`${tag} the index card is above the fold on load`, Boolean(card) && card.top < f.ih - 24, JSON.stringify(card));
          }
        }
        await context.close();
      }

      // focus after client navigation: click the first sub-nav link that is not the current page
      {
        const vp = STD.firstScreen[0]; const context = await newContext(browser, vp); const page = await context.newPage();
        await page.goto(`${server.nos}${route.nos}`, { waitUntil: 'load' });
        const target = await page.evaluate(() => { const a = [...document.querySelectorAll('.nos-subnav a')].find((x) => !x.hasAttribute('aria-current')); return a ? a.getAttribute('href') : null; });
        if (target) {
          await page.locator(`.nos-subnav a[href="${target}"]`).first().click();
          await page.waitForURL((u) => u.pathname === target || u.pathname.endsWith(target), { timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(400);
          const o = await page.evaluate(() => { const h = document.querySelector('h1'); const s = h ? getComputedStyle(h) : null; return h ? { active: document.activeElement === h, os: s.outlineStyle, ow: parseFloat(s.outlineWidth), sh: s.boxShadow, bd: s.borderTopWidth } : null; });
          c.check(`[after client navigation from ${route.nos} to ${target}] no ring is painted on the h1 (${JSON.stringify(o)})`, o !== null && (o.os === 'none' || o.ow === 0) && o.sh === 'none');
        }
        await context.close();
      }
    }
    for (const [key, seen] of Object.entries(typeSeen)) c.check(`${key} computed style is identical across routes (${[...seen.keys()].join(' | ')})`, seen.size === 1);
  } finally { await browser.close(); }
}, { preview: true });
