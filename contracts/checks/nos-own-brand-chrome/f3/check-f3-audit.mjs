// F3 route-audit + NOS Design rulings (2026-10-16), measured on the rendered pages. One browser pass per route, assertions grouped by id:
//  RULING-nav   ShowSectionNav and its "Explore the National Show" 10-card grid are gone from EVERY NOS route: the only <nav> in <main> are the
//               sub-nav (aria-label "... pages"), the Breadcrumb and the /faq in-page "FAQ categories" jump nav (ShowFaqList, a page-local aid, not site nav).
//  H1           every route: h1 <= 3 lines at 1280 and <= 4 lines at 390; hub h1 text is "19th SAOC National Orchid Show" with no lockup in the hero.
//  S1           cards: border-radius 16px and a box-shadow (elevation is a shadow, never a border); --radius-card resolves to 16px.
//  S2           one button anatomy: every filled link/button in <main> outside nav/steppers/disclosure is 50px tall, 10px radius, Karla 14px/700,
//               .12em tracking, uppercase (the F2 Button.tsx role).
//  S3           one disclosure surface per page: every <summary>/[aria-expanded] trigger shares one background/border/radius/padding signature.
//  S5b          quantity stepper keyboard focus shows a solid outline >= 2px.
//  S7           form labels and legends on vendors/apply and vendors/register are not uppercase.
//  EXH          /exhibitors: the 13 committee questions are a single-column <ul> (not an <ol>: they are not a sequence) with NO numerals; each item has
//               the question as an h3 (card-title role), the answer in Karla, and 1px --line dividers. The 7 ExhibitorSteps keep their <ol>.
//  EMPTY        empty-listing panels ([data-nos-empty-state]) are card surfaces: no dashed outline, 16px radius, shadow, no ghost placeholder rows.
//  NOWRAP       "Workshops & Field Trips tickets" never wraps.
//  PRES         /symposium keeps its Presenters section: h2 "Presenters" then ul.pc-grid, one column at 390, two from 1120px.
//  VEND         /vendors: the R11 chip "To be confirmed by the show committee" accompanies the prose, or the prose is cut.
import { allRoutes, main, openPage, withBrowser, rgbOf, rgbNear, firstFamily, LINE_RGB } from './_f3lib.mjs';

const CHIP = 'To be confirmed by the show committee';
const HUB_H1 = '19th SAOC National Orchid Show';

function measure(route) {
  const norm = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
  const vis = (e) => { const r = e.getBoundingClientRect(); if (!(r.width > 2 && r.height > 2)) return false; for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden' || x.hasAttribute('hidden')) return false; } return true; };
  const out = { route };
  out.navs = [...document.querySelectorAll('main nav')].filter(vis).map((n) => n.getAttribute('aria-label') ?? '(unlabelled)');
  out.exploreText = /Explore the National Show/i.test(document.body.innerText);
  const h1 = document.querySelector('h1');
  if (h1) { const lh = parseFloat(getComputedStyle(h1).lineHeight) || parseFloat(getComputedStyle(h1).fontSize) * 1.2; out.h1 = { text: norm(h1.textContent), lines: Math.round(h1.getBoundingClientRect().height / lh), lockup: !!document.querySelector('[data-nos-hero] img[src*="lockup" i], h1 img') }; }
  out.radiusCard = getComputedStyle(document.documentElement).getPropertyValue('--radius-card').trim() || getComputedStyle(document.querySelector('[data-nos-wrap]') ?? document.body).getPropertyValue('--radius-card').trim();
  out.cards = [...document.querySelectorAll('main article, main li, main [class*="card" i]')].filter(vis).map((e) => { const s = getComputedStyle(e); return { tag: `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)}`, shadow: s.boxShadow, radius: parseFloat(s.borderTopLeftRadius), border: parseFloat(s.borderTopWidth), bg: s.backgroundColor, dashed: s.borderTopStyle === 'dashed' }; }).filter((c) => c.shadow !== 'none' || c.border > 0).slice(0, 60);
  out.buttons = [...document.querySelectorAll('main a, main button')].filter((e) => vis(e) && !e.closest('nav, summary, [aria-expanded]') && !e.matches('[aria-expanded], [aria-label*="quantity" i]') && getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)' && getComputedStyle(e).display !== 'inline').map((e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { text: norm(e.textContent).slice(0, 30), h: r.height, radius: parseFloat(s.borderTopLeftRadius), family: s.fontFamily, size: parseFloat(s.fontSize), weight: Number(s.fontWeight), ls: parseFloat(s.letterSpacing), tt: s.textTransform }; });
  const disc = [...document.querySelectorAll('main summary, main button[aria-expanded]')].filter(vis);
  out.disclosure = [...new Set(disc.map((e) => { const s = getComputedStyle(e); return [s.backgroundColor, s.borderTopWidth, s.borderBottomWidth, s.borderTopLeftRadius, s.paddingTop, s.paddingLeft].join('|'); }))];
  out.labels = [...document.querySelectorAll('main label, main legend')].filter(vis).map((e) => ({ text: norm(e.textContent).slice(0, 30), tt: getComputedStyle(e).textTransform })).filter((l) => l.tt === 'uppercase');
  out.empty = [...document.querySelectorAll('[data-nos-empty-state]')].filter(vis).map((e) => { const s = getComputedStyle(e); return { dashed: s.borderTopStyle === 'dashed' || s.outlineStyle === 'dashed', radius: parseFloat(s.borderTopLeftRadius), shadow: s.boxShadow, ghost: e.querySelectorAll('[aria-hidden="true"], .skeleton, [class*="ghost" i], [class*="placeholder" i]').length }; });
  out.nowrap = [...document.querySelectorAll('a, button, span, li, p')].filter((e) => vis(e) && norm(e.textContent) === 'Workshops & Field Trips tickets' && !e.children.length).map((e) => { const s = getComputedStyle(e); return { ws: s.whiteSpace, lines: Math.round(e.getBoundingClientRect().height / (parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2)) }; });
  if (route === '/national-show/exhibitors') {
    const h2 = [...document.querySelectorAll('h2')].find((h) => /questions for the show committee/i.test(h.textContent));
    const sec = h2?.closest('section') ?? h2?.parentElement?.parentElement;
    const ul = sec ? [...sec.querySelectorAll('ul, ol')].find((o) => o.children.length === 13) : null;
    out.exh = { found: !!ul, tag: ul?.tagName.toLowerCase(), listTag: sec ? [...sec.querySelectorAll('ul, ol')].map((l) => `${l.tagName.toLowerCase()}:${l.children.length}`) : [], stepsOl: [...document.querySelectorAll('main ol')].filter((o) => o.children.length === 7).length };
    if (ul) {
      const lis = [...ul.children];
      out.exh.cols = new Set(lis.map((l) => Math.round(l.getBoundingClientRect().left))).size;
      out.exh.items = lis.map((li) => {
        const num = [...li.querySelectorAll('*')].find((e) => !e.children.length && /^\d{1,2}\.?$/.test(norm(e.textContent)));
        const h3 = li.querySelector('h3'); const p = li.querySelector('p, div:not(:has(*))');
        const cs = getComputedStyle(li);
        return { num: !!num, h3: !!h3, h3family: h3 ? getComputedStyle(h3).fontFamily : null, bodyFamily: p ? getComputedStyle(p).fontFamily : null, divider: [parseFloat(cs.borderBottomWidth), cs.borderBottomColor, parseFloat(cs.borderTopWidth), cs.borderTopColor] };
      });
    }
  }
  if (route === '/national-show/symposium') {
    const h2 = [...document.querySelectorAll('h2')].find((h) => /^presenters$/i.test(norm(h.textContent)));
    const ul = h2 ? (h2.closest('section') ?? h2.parentElement).querySelector('ul.pc-grid') : null;
    out.pres = { h2: !!h2, ul: !!ul, cols: ul ? new Set([...ul.children].filter(vis).map((l) => Math.round(l.getBoundingClientRect().left))).size : 0, items: ul ? ul.children.length : 0 };
  }
  // R19 renders the marker uppercase (text-transform), so innerText is uppercase: compare case-insensitively, or accept the marker's data attribute.
  if (route === '/national-show/vendors') out.vend = { chip: document.body.innerText.toLowerCase().includes('to be confirmed by the show committee') || !!document.querySelector('main [data-confirmation-badge], main [data-exhibitor-marker]'), prose: /Showcasing the Finest/i.test(document.body.innerText) };
  const steppers = [...document.querySelectorAll('main button[aria-label*="quantity" i]')].filter(vis);
  out.hasStepper = steppers.length > 0;
  return out;
}

await main('F3 audit', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of await allRoutes(browser)) {
      for (const [name, w, h] of [['1280', 1280, 800], ['390', 390, 844], ['1120', 1120, 800]]) {
        if (name === '1120' && route !== '/national-show/symposium') continue;
        const { ctx, page, status } = await openPage(browser, { width: w, height: h }, route);
        const tag = `${route} @${name}`;
        if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
        await page.waitForTimeout(250);
        const m = await page.evaluate(measure, route);
        if (name !== '1120') {
          for (const n of m.navs) if (!/ pages$|breadcrumb|^FAQ categories$/i.test(n)) r.fail(`${tag}: RULING-nav: <nav aria-label="${n}"> in <main> (ShowSectionNav must be gone; only the sub-nav, the Breadcrumb and the FAQ categories jump nav remain)`);
          if (m.exploreText) r.fail(`${tag}: RULING-nav: "Explore the National Show" still renders`);
          if (m.h1) {
            const max = w >= 1000 ? 3 : 4;
            if (m.h1.lines > max) r.fail(`${tag}: H1 wraps to ${m.h1.lines} lines, want <= ${max}`);
            if (route === '/national-show') { if (m.h1.text !== HUB_H1) r.fail(`${tag}: hub h1 is "${m.h1.text}", want "${HUB_H1}"`); if (m.h1.lockup) r.fail(`${tag}: hub hero carries a lockup image`); }
          } else r.fail(`${tag}: no h1`);
          if (!/^16(px)?$/.test(m.radiusCard)) r.fail(`${tag}: S1: --radius-card is "${m.radiusCard}", want 16px`);
          for (const c of m.cards) {
            if (c.dashed) continue; // judged by EMPTY
            if (c.shadow !== 'none' && c.radius > 0 && Math.abs(c.radius - 16) > 0.5) r.fail(`${tag}: S1: card ${c.tag} radius ${c.radius}px, want 16px`);
            if (c.shadow === 'none' && c.border > 0 && c.radius >= 12 && !/rgba\(0, 0, 0, 0\)/.test(c.bg)) r.fail(`${tag}: S1: card ${c.tag} is elevated by a border alone (no --shadow-md)`);
          }
          for (const b of m.buttons) if (Math.abs(b.h - 50) > 0.6 || Math.abs(b.radius - 10) > 0.5 || !/karla/i.test(firstFamily(b.family)) || Math.abs(b.size - 14) > 0.3 || b.weight !== 700 || Math.abs(b.ls - 1.68) > 0.15 || b.tt !== 'uppercase') r.fail(`${tag}: S2: button "${b.text}" is ${b.h.toFixed(0)}px/${b.radius}px ${firstFamily(b.family)} ${b.size}px/${b.weight} ls ${b.ls}px ${b.tt}, want the F2 Button.tsx role (50px, 10px, Karla 14px/700, .12em, uppercase)`);
          if (m.disclosure.length > 1) r.fail(`${tag}: S3: ${m.disclosure.length} different disclosure surfaces on one page (${m.disclosure.join(' ; ')})`);
          if (/vendors\/(apply|register)$/.test(route)) for (const l of m.labels) r.fail(`${tag}: S7: label/legend "${l.text}" is uppercase`);
          for (const e of m.empty) { if (e.dashed) r.fail(`${tag}: EMPTY: empty-listing panel has a dashed outline`); if (Math.abs(e.radius - 16) > 0.5 || e.shadow === 'none') r.fail(`${tag}: EMPTY: empty-listing panel is not a card surface (radius ${e.radius}px, shadow ${e.shadow})`); if (e.ghost) r.fail(`${tag}: EMPTY: ${e.ghost} ghost placeholder row(s) in the empty-listing panel`); }
          for (const n of m.nowrap) if (n.ws !== 'nowrap' || n.lines > 1) r.fail(`${tag}: NOWRAP: "Workshops & Field Trips tickets" is white-space:${n.ws}, ${n.lines} line(s)`);
          if (route === '/national-show/vendors' && m.vend && m.vend.prose && !m.vend.chip) r.fail(`${tag}: VEND: the vendors prose has no R11 chip "${CHIP}" (add the chip or cut the prose)`);
          if (m.hasStepper) {
            const f = await page.evaluate(() => { const b = document.querySelector('main button[aria-label*="quantity" i]'); b.focus(); const s = getComputedStyle(b); return { style: s.outlineStyle, w: parseFloat(s.outlineWidth) }; });
            await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
            const f2 = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { style: s.outlineStyle, w: parseFloat(s.outlineWidth), isStepper: /quantity/i.test(document.activeElement.getAttribute('aria-label') ?? '') }; });
            if (f2.isStepper && (f2.style !== 'solid' || f2.w < 2)) r.fail(`${tag}: S5b: stepper focus outline is ${f2.w}px ${f2.style}, want solid >= 2px`);
            if (!f2.isStepper && (f.style !== 'solid' || f.w < 2)) r.fail(`${tag}: S5b: stepper focus outline is ${f.w}px ${f.style}, want solid >= 2px`);
          }
          if (m.exh) {
            if (!m.exh.found || m.exh.tag !== 'ul') r.fail(`${tag}: EXH: the 13 questions must be one <ul> under "Questions for the show committee" (found lists: ${m.exh.listTag.join(', ')})`);
            else {
              if (m.exh.cols !== 1) r.fail(`${tag}: EXH: the 13 questions sit in ${m.exh.cols} columns, want a single column`);
              m.exh.items.forEach((it, i) => {
                const id = `${tag}: EXH item ${i + 1}`;
                if (it.num) r.fail(`${id}: has a numeral; the questions are not a sequence`);
                if (!it.h3) r.fail(`${id}: the question is not an h3`);
                if (it.bodyFamily && !/karla/i.test(firstFamily(it.bodyFamily))) r.fail(`${id}: answer is ${firstFamily(it.bodyFamily)}, want Karla`);
                const [bw, bc, tw, tc] = it.divider;
                if (!((Math.abs(bw - 1) <= 0.1 && rgbNear(rgbOf(bc), LINE_RGB, 2)) || (Math.abs(tw - 1) <= 0.1 && rgbNear(rgbOf(tc), LINE_RGB, 2)))) r.fail(`${id}: no 1px --line divider (bottom ${bw}px ${bc}, top ${tw}px ${tc})`);
              });
            }
            if (m.exh.stepsOl < 1) r.fail(`${tag}: EXH: the 7 ExhibitorSteps lost their <ol>`);
          }
        } else if (m.pres) {
          if (!m.pres.h2 || !m.pres.ul) r.fail(`${tag}: PRES: the Presenters section (h2 "Presenters" + ul.pc-grid) does not render`);
          else if (m.pres.cols !== 2 && m.pres.items >= 2) r.fail(`${tag}: PRES: ul.pc-grid has ${m.pres.cols} column(s) at 1120, want 2`);
        }
        if (name === '390' && m.pres && m.pres.ul && m.pres.cols !== 1) r.fail(`${tag}: PRES: ul.pc-grid has ${m.pres.cols} columns at 390, want 1`);
        if (name === '1280' && route === '/national-show/symposium' && !(m.pres?.h2 && m.pres?.ul)) r.fail(`${tag}: PRES: the Presenters section does not render`);
        await ctx.close();
      }
    }
  });
});
