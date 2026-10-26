// FS-1 (NOS Design final-shot rulings, root comms.md L4263): measured gates for the items that drifted from their goldens while the gate stayed green.
// Values live in goldens/fs-rulings.json. FS-2 adds an `fs2` key there and entries in ROUTE_HANDLERS below; nothing here is edited for it.
// Every check names the hole it closes. A failing cell reports its number; nothing is retuned here.
import { readFileSync } from 'node:fs';
import { gotoRoute, newContext } from './_lib.mjs';

const RULINGS = JSON.parse(readFileSync('.agent/memory/project/specs/nos-content-standard/goldens/fs-rulings.json', 'utf8'));
const FS1 = RULINGS.fs1;
const clampAt = ([min, base, k, max], w) => Math.min(max, Math.max(min, base + k * w));
const near = (a, b, t = 1) => Number.isFinite(a) && Math.abs(a - b) <= t;

/** Item 1. /tickets at <= 419 (390 and 360). Hole: no check ran on /tickets below 2056 and none read a rotated box; cardImageChecks measured image resolution only. */
export async function fsTickets(browser, server, c) {
  const T = FS1.tickets;
  for (const width of T.widths) {
    const vp = { name: `${width}@2`, width, height: 800, dsf: 2 }; const tag = `[${vp.name} ${T.route} FS-1.1]`;
    const context = await newContext(browser, vp); const page = await context.newPage();
    if (await gotoRoute(page, server, T.route, c, tag)) {
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => {
        const px = (v) => parseFloat(v) || 0;
        const wraps = [...document.querySelectorAll('.nk-wrap')];
        const out = wraps.map((w) => {
          const deck = w.closest('.nk-fan') ?? w.closest('.nk-grid') ?? w.parentElement; const dcs = getComputedStyle(deck); const db = deck.getBoundingClientRect();
          const boxes = [w, ...w.querySelectorAll('*')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
          const l = Math.min(...boxes.map((r) => r.left)); const r = Math.max(...boxes.map((q) => q.right)); const t = Math.min(...boxes.map((q) => q.top)); const b = Math.max(...boxes.map((q) => q.bottom));
          const rotEl = [w, ...w.querySelectorAll('*')].find((e) => getComputedStyle(e).transform !== 'none');
          const mt = rotEl ? getComputedStyle(rotEl).transform.match(/matrix\(([^)]+)\)/) : null; const mv = mt ? mt[1].split(',').map(Number) : null;
          const ang = mv ? Math.atan2(mv[1], mv[0]) * 180 / Math.PI : 0;
          return { n: [...deck.querySelectorAll('.nk-wrap')].indexOf(w) + 1, ang, l, r, t, b, cl: db.left + px(dcs.borderLeftWidth) + px(dcs.paddingLeft), cr: db.right - px(dcs.borderRightWidth) - px(dcs.paddingRight),
            pl: px(dcs.paddingLeft), pr: px(dcs.paddingRight), gap: px(dcs.columnGap), deck: deck.className.toString().split(' ')[0], row: Math.round(w.offsetTop) };
        });
        return out;
      });
      c.check(`${tag} FS-1.1 the deck has .nk-wrap cards (${m.length})`, m.length > 0);
      if (m.length) {
        const sgn = (n) => (n % 2 === 1 ? -T.rotateDeg : T.rotateDeg);
        c.check(`${tag} FS-1.1 tilt is -${T.rotateDeg}deg on odd and +${T.rotateDeg}deg on even cards (${m.map((x) => `${x.n}:${x.ang.toFixed(2)}`).join(' ')})`, m.every((x) => near(x.ang, sgn(x.n), T.rotateTolDeg)));
        c.check(`${tag} FS-1.1 the deck (${m[0].deck}) has padding-inline ${T.deckPaddingInline}px and column-gap ${T.columnGap}px (${m[0].pl}/${m[0].pr}, gap ${m[0].gap})`, near(m[0].pl, T.deckPaddingInline, T.tolPx) && near(m[0].pr, T.deckPaddingInline, T.tolPx) && near(m[0].gap, T.columnGap, T.tolPx));
        const clipped = m.filter((x) => x.l < x.cl - T.tolPx || x.r > x.cr + T.tolPx);
        c.check(`${tag} FS-1.1 no rotated card is clipped by the gutter: every rotated bounding box sits inside the deck's content box (${clipped.map((x) => `#${x.n} ${x.l.toFixed(1)}..${x.r.toFixed(1)} vs ${x.cl.toFixed(1)}..${x.cr.toFixed(1)}`).join('; ') || 'all inside'})`, clipped.length === 0);
        const overlaps = [];
        for (let i = 0; i < m.length; i += 1) for (let j = i + 1; j < m.length; j += 1) {
          const ox = Math.min(m[i].r, m[j].r) - Math.max(m[i].l, m[j].l); const oy = Math.min(m[i].b, m[j].b) - Math.max(m[i].t, m[j].t);
          if (ox > T.tolPx && oy > T.tolPx) overlaps.push(`#${m[i].n}/#${m[j].n} ${ox.toFixed(1)}x${oy.toFixed(1)}`);
        }
        c.check(`${tag} FS-1.1 no two rotated cards overlap, so in each row left.right <= right.left (${overlaps.join('; ') || 'none'})`, overlaps.length === 0);
      }
    }
    await context.close();
  }
}

/** Item 2. /international-guests: no aside or name index; each profile spans the full content width. Hole: IG-G1 only capped the FIRST grid column (<= 320) and counted rows; the bio squeezed into 316px and a name-index aside both passed. */
async function fsIg(page, route, vp, c, tag) {
  const G = FS1.internationalGuests; const t = `${tag} FS-1.2`;
  const m = await page.evaluate(() => {
    const px = (v) => parseFloat(v) || 0; const main = document.querySelector('main');
    const idx = [...main.querySelectorAll('aside, [data-doc-aside], [data-guest-index], [data-name-index], nav[data-doc-index]')].map((e) => (e.getAttribute('data-guest-index') !== null ? 'data-guest-index' : e.tagName.toLowerCase() + (e.className ? '.' + e.className.toString().split(' ')[0] : '')));
    const layout = document.querySelector('[data-doc-layout]') ?? main; const lcs = getComputedStyle(layout); const lw = layout.getBoundingClientRect().width - px(lcs.paddingLeft) - px(lcs.paddingRight);
    const rows = [...document.querySelectorAll('[data-guest-profile]')].map((r) => {
      const cs = getComputedStyle(r); const cols = cs.gridTemplateColumns.trim().split(/\s+/).map(px); const lead = r.querySelector('p');
      let leadW = null; let ch = null; if (lead) { leadW = lead.getBoundingClientRect().width; const s = document.createElement('span'); s.style.cssText = 'position:absolute;visibility:hidden;width:1ch'; lead.appendChild(s); ch = s.getBoundingClientRect().width; s.remove(); }
      return { w: r.getBoundingClientRect().width, cols, leadW, ch, name: (r.querySelector('h2, h3')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 20) };
    });
    return { idx, lw, rows };
  });
  c.check(`${t} no aside and no name-index card on the page (${m.idx.join(', ') || 'none'})`, m.idx.length === 0);
  if (!m.rows.length) { c.note(`${t} no guest profiles rendered; the width checks need one`); return; }
  c.check(`${t} every profile spans the full content width (${m.rows.map((r) => Math.round(r.w)).join(',')} vs ${Math.round(m.lw)})`, m.rows.every((r) => r.w >= m.lw - G.fullWidthTolPx));
  if (vp.width >= G.portraitColFrom) {
    c.check(`${t} the portrait column is ${G.portraitCol}px (${m.rows.map((r) => Math.round(r.cols[0])).join(',')})`, m.rows.every((r) => near(r.cols[0], G.portraitCol, 1)));
    c.check(`${t} the text column is not squeezed: at least ${G.textColMinShare * 100}% of the content width (${m.rows.map((r) => Math.round(r.cols[1] ?? 0)).join(',')} of ${Math.round(m.lw)})`, m.rows.every((r) => (r.cols[1] ?? 0) >= m.lw * G.textColMinShare));
    c.check(`${t} the lead paragraph is at most ${G.leadMaxCh}ch (${m.rows.map((r) => (r.leadW === null ? '-' : `${Math.round(r.leadW)}px/${(r.leadW / r.ch).toFixed(0)}ch`)).join(',')})`, m.rows.every((r) => r.leadW === null || r.leadW <= G.leadMaxCh * r.ch + 2));
  }
}

/** Item 3. /symposium Tibbs: as designed (PR-1 has no placeholder tile; the EMPTY portrait cell keeps every name on one axis). Hole: PR-1 required NO portrait element and counted an empty cell as a placeholder tile, so the designed state failed; the axis was never measured. */
async function fsSymposium(page, route, vp, c, tag) {
  const S = FS1.symposiumProfiles; const t = `${tag} FS-1.3`;
  if (vp.width < S.axisFrom) return;
  const m = await page.evaluate(() => [...document.querySelectorAll('[data-guest-profile]')].map((r) => {
    const n = r.querySelector('h2, h3'); return { name: (n?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 16), left: n ? Math.round(n.getBoundingClientRect().left * 10) / 10 : null, img: Boolean(r.querySelector('[data-guest-portrait] img')) };
  }));
  if (m.length < 2) { c.note(`${t} fewer than two profiles; the one-axis check needs two`); return; }
  c.check(`${t} every name sits on one axis, whether or not the portrait cell holds a photo (${m.map((x) => `${x.name}:${x.left}${x.img ? '' : ' (empty)'}`).join(' | ')})`, m.every((x) => x.left !== null && near(x.left, m[0].left, S.axisTolPx)));
}

/** Item 4. Home register type scale and the hours card (HM-G1). Hole: the Visit/Programme checks read text, order, arrows and column counts only, and the card check read position and text; bare rows in small sans passed. */
export async function fsHome(page, vp, c, tag, ctx) {
  const H = FS1.home; const t = `${tag} FS-1.4`;
  await fsCardSurface(page, { nos: '/' }, vp, c, tag);
  const m = await page.evaluate(({ dateLabel, dateLine }) => {
    const px = (v) => parseFloat(v) || 0; const fam = (e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase();
    const sec = (k) => document.querySelector(`[data-hm-section="${k}"]`);
    const ch = (e) => { const s = document.createElement('span'); s.style.cssText = 'position:absolute;visibility:hidden;width:1ch'; e.appendChild(s); const w = s.getBoundingClientRect().width; s.remove(); return w; };
    const visit = sec('visit'); const list = visit ? visit.querySelector('ul') : null; const lcs = list ? getComputedStyle(list) : null;
    const items = list ? [...list.querySelectorAll('a')].map((a) => {
      const cs = getComputedStyle(a); const li = a.closest('li'); const lics = li ? getComputedStyle(li) : null; const ab = a.getBoundingClientRect();
      const h3 = a.querySelector('h3') ?? li?.querySelector('h3') ?? null; const hcs = h3 ? getComputedStyle(h3) : cs;
      const arrow = [...a.querySelectorAll('*')].find((e) => e.children.length === 0 && (e.tagName.toLowerCase() === 'svg' || /→/.test(e.textContent))) ?? null; const arb = arrow ? arrow.getBoundingClientRect() : null;
      const acs = arrow ? getComputedStyle(arrow) : null;
      return { display: cs.display, tracks: cs.gridTemplateColumns.trim().split(/\s+/).map(px), minH: px(cs.minHeight), pt: px(cs.paddingTop), pb: px(cs.paddingBottom), pr: px(cs.paddingRight),
        liTop: lics ? px(lics.borderTopWidth) : 0, liBot: lics ? px(lics.borderBottomWidth) : 0, aTop: px(cs.borderTopWidth), aBot: px(cs.borderBottomWidth),
        h3: Boolean(h3), fam: fam(h3 ?? a), w: hcs.fontWeight, px: px(hcs.fontSize), arrow: Boolean(arrow), arrowPx: arrow ? (arrow.tagName.toLowerCase() === 'svg' ? arb.width : px(acs.fontSize)) : 0, arrowRight: arb ? arb.right : null, aRight: ab.right };
    }) : [];
    const prog = sec('programme'); const progRows = prog ? [...prog.querySelectorAll('h3')].map((h) => {
      const row = h.closest('li, article, div'); const p = row ? row.querySelector('p') : null; const pcs = p ? getComputedStyle(p) : null;
      return { h3px: px(getComputedStyle(h).fontSize), h3fam: fam(h), pPx: pcs ? px(pcs.fontSize) : null, pLh: pcs ? px(pcs.lineHeight) : null, pW: p ? p.getBoundingClientRect().width : null, pCh: p ? ch(p) : null };
    }) : [];
    const card = document.querySelector('[data-hm-visit-card]'); let cardInfo = null;
    if (card) {
      const cs = getComputedStyle(card); const leaf = (txt) => [...card.querySelectorAll('*')].filter((e) => e.textContent.replace(/\s+/g, ' ').trim() === txt).sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0] ?? null;
      const lab = leaf(dateLabel); const dat = leaf(dateLine); const dds = [...card.querySelectorAll('dd')];
      const ruled = dds.map((d) => { const r = d.closest('div') ?? d.parentElement; const rs = r ? getComputedStyle(r) : null; const dts = d.previousElementSibling ? getComputedStyle(d.previousElementSibling) : null; const dcs = getComputedStyle(d);
        return px(rs?.borderTopWidth) + px(rs?.borderBottomWidth) + px(dts?.borderTopWidth) + px(dts?.borderBottomWidth) + px(dcs.borderTopWidth) + px(dcs.borderBottomWidth) > 0; });
      cardInfo = { bg: cs.backgroundColor, pos: cs.position, dsCard: card.matches('.ds-card') || Boolean(card.closest('.ds-card')), pad: px(cs.paddingTop),
        lab: lab ? { fam: fam(lab), w: getComputedStyle(lab).fontWeight, px: px(getComputedStyle(lab).fontSize) } : null, dat: dat ? { fam: fam(dat), w: getComputedStyle(dat).fontWeight, px: px(getComputedStyle(dat).fontSize) } : null,
        dds: dds.map((d) => ({ fam: fam(d), px: px(getComputedStyle(d).fontSize), ws: getComputedStyle(d).whiteSpace })), ruled };
    }
    return { cols: lcs ? lcs.gridTemplateColumns.trim().split(/\s+/).length : 0, colGap: lcs ? px(lcs.columnGap) : 0, items, progRows, cardInfo };
  }, ctx);
  c.check(`${t} Visit: the register is a ruled grid, each link grid 1fr/${H.visit.arrowCol}px, min-height ${H.visit.minHeight}, padding-block ${H.visit.paddingBlock} (${m.items.map((i) => `${i.display} ${i.tracks.map(Math.round).join('/')} h${i.minH} p${i.pt}/${i.pb}`).join(' | ')})`,
    m.items.length > 0 && m.items.every((i) => i.display === 'grid' && i.tracks.length === 2 && near(i.tracks[1], H.visit.arrowCol, 0.5) && near(i.minH, H.visit.minHeight, 0.5) && near(i.pt, H.visit.paddingBlock, 0.5) && near(i.pb, H.visit.paddingBlock, 0.5)));
  c.check(`${t} Visit: a rule top and bottom on each Visit li (${m.items.map((i) => `${i.liTop || i.aTop}/${i.liBot || i.aBot}`).join(',')})`, m.items.length > 0 && m.items.every((i) => (i.liTop || i.aTop) >= 1 && (i.liBot || i.aBot) >= 1));
  if (vp.width >= 1024) c.check(`${t} Visit: ${H.visit.columnsDesktop} columns, column-gap ${H.visit.columnGap} (${m.cols}, ${m.colGap})`, m.cols === H.visit.columnsDesktop && near(m.colGap, H.visit.columnGap, 0.5));
  c.check(`${t} Visit h3: Fraunces ${H.visit.h3Weight} ${H.visit.h3Px}px, and the arrow is ${H.visit.arrowPx}px at the cell end (${m.items.map((i) => `${i.h3 ? 'h3' : 'no h3'} ${i.fam} ${i.w} ${i.px}; arrow ${i.arrowPx}${i.arrowRight === null ? ' none' : ` end ${Math.round(i.aRight - i.pr - i.arrowRight)}`}`).join(' | ')})`,
    m.items.length > 0 && m.items.every((i) => i.h3 && i.fam.includes('fraunces') && i.w === H.visit.h3Weight && near(i.px, H.visit.h3Px, 0.5) && i.arrow && near(i.arrowPx, H.visit.arrowPx, 0.5) && i.arrowRight !== null && i.arrowRight >= i.aRight - i.pr - 3));
  const ph = clampAt(H.programme.h3Clamp, vp.width);
  c.check(`${t} Programme h3 is Fraunces at clamp(1.375rem, 1.2rem + 0.6vw, 1.75rem) = ${ph.toFixed(1)}px; its p is ${H.programme.pPx}px/${H.programme.pLineHeight}, at most ${H.programme.pMaxCh}ch (${m.progRows.map((r) => `${r.h3fam} ${r.h3px.toFixed(1)} | p ${r.pPx}/${r.pLh} ${r.pW === null ? '-' : (r.pW / r.pCh).toFixed(0) + 'ch'}`).join(' ; ')})`,
    m.progRows.length > 0 && m.progRows.every((r) => r.h3fam.includes('fraunces') && near(r.h3px, ph, 1) && near(r.pPx, H.programme.pPx, 0.5) && near(r.pLh, H.programme.pPx * H.programme.pLineHeight, 0.6) && r.pW !== null && r.pW <= H.programme.pMaxCh * r.pCh + 2));
  const ci = m.cardInfo; const dp = clampAt(H.hours.datesClamp, vp.width);
  c.check(`${t} About hours is a white static .ds-card with padding (${ci ? `${ci.bg}; ${ci.pos}; ds-card ${ci.dsCard}; padding ${ci.pad}` : 'no [data-hm-visit-card]'})`, Boolean(ci) && ci.bg === H.hours.white && ci.pos !== 'sticky' && ci.pad > 0);
  c.check(`${t} hours label is sans ${H.hours.labelWeight} ${H.hours.labelPx}px; dates are Fraunces ${H.hours.datesWeight} clamp(1.5rem, 1.3rem + 0.6vw, 1.875rem) = ${dp.toFixed(1)}px (${ci && ci.lab ? `${ci.lab.fam} ${ci.lab.w} ${ci.lab.px}` : 'no label'}; ${ci && ci.dat ? `${ci.dat.fam} ${ci.dat.w} ${ci.dat.px.toFixed(1)}` : 'no dates'})`,
    Boolean(ci && ci.lab && ci.dat) && !ci.lab.fam.includes('fraunces') && ci.lab.w === H.hours.labelWeight && near(ci.lab.px, H.hours.labelPx, 0.5) && ci.dat.fam.includes('fraunces') && ci.dat.w === H.hours.datesWeight && near(ci.dat.px, dp, 1));
  c.check(`${t} hours rows are ruled and each dd is Fraunces ${H.hours.ddPx}px nowrap (${ci ? ci.dds.map((d) => `${d.px.toFixed(1)} ${d.ws}`).join(', ') : '-'}; ruled ${ci ? ci.ruled.join(',') : '-'})`, Boolean(ci) && ci.dds.length > 0 && ci.ruled.every(Boolean) && ci.dds.every((d) => d.fam.includes('fraunces') && near(d.px, H.hours.ddPx, 0.5) && /nowrap/.test(d.ws)));
}

/** Item 6. /exhibitors (EX-G1): standfirst gap and measure, ruled Q&A, plain ruled aside. Hole: EX-G1 checked text, order, h2 family/weight, link rows >= 64 and the arrow glyph only; no gap, rule, answer size, standfirst size or card test existed. Hooks the dev adds: [data-qa-list] on the list, [data-qa-item] on each item. */
async function fsExhibitors(page, route, vp, c, tag) {
  const E = FS1.exhibitors; const t = `${tag} FS-1.6`;
  const m = await page.evaluate(() => {
    const px = (v) => parseFloat(v) || 0; const fam = (e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase();
    const ch = (e) => { const s = document.createElement('span'); s.style.cssText = 'position:absolute;visibility:hidden;width:1ch'; e.appendChild(s); const w = s.getBoundingClientRect().width; s.remove(); return w; };
    const main = document.querySelector('[data-doc-main]'); const list = document.querySelector('[data-qa-list]'); const items = [...document.querySelectorAll('[data-qa-item]')];
    const sf = main ? [...main.querySelectorAll('p')].find((p) => !list || !list.contains(p)) : null; const scs = sf ? getComputedStyle(sf) : null;
    const mcs = main ? getComputedStyle(main) : null;
    const qa = items.map((it) => { const cs = getComputedStyle(it); const q = it.querySelector('h2, h3'); const a = it.querySelector('p'); const qb = q?.getBoundingClientRect(); const ab = a?.getBoundingClientRect(); const acs = a ? getComputedStyle(a) : null; const qcs = q ? getComputedStyle(q) : null;
      return { pt: px(cs.paddingTop), pb: px(cs.paddingBottom), bb: px(cs.borderBottomWidth), gap: qb && ab ? ab.top - qb.bottom : null, qLh: qcs ? px(qcs.lineHeight) : null, qPx: qcs ? px(qcs.fontSize) : null, aPx: acs ? px(acs.fontSize) : null, aLh: acs ? px(acs.lineHeight) : null, aW: ab ? ab.width : null, aCh: a ? ch(a) : null }; });
    const aside = document.querySelector('[data-doc-aside]'); const as = aside ? getComputedStyle(aside) : null;
    const links = aside ? [...aside.querySelectorAll('a')].map((a) => { const cs = getComputedStyle(a); const li = a.closest('li'); const lcs = li ? getComputedStyle(li) : null; const ab = a.getBoundingClientRect();
      const arrow = [...a.querySelectorAll('*')].find((e) => e.children.length === 0 && (e.tagName.toLowerCase() === 'svg' || /→/.test(e.textContent))) ?? null; const arb = arrow ? arrow.getBoundingClientRect() : null;
      return { h: ab.height, fam: fam(a), w: cs.fontWeight, px: px(cs.fontSize), rule: px(cs.borderTopWidth) + px(cs.borderBottomWidth) + (lcs ? px(lcs.borderTopWidth) + px(lcs.borderBottomWidth) : 0), arrow: Boolean(arrow), arrowPx: arrow ? (arrow.tagName.toLowerCase() === 'svg' ? arb.width : px(getComputedStyle(arrow).fontSize)) : 0, endGap: arb ? ab.right - px(cs.paddingRight) - arb.right : null }; }) : [];
    return { hasMain: Boolean(main), hasList: Boolean(list), mainGap: mcs ? px(mcs.rowGap) : null, mainDisp: mcs?.display, listTop: list ? px(getComputedStyle(list).borderTopWidth) : null, listY: list ? list.getBoundingClientRect().top : null, sfBottom: sf ? sf.getBoundingClientRect().bottom : null,
      sf: sf ? { fam: fam(sf), w: scs.fontWeight, px: px(scs.fontSize), lh: px(scs.lineHeight), wpx: sf.getBoundingClientRect().width, ch: ch(sf) } : null, qa,
      aside: aside ? { bgA: as.backgroundColor.replace(/\s/g, '').match(/rgba\(.*,([\d.]+)\)/)?.[1] ?? (as.backgroundColor === 'transparent' ? '0' : '1'), shadow: as.boxShadow, radius: px(as.borderTopLeftRadius), bw: px(as.borderTopWidth) + px(as.borderLeftWidth) + px(as.borderRightWidth) + px(as.borderBottomWidth), ds: aside.matches('.ds-card, [data-ticket-card]') || Boolean(aside.closest('.ds-card, [data-ticket-card]')) } : null, links };
  });
  const g = clampAt(E.mainGapClamp, vp.width);
  c.check(`${t} the gap between the standfirst and the answers is clamp(40px, 5vw, 56px) = ${g.toFixed(1)}px, computed and measured (${m.mainDisp} row-gap ${m.mainGap}; measured ${m.listY !== null && m.sfBottom !== null ? (m.listY - m.sfBottom).toFixed(1) : 'no [data-qa-list]'})`, m.hasList && m.sfBottom !== null && near(m.listY - m.sfBottom, g, 2) && (m.mainGap === null || near(m.mainGap, g, 1)));
  const sfp = clampAt(E.standfirst.clamp, vp.width);
  c.check(`${t} standfirst: ${E.standfirst.ch}ch, Fraunces ${E.standfirst.weight} ${sfp.toFixed(1)}px/${E.standfirst.lineHeight} (${m.sf ? `${m.sf.fam} ${m.sf.w} ${m.sf.px.toFixed(1)}/${(m.sf.lh / m.sf.px).toFixed(2)} ${(m.sf.wpx / m.sf.ch).toFixed(0)}ch` : 'none'})`, Boolean(m.sf) && m.sf.fam.includes('fraunces') && m.sf.w === E.standfirst.weight && near(m.sf.px, sfp, 1) && near(m.sf.lh / m.sf.px, E.standfirst.lineHeight, 0.03) && m.sf.wpx <= E.standfirst.ch * m.sf.ch + 2);
  c.check(`${t} .ds-qa: a top rule on [data-qa-list], then ${m.qa.length} [data-qa-item]s each padding ${E.qa.itemPaddingBlock}px 0 with a bottom rule (${m.hasList ? `top ${m.listTop}` : 'no [data-qa-list]'}; ${m.qa.map((q) => `${q.pt}/${q.pb} rule ${q.bb}`).join(',')})`, m.hasList && m.listTop >= E.qa.ruleMinPx && m.qa.length > 0 && m.qa.every((q) => near(q.pt, E.qa.itemPaddingBlock, 0.5) && near(q.pb, E.qa.itemPaddingBlock, 0.5) && q.bb >= E.qa.ruleMinPx));
  c.check(`${t} each item: question to answer gap ${E.qa.gap}px, question line-height ${E.qa.qLineHeight}, answer ${E.qa.aPx}px/${E.qa.aLineHeight} at most ${E.qa.aMaxCh}ch (${m.qa.map((q) => `gap ${q.gap === null ? '-' : q.gap.toFixed(1)} q ${q.qLh && q.qPx ? (q.qLh / q.qPx).toFixed(2) : '-'} a ${q.aPx}/${q.aLh && q.aPx ? (q.aLh / q.aPx).toFixed(2) : '-'} ${q.aW && q.aCh ? (q.aW / q.aCh).toFixed(0) : '-'}ch`).join(' | ')})`,
    m.qa.length > 0 && m.qa.every((q) => q.gap !== null && near(q.gap, E.qa.gap, 1) && near(q.qLh / q.qPx, E.qa.qLineHeight, 0.02) && near(q.aPx, E.qa.aPx, 0.5) && near(q.aLh / q.aPx, E.qa.aLineHeight, 0.03) && q.aW <= E.qa.aMaxCh * q.aCh + 2));
  const al = clampAt(E.aside.clamp, vp.width);
  c.check(`${t} the aside is a plain ruled list, not a white card: transparent, no shadow, no radius, no border, no .ds-card (${m.aside ? `alpha ${m.aside.bgA}; shadow ${m.aside.shadow}; r ${m.aside.radius}; border ${m.aside.bw}; card ${m.aside.ds}` : 'no aside'})`, Boolean(m.aside) && Number(m.aside.bgA) === 0 && m.aside.shadow === 'none' && m.aside.radius === 0 && m.aside.bw === 0 && !m.aside.ds);
  c.check(`${t} aside rows: min-height ${E.aside.rowMinHeight}, ruled, Fraunces ${E.aside.weight} clamp(1.25rem, 1.1rem + 0.4vw, 1.5rem) = ${al.toFixed(1)}px, a ${E.aside.arrowPx}px arrow at the row end (${m.links.map((l) => `h${Math.round(l.h)} rule ${l.rule} ${l.fam} ${l.w} ${l.px.toFixed(1)} arrow ${l.arrowPx} end ${l.endGap === null ? '-' : l.endGap.toFixed(0)}`).join(' | ')})`,
    m.links.length > 0 && m.links.every((l) => l.h >= E.aside.rowMinHeight - 0.5 && l.rule >= 1 && l.fam.includes('fraunces') && l.w === E.aside.weight && near(l.px, al, 1) && l.arrow && near(l.arrowPx, E.aside.arrowPx, 0.5) && l.endGap !== null && l.endGap <= 3));
}

/** Item 7. /contact (CT-G1): the white sticky card, row-gap, serif place and phone, plain arrows. Hole: CT-G1 checked sticky, text, order, the → glyph and row height only; the card's paint, the row-gap, every font and the arrow's ring were unmeasured. */
export async function fsContact(page, vp, c, tag, ctx) {
  const K = FS1.contact; const t = `${tag} FS-1.7`;
  const m = await page.evaluate(({ place, person, role, label }) => {
    const px = (v) => parseFloat(v) || 0; const fam = (e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase();
    const card = document.querySelector('[data-ct-card]'); const team = document.querySelector('[data-ct-team]'); const form = document.querySelector('main form');
    const leaf = (txt, partial) => card ? ([...card.querySelectorAll('*')].filter((e) => { const x = e.textContent.replace(/\s+/g, ' ').trim(); return partial ? x.includes(txt) : x === txt; }).sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0] ?? null) : null;
    const info = (e) => { if (!e) return null; const cs = getComputedStyle(e); return { fam: fam(e), w: cs.fontWeight, px: px(cs.fontSize), deco: cs.textDecorationLine, top: e.getBoundingClientRect().top, bottom: e.getBoundingClientRect().bottom }; };
    let lca = null; if (form && team) { lca = form.parentElement; while (lca && !lca.contains(team)) lca = lca.parentElement; }
    const ccs = card ? getComputedStyle(card) : null; const lcs = lca ? getComputedStyle(lca) : null;
    const tel = card ? card.querySelector('a[href^="tel:"]') : null; const gate = card ? card.querySelector(`[aria-label="${label}"]`) : null;
    const gl = gate ? [...gate.querySelectorAll('a')].map((a) => { const cs = getComputedStyle(a); const ab = a.getBoundingClientRect();
      const arrow = [...a.querySelectorAll('*')].find((e) => e.children.length === 0 && (e.tagName.toLowerCase() === 'svg' || /→/.test(e.textContent))) ?? null;
      let ring = false; let el = arrow; while (el && el !== a.parentElement) { const s = getComputedStyle(el); const w = el.getBoundingClientRect().width; if (px(s.borderTopWidth) > 0 || px(s.borderLeftWidth) > 0 || (px(s.borderTopLeftRadius) >= w / 2 - 0.5 && w > 0 && el !== a) || (el !== a && !/rgba\(.*, ?0\)|transparent/.test(s.backgroundColor))) ring = true; if (el === a) break; el = el.parentElement; }
      return { h: ab.height, fam: fam(a), w: cs.fontWeight, px: px(cs.fontSize), arrow: Boolean(arrow), arrowPx: arrow ? (arrow.tagName.toLowerCase() === 'svg' ? arrow.getBoundingClientRect().width : px(getComputedStyle(arrow).fontSize)) : 0, stroke: arrow && arrow.tagName.toLowerCase() === 'svg' ? getComputedStyle(arrow).stroke !== 'none' || Boolean(arrow.querySelector('[stroke]')) : null, ring }; }) : [];
    return { hasCard: Boolean(card), bg: ccs?.backgroundColor, pad: ccs ? px(ccs.paddingTop) : null, padL: ccs ? px(ccs.paddingLeft) : null, pos: ccs?.position, top: ccs ? px(ccs.top) : null, rowStart: ccs?.gridRowStart, rowEnd: ccs?.gridRowEnd, ds: card ? card.matches('.ds-card') || Boolean(card.closest('.ds-card')) : false,
      lcaGap: lcs ? px(lcs.rowGap) : null, lcaDisp: lcs?.display, formBottom: form ? form.getBoundingClientRect().bottom : null, teamTop: team ? team.getBoundingClientRect().top : null,
      place: info(leaf(place, false)), phone: info(tel), person: info(leaf(`${person} - ${role}`, true)), gl };
  }, ctx);
  const pad = clampAt(K.cardPaddingClamp, vp.width);
  c.check(`${t} the card is the white .ds-card with padding clamp(28px, 3vw, 40px) = ${pad.toFixed(1)}px (${m.hasCard ? `${m.bg}; padding ${m.pad}/${m.padL}; ds-card ${m.ds}` : 'no [data-ct-card]'})`, m.hasCard && m.bg === K.cardWhite && near(m.pad, pad, 1) && near(m.padL, pad, 1));
  if (vp.width >= K.rowGapFrom) {
    c.check(`${t} the card is sticky at top ${K.cardStickyTop} and spans both rows of the grid (${m.pos} ${m.top}; grid-row ${m.rowStart} / ${m.rowEnd})`, m.pos === 'sticky' && m.top === K.cardStickyTop && /span 2|^3$|^-1$/.test(m.rowEnd ?? ''));
    const g = clampAt(K.rowGapClamp, vp.width);
    c.check(`${t} form to committee row-gap is clamp(72px, 9vw, 112px) = ${g.toFixed(1)}px (${m.lcaDisp} row-gap ${m.lcaGap}; measured ${m.formBottom !== null && m.teamTop !== null ? (m.teamTop - m.formBottom).toFixed(1) : '-'})`, near(m.lcaGap, g, 1) && m.formBottom !== null && m.teamTop - m.formBottom >= g - 1);
  }
  c.check(`${t} place is Fraunces ${K.placeWeight} ${K.placePx}px (${m.place ? `${m.place.fam} ${m.place.w} ${m.place.px}` : 'not found'}); phone is Fraunces ${K.phoneWeight} ${K.phonePx}px underlined (${m.phone ? `${m.phone.fam} ${m.phone.w} ${m.phone.px} ${m.phone.deco}` : 'not found'})`,
    Boolean(m.place && m.phone) && m.place.fam.includes('fraunces') && m.place.w === K.placeWeight && near(m.place.px, K.placePx, 0.5) && m.phone.fam.includes('fraunces') && m.phone.w === K.phoneWeight && near(m.phone.px, K.phonePx, 0.5) && /underline/.test(m.phone.deco));
  c.check(`${t} "${ctx.person} - ${ctx.role}" is on its own line below the phone at ${K.personPx}px (${m.person ? `${m.person.px}px, top ${Math.round(m.person.top)} vs phone bottom ${m.phone ? Math.round(m.phone.bottom) : '-'}` : 'not found'})`, Boolean(m.person && m.phone) && near(m.person.px, K.personPx, 0.25) && m.person.top >= m.phone.bottom - 1);
  c.check(`${t} gateway rows: min-height ${K.gatewayMinRow}, Fraunces ${K.gatewayWeight} ${K.gatewayPx}px, a plain ${K.arrowPx}px arrow in its own element with no ring (${m.gl.map((g) => `h${Math.round(g.h)} ${g.fam} ${g.w} ${g.px} arrow ${g.arrowPx}${g.ring ? ' RING' : ''}`).join(' | ')})`,
    m.gl.length > 0 && m.gl.every((g) => g.h >= K.gatewayMinRow - 0.5 && g.fam.includes('fraunces') && g.w === K.gatewayWeight && near(g.px, K.gatewayPx, 0.5) && g.arrow && near(g.arrowPx, K.arrowPx, 0.5) && !g.ring));
}


const FS2 = RULINGS.fs2;

/** FS-2 item 1, S-CARD (systemic). Per element on every route: a white, radiused-or-shadowed surface in main must be one of the route's expected cards or sit inside an allowed kind; the expected `.ds-card`s must be white, radius 10, with the DS-1 shadow. Hole: nothing measured card surfaces at all, so the gateway asides were carded and the golden-carded surfaces left bare while the gate stayed green. */
export async function fsCardSurface(page, route, vp, c, tag) {
  const S = FS2.sCard; const t = `${tag} FS-2.1`;
  const expected = S.expected[route.nos] ?? null;
  const allowed = [...S.allowedKinds, ...(S.routeAllowed[route.nos] ?? [])];
  const m = await page.evaluate(({ S, expected, allowed }) => {
    const px = (v) => parseFloat(v) || 0; const main = document.querySelector('main'); if (!main) return null;
    const isWhite = (cs) => { const q = cs.backgroundColor.match(/rgba?\(([^)]+)\)/); if (!q) return false; const p = q[1].split(',').map(Number); const a = p[3] === undefined ? 1 : p[3]; return a >= 0.9 && p[0] >= 250 && p[1] >= 250 && p[2] >= 250; };
    const skip = 'button, input, select, textarea, a, summary, label, option, svg, img, nav, footer, section[data-nos-hero]';
    const all = [...main.querySelectorAll('*')].filter((e) => !e.closest(skip)).filter((e) => { const cs = getComputedStyle(e); const b = e.getBoundingClientRect();
      return isWhite(cs) && (cs.boxShadow !== 'none' || px(cs.borderTopLeftRadius) >= 8) && b.width >= S.minW && b.height >= S.minH; });
    const surfaces = all.filter((e) => !all.some((o) => o !== e && o.contains(e)));
    const sel = (e) => e.tagName.toLowerCase() + (e.className ? '.' + e.className.toString().trim().split(/\s+/).slice(0, 2).join('.') : '') + [...e.attributes].filter((a) => a.name.startsWith('data-')).map((a) => `[${a.name}]`).slice(0, 2).join('');
    const known = (e) => (expected ?? []).some((x) => e.matches(x) || e.closest(x)) ;
    const ok = (e) => allowed.some((x) => e.matches(x) || e.closest(x));
    const stray = surfaces.filter((e) => !known(e) && !ok(e)).map(sel);
    const ds = [...main.querySelectorAll('.ds-card')].map((e) => ({ sel: sel(e), r: px(getComputedStyle(e).borderTopLeftRadius), sh: getComputedStyle(e).boxShadow, white: isWhite(getComputedStyle(e)) }));
    const exp = (expected ?? []).map((x) => { const e = main.querySelector(x); if (!e) return { x, found: false }; const card = e.closest('.ds-card') ?? (e.matches('.ds-card') ? e : e.querySelector('.ds-card')); const cs = getComputedStyle(card ?? e); return { x, found: true, ds: Boolean(card), white: isWhite(cs), r: px(cs.borderTopLeftRadius), sh: cs.boxShadow }; });
    return { n: surfaces.length, stray, ds, exp };
  }, { S, expected, allowed });
  if (!m) return;
  c.check(`${t} no stray card surface in main (${m.stray.join(', ') || `${m.n} surface(s), all expected or allowed`})`, m.stray.length === 0);
  if (expected) {
    c.check(`${t} ${route.nos}: exactly ${expected.length} .ds-card (${m.ds.length}) and ${expected.length === 0 ? 'no card on the gateway aside' : `the card is ${expected.join(', ')}`}`, m.ds.length === expected.length);
    for (const e of m.exp) c.check(`${t} ${e.x} is a white .ds-card, radius ${S.radius}, with the DS-1 shadow (${e.found ? `ds-card ${e.ds}; white ${e.white}; r ${e.r}; shadow ${e.sh.slice(0, 40)}` : 'not found'})`, e.found && e.ds && e.white && e.r === S.radius && e.sh !== 'none');
  }
}

/** FS-2 item 2. /what-to-expect: the rest column (Food, Photography, Accessibility) first, then Section 3 under a gold-300 rule. Hole: WE-G1 asserted each block's content and the stand-above-rest order, never rest-above-Section-3, so Section 3 rendering first passed. */
async function fsWe(page, route, vp, c, tag) {
  const W = FS2.whatToExpect; const t = `${tag} FS-2.2`;
  const m = await page.evaluate(() => {
    const px = (v) => parseFloat(v) || 0; const rest = document.querySelector('[data-we-rest]'); const s3 = document.querySelector('[data-we-s3]'); const main = document.querySelector('[data-doc-main]') ?? document.querySelector('main');
    if (!rest || !s3) return { hooks: false };
    let el = s3; let rule = null; while (el && el !== main.parentElement) { const cs = getComputedStyle(el); if (px(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none') { rule = { w: px(cs.borderTopWidth), color: cs.borderTopColor, y: el.getBoundingClientRect().top + scrollY }; break; } if (el === main) break; el = el.parentElement; }
    return { hooks: true, dom: Boolean(rest.compareDocumentPosition(s3) & Node.DOCUMENT_POSITION_FOLLOWING), restBottom: rest.getBoundingClientRect().bottom + scrollY, s3Top: s3.getBoundingClientRect().top + scrollY, rule };
  });
  c.check(`${t} [data-we-rest] and [data-we-s3] exist`, m.hooks);
  if (!m.hooks) return;
  c.check(`${t} DOM order: the practical blocks (rest) come before Section 3`, m.dom);
  c.check(`${t} visual order: Section 3 starts below the last practical block (rest bottom ${Math.round(m.restBottom)}, Section 3 top ${Math.round(m.s3Top)})`, m.s3Top >= m.restBottom - 1);
  c.check(`${t} Section 3 sits under a gold-300 rule (${m.rule ? `${m.rule.w}px ${m.rule.color}` : 'no top rule on Section 3 or an ancestor'}; want ${W.goldRule})`, Boolean(m.rule) && m.rule.w >= W.ruleMinPx && m.rule.color === W.goldRule && m.rule.y <= m.s3Top + 1);
}

/** FS-2 item 3. /tickets at 1440 and 2056: the hero fan shows every card once it settles. Hole: only the Rev 41-era image checks looked at /tickets, and a capture mid fan-out passed. We wait for finite animations and transitions to end, then require two samples 400ms apart to match. */
export async function fsTicketsFan(browser, server, c) {
  const T = FS2.tickets;
  for (const width of T.widths) {
    const vp = { name: `${width}@2`, width, height: 900, dsf: 2 }; const tag = `[${vp.name} ${T.route} FS-2.3]`;
    const context = await newContext(browser, vp); const page = await context.newPage();
    if (await gotoRoute(page, server, T.route, c, tag)) {
      const sample = () => page.evaluate(() => {
        const fan = document.querySelector('section[data-nos-hero] .nk-fan, .nk-fan'); if (!fan) return null;
        return [...fan.querySelectorAll('.nk-wrap')].map((w) => { let o = 1; let v = true; for (let e = w; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); o *= Number(cs.opacity); if (cs.visibility === 'hidden' || cs.display === 'none') v = false; }
          const b = w.getBoundingClientRect(); return { o, v, l: b.left, t: b.top, w: b.width, h: b.height, inView: b.right > 0 && b.left < innerWidth }; });
      });
      await page.evaluate(async () => { const fin = () => Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => null))); await fin(); await fin(); });
      await page.waitForTimeout(T.settleMs);
      const a = await sample(); await page.waitForTimeout(T.settleMs); const b = await sample();
      c.check(`${tag} the hero fan exists with ${T.fanCards} cards (${a ? a.length : 'no .nk-fan'})`, Boolean(a) && a.length === T.fanCards);
      if (a && b && a.length === b.length) {
        c.check(`${tag} the fan has settled: two samples ${T.settleMs}ms apart match within ${T.stableTolPx}px`, a.every((x, i) => Math.abs(x.l - b[i].l) <= T.stableTolPx && Math.abs(x.t - b[i].t) <= T.stableTolPx && Math.abs(x.o - b[i].o) <= 0.01));
        c.check(`${tag} after it settles every card is shown: opacity 1, visible, in view, ${T.fanCards} distinct positions (${b.map((x) => `${x.o.toFixed(2)}@${Math.round(x.l)}`).join(' ')})`, b.every((x) => x.o >= 0.99 && x.v && x.inView && x.w > 0 && x.h > 0) && b.every((x, i) => b.every((y, j) => j <= i || Math.abs(x.l - y.l) >= T.minSpreadPx)));
      } else c.check(`${tag} the fan had the same cards in both samples`, false);
    }
    await context.close();
  }
}

/** FS-2 item 4. /conferences: row body text is text-align start at every width (CR-G1), never centred. Hole: CR-G1 checked copy, the ticket-card box and layout order; alignment was never read, so centred h2s, standfirst and link at 390 passed. */
async function fsConferences(page, route, vp, c, tag) {
  const K = FS2.conferences; const t = `${tag} FS-2.4`;
  const m = await page.evaluate(() => [...document.querySelectorAll('[data-conference-row]')].map((row) => [...row.querySelectorAll('h2, h3, p, a, li')].filter((e) => !e.closest('[data-ticket-card]') && e.textContent.trim()).map((e) => ({ t: e.tagName.toLowerCase() + ':' + e.textContent.replace(/\s+/g, ' ').trim().slice(0, 18), a: getComputedStyle(e).textAlign }))));
  c.check(`${t} ${m.length} conference rows; every body element is text-align start/left (${m.flat().filter((x) => !K.textAlign.includes(x.a)).map((x) => `${x.t}=${x.a}`).join(', ') || 'all start'})`, m.length > 0 && m.flat().every((x) => K.textAlign.includes(x.a)));
}

/** Per-route handlers for the generic route loop. FS-2 adds its routes here. */
export const ROUTE_HANDLERS = {
  '/international-guests': fsIg,
  '/symposium': fsSymposium,
  '/exhibitors': fsExhibitors,
  '/what-to-expect': fsWe,
  '/conferences': fsConferences
};

export async function fsRoute(page, route, vp, c, tag) {
  await fsCardSurface(page, route, vp, c, tag);
  const h = ROUTE_HANDLERS[route.nos];
  if (h) await h(page, route, vp, c, tag);
}
