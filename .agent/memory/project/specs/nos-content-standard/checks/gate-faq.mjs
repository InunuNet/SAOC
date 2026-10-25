// A9: the FAQ variant (F2) at 390@3, 768@2, 1024@2 and 1440@2, plus JavaScript disabled at 1440.
//   one h2 per category (serif 300), the category index in the aside (>= 961) or a one-row scroller (< 961) with one current link,
//   ONE warm card per category holding its <details> rows with hairline dividers, 22px summaries with a 20px icon and the whole row as
//   the button, no legend chip before the first category, every category reachable, a current link that tracks the last heading
//   passed 160px, native <details> kept.
import { readFileSync } from 'node:fs';
import { ROUTES, STD, launchChromium, newContext, normalise, withServer } from './_lib.mjs';

const NAV = 'nav[data-doc-index][aria-label="Sections"]';
// her category headings: bold lines "N. Title" that are not questions (no trailing "?") in the frozen FAQ doc
const faqRoute = ROUTES.find((r) => r.nos === '/faq');
const CATEGORIES = readFileSync(faqRoute.drive.path, 'utf8').split('\n').map((l) => l.match(/^\*\*(\d+\. [^*?]+)\*\*$/)?.[1]).filter(Boolean).map(normalise);

await withServer(3, 'faq', async (server, c) => {
  const browser = await launchChromium();
  try {
    for (const vp of STD.viewports) {
      const tag = `[${vp.name} /faq]`;
      const context = await newContext(browser, vp); const page = await context.newPage();
      await page.goto(`${server.nos}/faq`, { waitUntil: 'load' });
      const s = await page.evaluate((nav) => {
        const r = (e) => { const b = e.getBoundingClientRect(); return { top: b.top + scrollY, bottom: b.bottom + scrollY, left: b.left, right: b.right, w: b.width, h: b.height }; };
        const heads = [...document.querySelectorAll('main section[aria-labelledby^="faq-"] > h2')];
        const links = [...document.querySelectorAll(`${nav} a`)];
        const aside = document.querySelector('[data-doc-aside]');
        const cards = [...document.querySelectorAll('[data-faq-card]')];
        const firstH2Top = heads[0] ? r(heads[0]).top : Infinity;
        const legend = [...document.querySelectorAll('main [data-confirmation-badge], main [data-status-disclosure]')].filter((e) => !e.closest('details') && r(e).top < firstH2Top).length;
        const sum = document.querySelector('[data-faq-summary]'); const li = sum?.closest('li');
        const icon = document.querySelector('[data-faq-icon] svg');
        const idxLinks = links.map((a) => { const b = a.getBoundingClientRect(); const cs = getComputedStyle(a); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height, fam: cs.fontFamily.split(',')[0].replace(/["']/g, '').toLowerCase(), px: parseFloat(cs.fontSize), rad: parseFloat(cs.borderTopLeftRadius) || 0, bg: cs.backgroundColor, bl: parseFloat(cs.borderLeftWidth) }; });
        const firstContent = document.querySelector('[data-doc-main] a, [data-doc-main] summary');
        const navEl = document.querySelector(nav);
        const chips = [...document.querySelectorAll('main a, main button, main summary')].filter((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius) >= 999).length;
        const hdr = document.querySelector('header'); const hdrSticky = hdr && ['sticky', 'fixed'].includes(getComputedStyle(hdr).position);
        return {
          idxLinks, chips, navFirst: Boolean(navEl && firstContent && (navEl.compareDocumentPosition(firstContent) & Node.DOCUMENT_POSITION_FOLLOWING)),
          kind: aside?.getAttribute('data-doc-aside-kind') ?? null, hdrBottom: hdrSticky ? hdr.getBoundingClientRect().bottom : 0,
          heads: heads.map((h) => ({ id: h.id, text: h.textContent.trim().replace(/\s+/g, ' '), fam: getComputedStyle(h).fontFamily.toLowerCase(), w: getComputedStyle(h).fontWeight })),
          links: links.map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim().replace(/\s+/g, ' ') })),
          inAside: Boolean(aside && aside.querySelector(nav)), navCount: document.querySelectorAll(nav).length,
          cardsPerSection: [...document.querySelectorAll('main section[aria-labelledby^="faq-"]')].map((sec) => sec.querySelectorAll('[data-faq-card]').length),
          detailsOutsideCard: [...document.querySelectorAll('main details')].filter((d) => !d.closest('[data-faq-card]')).length,
          cardNested: cards.filter((cd) => cd.querySelector('[data-faq-card]')).length,
          dividers: cards.every((cd) => [...cd.querySelectorAll(':scope li')].slice(1).every((x) => parseFloat(getComputedStyle(x).borderTopWidth) >= 1 || parseFloat(getComputedStyle(x.previousElementSibling).borderBottomWidth) >= 1)),
          legend, summaryPx: sum ? parseFloat(getComputedStyle(sum.querySelector('[data-faq-question]') ?? sum).fontSize) : null,
          summaryH: sum ? r(sum).h : null, rowFill: sum && li ? Math.abs(r(sum).w - r(li).w) <= 2 : null, iconPx: icon ? r(icon).w : null,
          navOx: document.querySelector(`${nav} ul`) ? getComputedStyle(document.querySelector(`${nav} ul`)).overflowX : null,
          navPos: document.querySelector(nav) ? getComputedStyle(document.querySelector(nav).closest('[data-doc-aside]') ?? document.querySelector(nav)).position : null,
          nativeDetails: document.querySelectorAll('main details > summary').length, sw: document.documentElement.scrollWidth, iw: innerWidth,
        };
      }, NAV);
      c.check(`${tag} exactly one ${NAV}`, s.navCount === 1);
      c.check(`${tag} SEED PENDING: ${s.heads.length} categories rendered == ${CATEGORIES.length} in her FAQ doc (the lead runs the Sanity seed; this fails loudly until then, never passes silently)`, s.heads.length === CATEGORIES.length, s.heads.map((h) => h.text).join(' | '));
      c.check(`${tag} category names are her headings verbatim, in order`, JSON.stringify(s.heads.map((h) => normalise(h.text))) === JSON.stringify(CATEGORIES));
      c.check(`${tag} the aside is the index kind and the index comes before the content in DOM and Tab order`, s.kind === 'index' && s.navFirst, `${s.kind} ${s.navFirst}`);
      c.check(`${tag} no element in main computes radius >= 999 (no chips)`, s.chips === 0, String(s.chips));
      c.check(`${tag} the jump-chip row is gone (no [data-faq-chips])`, await page.locator('[data-faq-chips], ul[aria-label="FAQ categories"]').count() === 0);
      if (vp.width >= STD.grid.minWidthForTwoColumns) {
        c.check(`${tag} index rows are Karla 15px, >= 44px, with no pill, fill or side border`, s.idxLinks.every((l) => l.fam.includes('karla') && Math.abs(l.px - 15) <= 0.5 && l.h >= 44 && l.rad < 999 && l.bl <= 1), JSON.stringify(s.idxLinks[0]));
        c.check(`${tag} index rows have disjoint bounding boxes`, s.idxLinks.every((l, i) => i === 0 || l.top >= s.idxLinks[i - 1].bottom - 0.5));
      }
      c.check(`${tag} index links ${s.links.length} == category h2s ${s.heads.length} (>= 2)`, s.heads.length >= 2 && s.links.length === s.heads.length);
      s.heads.forEach((h, i) => {
        c.check(`${tag} h2 "${h.text}" is serif 300`, h.fam.includes('fraunces') && h.w === '300', `${h.fam} ${h.w}`);
        c.check(`${tag} link ${i + 1} text == h2 text and href #${h.id}`, s.links[i]?.text === h.text && s.links[i]?.href === `#${h.id}`, JSON.stringify(s.links[i]));
      });
      c.check(`${tag} exactly one warm card per category`, s.cardsPerSection.every((n) => n === 1), s.cardsPerSection.join(','));
      c.check(`${tag} every question row sits inside a category card, none nested`, s.detailsOutsideCard === 0 && s.cardNested === 0);
      c.check(`${tag} hairline dividers between rows`, s.dividers);
      c.check(`${tag} native details/summary kept (${s.nativeDetails})`, s.nativeDetails > 0);
      c.check(`${tag} summary ${s.summaryPx}px == ${STD.faq.summaryPx}px, icon ${s.iconPx}px == ${STD.faq.iconPx}px, whole row is the summary`, s.summaryPx === STD.faq.summaryPx && s.iconPx === STD.faq.iconPx && s.rowFill === true && s.summaryH >= 44);
      c.check(`${tag} no legend chip before the first category`, s.legend === 0, String(s.legend));
      c.check(`${tag} no horizontal page scroll`, s.sw <= s.iw);
      if (vp.width >= STD.grid.minWidthForTwoColumns) c.check(`${tag} the index is the aside card, sticky`, s.inAside && s.navPos === 'sticky', `${s.inAside} ${s.navPos}`);
      else c.check(`${tag} the index is a one-row scroller (D7; the full mask, snap, header and mid-page checks run in A7)`, s.navOx === 'auto' || s.navOx === 'scroll' || s.navPos === 'sticky', String(s.navOx));

      // reach + current link
      for (const [i, h] of s.heads.entries()) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.locator(`${NAV} a`).nth(i).scrollIntoViewIfNeeded().catch(() => {});
        await page.locator(`${NAV} a`).nth(i).click();
        await page.waitForTimeout(200);
        const a = await page.evaluate((id) => { const el = document.getElementById(id); return { hash: location.hash, top: el.getBoundingClientRect().top, end: scrollY + innerHeight >= document.documentElement.scrollHeight - 2 }; }, h.id);
        c.check(`${tag} reach "${h.text}": hash #${h.id}, lands 0-160px from the top (${Math.round(a.top)})`, a.hash === `#${h.id}` && a.top >= Math.max(-1, s.hdrBottom - 1) && (a.top <= 160 || a.end));
      }
      for (const i of [...new Set([0, Math.floor(s.heads.length / 2), s.heads.length - 3])].filter((k) => k >= 0 && k < s.heads.length)) {
        await page.evaluate((id) => { window.scrollTo(0, document.getElementById(id).getBoundingClientRect().top + scrollY - 120); }, s.heads[i].id);
        await page.waitForTimeout(300);
        const cur = await page.evaluate(({ nav, t }) => { const hs = [...document.querySelectorAll('main section[aria-labelledby^="faq-"] > h2')]; const passed = hs.filter((h) => h.getBoundingClientRect().top <= t); const cur = [...document.querySelectorAll(`${nav} [aria-current]`)]; const u = cur[0] ? getComputedStyle(cur[0]).textDecorationLine : ''; return { want: passed.length ? passed[passed.length - 1].id : null, got: cur.map((a) => a.getAttribute('href')), underline: u }; }, { nav: NAV, t: 160 });
        c.check(`${tag} current link is #${cur.want} and underlined (${JSON.stringify(cur)})`, cur.got.length === 1 && cur.got[0] === `#${cur.want}` && cur.underline.includes('underline'));
      }
      await context.close();
    }
    const nj = await newContext(browser, STD.firstScreen[0], { javaScriptEnabled: false }); const pg = await nj.newPage();
    await pg.goto(`${server.nos}/faq`, { waitUntil: 'load' });
    const q = await pg.evaluate((nav) => ({ links: document.querySelectorAll(`${nav} a`).length, h2: document.querySelectorAll('main section[aria-labelledby^="faq-"] > h2').length, details: document.querySelectorAll('main details').length }), NAV);
    c.check(`[no-js /faq] index (${q.links}), sections (${q.h2}) and rows (${q.details}) are in the served page`, q.links >= 2 && q.links === q.h2 && q.details > 0);
    await nj.close();
  } finally { await browser.close(); }
}, { preview: true });
