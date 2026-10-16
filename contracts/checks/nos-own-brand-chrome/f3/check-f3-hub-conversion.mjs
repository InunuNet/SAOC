// F3 hub conversion and craft (NOS Design C-1..C-10) on /national-show, measured. Every label and href comes from nav-config / page data.
//  ("Plan your visit" is compared case-insensitively: nav-config carries it as "Plan Your Visit" and the label is taken from there.)
//  C-1  hero CTAs in order: PRIMARY gold "Tickets" (nav-config label) -> /national-show/tickets; SECONDARY ghost "Plan your visit" -> its nav-config href;
//       no "Find your society" in the hero. Price anchor "{ticket title} from R{min}" under the CTAs ONLY when sales are open AND a price exists; omitted
//       when sales are closed (launch posture). The label is NEVER hard-coded: it is "{title} from R{min}" with {title} the cheapest ticket type's own
//       title from data (Sanity calls the product "Day Visitor"); asserted as a heading on /national-show/tickets, and {min} equals the cheapest price there. Sales state is measured from /national-show/tickets ("Sales closed"); NOS_SALES_CLOSED=1 demands closed.
//  C-2  order CTAs -> (price) -> countdown -> facts, at 1280 and 390.
//  C-3  only "Planning a visit" remains; no "Explore the National Show" / "More on the National Show".
//  C-4  "Ten judging groups": 5 columns (5x2) at >=1024, 2 columns (2x5) at 390, no orphan row.
//  C-5  past-edition cards typographic (no images) and carry an entries chip (layout in check-f3-edition-cards.mjs); with no published show the section is omitted.
//  C-6  scoped to eyebrow elements directly above an h2, not any text containing the words.
//  C-6  none of the section eyebrows (ABOUT THE SHOW ...) render.
//  C-7  h2 order: stats lead, Planning a visit, [Three-year cycle], Ten judging groups, exhibitor band, [Past editions], closing band. The bracketed two are
//       optional (F6 removed the cycle content; the archive is honestly empty): present = in slot, absent = not rendered. NOS_EXPECT_PAST_SHOWS=1 requires Past editions.
//  C-8  closing band = ticket close: its h2 from page data (or the awaiting-copy marker, never an invented line), primary "Tickets", secondary "Plan your visit";
//       "Start planning your entry now." sits in the exhibitor band with the CTA row "Find your society" + "Exhibitor information".
//  C-10 stacked hero image at <=1023 is capped at 4:3.
//  Fold: at 1280x800 the h1 and both hero CTAs sit above the fold.
import { HUB_ROUTE, main, openPage, withBrowser, VP_DESKTOP, VP_PHONE, rgbOf, rgbNear, GOLD_RGB, ROYAL_RGB, BASE, norm } from './_f3lib.mjs';

const EYEBROWS = ['ABOUT THE SHOW', 'COMING TO THE SHOW', 'FIND YOUR WAY', 'THE ROTATION', 'COMPETITION STRUCTURE', 'ENTERING THE SHOW', 'SHOW HISTORY'];
const H2_ORDER = [/^three years in the making/i, /^planning a visit$/i, /^three-year cycle$/i, /^ten judging groups$/i, /^exhibitor information$/i, /^past editions$/i];
const REMOVED_H2 = [/explore the national show/i, /more on the national show/i];
const TICKETS = { label: 'Tickets', href: '/national-show/tickets' };
const PLAN = { label: 'Plan your visit', href: '/national-show/plan-your-visit' };
const EXH_CLOSE = 'Start planning your entry now.';

function measure() {
  const n = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
  const top = (e) => e.getBoundingClientRect().top + scrollY;
  const hero = document.querySelector('[data-nos-hero]');
  const btnInfo = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { text: n(e.textContent), href: e.getAttribute('href'), bg: s.backgroundColor, colour: s.color, border: s.borderTopColor, bw: parseFloat(s.borderTopWidth), top: r.top + scrollY, bottom: r.bottom + scrollY }; };
  const out = { eyebrowText: [] };
  const h1 = document.querySelector('h1');
  out.h1Bottom = h1 ? h1.getBoundingClientRect().bottom + scrollY : null;
  out.ctas = hero ? [...hero.querySelectorAll('a')].filter((a) => a.matches('[data-nos-hero-button], [data-nos-button]')).map(btnInfo) : [];
  out.heroLinks = hero ? [...hero.querySelectorAll('a')].map((a) => n(a.textContent)) : [];
  const price = hero ? [...hero.querySelectorAll('*')].find((e) => !e.children.length && /\sfrom R\s?\d/i.test(n(e.textContent))) : null;
  out.price = price ? { text: n(price.textContent), top: top(price) } : null;
  const cd = hero?.querySelector('[data-nos-hero-text="countdown-opens-in"]');
  out.countdownTop = cd ? top(cd) : null;
  const facts = hero?.querySelector('[data-nos-hero-text="meta-dt-0"]');
  out.factsTop = facts ? top(facts) : null;
  // C-6 is about a section EYEBROW: a short label element directly above an h2 (its previous sibling, or its wrapper's previous sibling when the h2 opens
  // the wrapper) whose whole text is one of the listed labels. Body and destination-list copy that merely contains "about the show" is not an eyebrow.
  const EYEBROWS = ['ABOUT THE SHOW', 'COMING TO THE SHOW', 'FIND YOUR WAY', 'THE ROTATION', 'COMPETITION STRUCTURE', 'ENTERING THE SHOW', 'SHOW HISTORY'];
  const eyebrowAbove = (h) => [h.previousElementSibling, h.parentElement?.firstElementChild === h ? h.parentElement.previousElementSibling : null].filter(Boolean);
  out.eyebrowText = [...new Set([...document.querySelectorAll('main h2')].flatMap((h) => eyebrowAbove(h).map((e) => n(e.textContent).toUpperCase()).filter((t) => EYEBROWS.includes(t))))];
  out.h2 = [...document.querySelectorAll('main h2')].map((h) => n(h.textContent));
  const secOf = (h) => h.closest('section') ?? h.parentElement?.parentElement;
  const h2s = [...document.querySelectorAll('main h2')];
  const find = (re) => h2s.find((h) => re.test(n(h.textContent)));
  const jg = find(/^ten judging groups$/i);
  if (jg) { const sec = secOf(jg); const grid = [...sec.querySelectorAll('ul, ol, div')].find((g) => getComputedStyle(g).display === 'grid' && g.children.length === 10); const kids = grid ? [...grid.children] : []; const rects = kids.map((k) => k.getBoundingClientRect()); out.judging = { found: !!grid, items: kids.length, cols: new Set(rects.map((r) => Math.round(r.left))).size, rows: new Set(rects.map((r) => Math.round(r.top / 4))).size }; }
  const ex = find(/^exhibitor information$/i);
  if (ex) { const sec = secOf(ex); out.exh = { close: n(sec.innerText).includes('Start planning your entry now.'), links: [...sec.querySelectorAll('a')].map((a) => ({ text: n(a.textContent), href: a.getAttribute('href') })) }; }
  const last = h2s[h2s.length - 1];
  if (last) { const sec = secOf(last); out.closing = { h2: n(last.textContent), marker: !!sec.querySelector('[data-confirmation-badge], [data-exhibitor-marker]'), links: [...sec.querySelectorAll('a')].map((a) => ({ text: n(a.textContent), href: a.getAttribute('href'), ...btnInfo(a) })), sectionIsExh: ex ? secOf(ex) === sec : false }; }
  const pe = find(/^past editions$/i);
  if (pe) { const sec = secOf(pe); const cards = [...sec.querySelectorAll('[data-nos-edition-card]')]; out.past = { cards: cards.length, images: sec.querySelectorAll('img, picture, svg image, canvas').length, chips: cards.filter((c) => /entries/i.test(c.textContent ?? '')).length }; }
  const media = document.querySelector('[data-nos-hero-media]');
  if (media) { const r = media.getBoundingClientRect(); out.media = { w: r.width, h: r.height }; }
  return out;
}

await main('F3 hub conversion', async (r) => {
  // The price source is the RENDERED price block on /national-show/tickets ("From" / R{price} / h3 {title}), the element the hub teaser reads through the
  // same cheapestAdmission(), never the raw HTML (which also contains unrelated "R..." amounts such as the venue's R44) and never every price on the page.
  const src = await withBrowser(async (browser) => {
    const { ctx, page, status } = await openPage(browser, VP_DESKTOP, '/national-show/tickets');
    const out = { status, closed: false, block: null, titles: [] };
    if (status === 200) {
      await page.waitForTimeout(300);
      Object.assign(out, await page.evaluate(() => {
        const n = (t) => (t ?? '').replace(/\s+/g, ' ').trim();
        const main = document.querySelector('main');
        const from = [...main.querySelectorAll('span')].find((e) => /^from$/i.test(n(e.textContent)));
        const price = from?.nextElementSibling;
        const name = price?.nextElementSibling;
        const priceText = price ? n(price.textContent) : null;
        return {
          closed: /sales (are )?closed|not yet open/i.test(main.innerText),
          block: priceText && /^R\s?\d/.test(priceText) && name ? { price: priceText, name: n(name.textContent) } : null,
          titles: [...main.querySelectorAll('a[href^="/tickets/"]')].map((a) => n(a.textContent)).filter(Boolean),
        };
      }));
    }
    await ctx.close();
    return out;
  });
  if (src.status !== 200) r.fail(`/national-show/tickets: HTTP ${src.status}`);
  // The price block renders only while salesOpen is true AND a product is priceable, so its presence proves sales are open; unrelated copy that merely
  // contains the words "not yet open" must not flip the state. NOS_SALES_CLOSED=1 demands the closed case and fails a page that still shows the block.
  const closed = process.env.NOS_SALES_CLOSED === '1' || (!src.block && src.closed);
  if (process.env.NOS_SALES_CLOSED === '1' && src.block) r.fail(`NOS_SALES_CLOSED=1 but /national-show/tickets still renders the price block "${src.block.name} ${src.block.price}"`);
  const expectAnchor = !closed && !!src.block;
  r.note(`sales ${closed ? 'CLOSED' : 'open'}; ticket page price block: ${src.block ? `${src.block.name} ${src.block.price}` : 'none'}`);
  await withBrowser(async (browser) => {
    for (const [name, vp] of [['1280', VP_DESKTOP], ['1024', { width: 1024, height: 800 }], ['1023', { width: 1023, height: 800 }], ['768', { width: 768, height: 1024 }], ['390', VP_PHONE]]) {
      const { ctx, page, status } = await openPage(browser, vp, HUB_ROUTE);
      const tag = `hub @${name}`;
      if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
      await page.waitForTimeout(300);
      const m = await page.evaluate(measure);
      const wide = vp.width >= 1024;
      if (name === '1280' || name === '390') {
        const [c1, c2] = m.ctas;
        if (m.ctas.length !== 2) r.fail(`${tag}: C-1: ${m.ctas.length} hero CTAs, want exactly 2 (${m.heroLinks.join(' | ')})`);
        if (c1 && (c1.text !== TICKETS.label || c1.href !== TICKETS.href)) r.fail(`${tag}: C-1: primary CTA is "${c1.text}" -> ${c1.href}, want "${TICKETS.label}" -> ${TICKETS.href}`);
        if (c1 && !rgbNear(rgbOf(c1.bg), GOLD_RGB, 1.5)) r.fail(`${tag}: C-1: primary CTA is ${c1.bg}, want gold rgb(243, 242, 214)`);
        if (c1 && !rgbNear(rgbOf(c1.colour), ROYAL_RGB, 1.5)) r.fail(`${tag}: C-1: primary CTA label is ${c1.colour}, want royal`);
        if (c2 && (c2.text.toLowerCase() !== PLAN.label.toLowerCase() || c2.href !== PLAN.href)) r.fail(`${tag}: C-1: secondary CTA is "${c2.text}" -> ${c2.href}, want "${PLAN.label}" -> ${PLAN.href}`);
        if (c2 && !(c2.bw >= 0.9 && /rgba\(0, 0, 0, 0\)|rgba\(\d+, \d+, \d+, 0/.test(c2.bg))) r.fail(`${tag}: C-1: secondary CTA is not a ghost (bg ${c2.bg}, border ${c2.bw}px)`);
        if (m.heroLinks.some((t) => /find your society/i.test(t))) r.fail(`${tag}: C-1: "Find your society" is still in the hero`);
        if (!expectAnchor && m.price) r.fail(`${tag}: C-1: price anchor "${m.price.text}" renders while ${closed ? 'sales are closed' : 'no ticket page price block exists'}`);
        if (expectAnchor) {
          if (!m.price) r.fail(`${tag}: C-1: sales open with a priced cheapest ticket (${src.block.name} ${src.block.price}) but no "{ticket title} from R{min}" anchor under the CTAs`);
          else {
            const pm = /^(.+?) from (R\s?\d[\d\s,]*)$/i.exec(m.price.text);
            if (!pm) r.fail(`${tag}: C-1: price anchor "${m.price.text}" is not "{ticket title} from R{min}"`);
            else {
              if (!src.titles.some((t) => t.toLowerCase() === pm[1].toLowerCase())) r.fail(`${tag}: C-1: price anchor title "${pm[1]}" is not a ticket type title on /national-show/tickets (${src.titles.slice(0, 8).join(' | ')}); no hand-typed label such as "Day Pass"`);
              const amount = (t) => Number(t.replace(/[^\d]/g, ''));
              if (pm[1].toLowerCase() !== src.block.name.toLowerCase() || amount(pm[2]) !== amount(src.block.price)) r.fail(`${tag}: C-1: price anchor "${m.price.text}" differs from the tickets page's cheapest block "${src.block.name} from ${src.block.price}"`);
            }
            if (c2 && m.price.top < c2.bottom - 1) r.fail(`${tag}: C-1: price anchor sits above the CTAs`);
          }
        }
        const seq = [['CTAs', c2?.bottom ?? c1?.bottom], ['price', m.price?.top], ['countdown', m.countdownTop], ['facts', m.factsTop]].filter(([, v]) => v != null);
        for (let i = 1; i < seq.length; i++) if (seq[i][1] < seq[i - 1][1] - 1) r.fail(`${tag}: C-2: ${seq[i][0]} (${seq[i][1].toFixed(0)}) is above ${seq[i - 1][0]} (${seq[i - 1][1].toFixed(0)}); order is CTAs, price, countdown, facts`);
        if (m.countdownTop == null) r.fail(`${tag}: C-2: no countdown in the hero`);
        if (m.factsTop == null) r.fail(`${tag}: C-2: no facts row in the hero`);
        for (const re of REMOVED_H2) if (m.h2.some((t) => re.test(t))) r.fail(`${tag}: C-3: h2 matching ${re} still renders`);
        for (const e of m.eyebrowText) r.fail(`${tag}: C-6: section eyebrow "${e}" still renders`);
        // F6 removed the Three-year cycle content and the archive is honestly empty, so those two sections are OPTIONAL: when present they hold their slot,
        // when absent they are simply not rendered (never an empty placeholder). NOS_EXPECT_PAST_SHOWS=1 makes Past editions required.
        const required = [H2_ORDER[0], H2_ORDER[1], H2_ORDER[3], H2_ORDER[4]];
        const optional = [H2_ORDER[2], H2_ORDER[5]];
        required.forEach((re) => { if (!m.h2.some((t) => re.test(t))) r.fail(`${tag}: C-7: h2 ${re} is missing (h2s: ${m.h2.join(' | ')})`); });
        if (process.env.NOS_EXPECT_PAST_SHOWS === '1' && !m.h2.some((t) => H2_ORDER[5].test(t))) r.fail(`${tag}: C-7: NOS_EXPECT_PAST_SHOWS=1 but no "Past editions" h2`);
        const present = H2_ORDER.filter((re) => m.h2.some((t) => re.test(t)));
        const idx = present.map((re) => m.h2.findIndex((t) => re.test(t)));
        if (idx.some((x, i) => i && x < idx[i - 1])) r.fail(`${tag}: C-7: h2 order is ${m.h2.join(' | ')}; want stats, Planning a visit, [Three-year cycle], Ten judging groups, exhibitor band, [Past editions], closing band`);
        const wantCount = required.length + optional.filter((re) => m.h2.some((t) => re.test(t))).length + 1;
        if (m.h2.length !== wantCount) r.fail(`${tag}: C-7: ${m.h2.length} h2s, want ${wantCount} (${m.h2.join(' | ')})`);
        const cl = m.closing;
        if (!cl || cl.sectionIsExh) r.fail(`${tag}: C-8: no separate closing band after Past editions`);
        else {
          if (cl.h2 === EXH_CLOSE) r.fail(`${tag}: C-8: the closing band still carries "${EXH_CLOSE}" (it moves into the exhibitor band)`);
          if (!cl.h2 && !cl.marker) r.fail(`${tag}: C-8: closing band has no h2 and no awaiting-copy marker`);
          const t = cl.links.find((l) => l.text === TICKETS.label), p = cl.links.find((l) => l.text.toLowerCase() === PLAN.label.toLowerCase());
          if (!t || t.href !== TICKETS.href) r.fail(`${tag}: C-8: closing band lacks primary "Tickets" -> ${TICKETS.href}`);
          else if (!rgbNear(rgbOf(t.bg), GOLD_RGB, 1.5) && !rgbNear(rgbOf(t.colour), GOLD_RGB, 1.5)) r.fail(`${tag}: C-8: closing "Tickets" is not the primary (${t.bg} / ${t.colour})`);
          if (!p || p.href !== PLAN.href) r.fail(`${tag}: C-8: closing band lacks secondary "Plan your visit" -> ${PLAN.href}`);
          if (t && p && t.top > p.top + 2 && Math.abs(t.top - p.top) < 40) r.fail(`${tag}: C-8: closing CTAs are in the wrong order (primary first)`);
        }
        if (!m.exh) r.fail(`${tag}: C-8: no exhibitor band`);
        else {
          if (!m.exh.close) r.fail(`${tag}: C-8: "${EXH_CLOSE}" is not in the exhibitor band`);
          const f = m.exh.links.findIndex((l) => l.text === 'Find your society'), e = m.exh.links.findIndex((l) => l.text === 'Exhibitor information');
          if (f < 0 || m.exh.links[f].href !== '/societies') r.fail(`${tag}: C-8: exhibitor band lacks "Find your society" -> /societies`);
          if (e < 0) r.fail(`${tag}: C-8: exhibitor band lacks the "Exhibitor information" CTA`);
          if (f >= 0 && e >= 0 && f > e) r.fail(`${tag}: C-8: exhibitor CTA row order is "Exhibitor information" then "Find your society"; want the reverse`);
        }
        if (m.past) {
          if (!m.past.cards) r.fail(`${tag}: C-5: an empty "Past editions" section renders; with no published past show the section is omitted (honest empty state)`);
          else { if (m.past.images) r.fail(`${tag}: C-5: ${m.past.images} image(s) in the past-editions section (typographic only)`); if (m.past.chips < m.past.cards) r.fail(`${tag}: C-5: ${m.past.chips}/${m.past.cards} past-edition cards carry an entries chip`); }
        }
      }
      if (m.judging) {
        if (!m.judging.found) r.fail(`${tag}: C-4: no 10-item grid under "Ten judging groups"`);
        else if (wide && (m.judging.cols !== 5 || m.judging.rows !== 2)) r.fail(`${tag}: C-4: judging grid is ${m.judging.cols} columns x ${m.judging.rows} rows, want 5x2`);
        else if (name === '390' && (m.judging.cols !== 2 || m.judging.rows !== 5)) r.fail(`${tag}: C-4: judging grid is ${m.judging.cols} columns x ${m.judging.rows} rows, want 2x5`);
      }
      if (vp.width <= 1023) {
        if (!m.media) r.fail(`${tag}: C-10: no [data-nos-hero-media] to measure`);
        else if (m.media.h > m.media.w * 0.75 + 1) r.fail(`${tag}: C-10: stacked hero image is ${m.media.w.toFixed(0)}x${m.media.h.toFixed(0)}px, want capped at 4:3 (height <= ${(m.media.w * 0.75).toFixed(0)}px)`);
      }
      if (name === '1280') {
        const lowest = Math.max(m.h1Bottom ?? 0, ...m.ctas.map((c) => c.bottom));
        if (lowest > 800) r.fail(`${tag}: fold: h1 and CTAs end at ${lowest.toFixed(0)}px, want above the 800px fold`);
      }
      await ctx.close();
    }
  });
});
