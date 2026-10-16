#!/usr/bin/env node
// F18-A3 (R76, R77 #5, R78 #3, R76 public mode): the holding state and the public-mode placeholder rule, against a PUBLIC build (SITE_PUBLIC_LAUNCH=true).
// goldens/f18/holding-audit.json is the route audit.
//  holding routes (programme, international-guests, wosa-conference; archive and faq when they have nothing): exactly one [data-nos-holding] section (it also carries the existing
//     data-nos-content-state marker), built only from existing parts:
//       - the hub's facts (Dates, Host, Venue, Cycle; values identical to the hub hero facts)
//       - NO related-page mini list (the cards under the "Explore the show" eyebrow): the full Explore index below it is the one list (design-cb rotation ruling 4, F18b commit 4)
//       - the existing "Be the first to know" band (eyebrow "Stay informed", action "Ask the council" to /contact)
//       - the page's own absence sentence where it has one (international-guests), the WOSA link-out where it has one
//     no [data-nos-content-gap], no mini list wherever the full Explore index renders (every route in the audit: holding, long-form, archive, international-guests), no orphan rule (no element that has only a border and nothing in it), no horizontal overflow at 1280 and 390, the explore index last
//  archive (public, no past show) is NOT the standard holding state: hero, then ONE card reading "Show history awaiting committee records", then the Explore index. No facts rail,
//     no related-page mini list, no planning band, no [data-nos-holding] section. The beta and with-editions branches are unchanged (design-cb audit, F18a amendment)
//  wosa-conference: the holding state AND A31's "Buy ticket" link to #ticket-wosa (Athanor review item 2)
//  heading order: /about and /workshops never skip a level (h1 to h3), Athanor review item 3
//  unsourced hub facts: public /national-show renders none of audit.hubFacts.unsourced anywhere in the HTML (Athanor review item 1; sourced facts are cited in the audit)
//     PREVIEW half (design-cb P1): on a SHOW_PLACEHOLDER_PREVIEW=true build (PREVIEW_URL, falling back to BASE_URL) each fact group is PRESENT on /national-show inside a [data-placeholder] or R11 'To be confirmed' marker;
//     the public build is NOS_BASE (a gate that holds PUBLIC_URL passes NOS_BASE=$PUBLIC_URL). F18_REQUIRE_PREVIEW=1 makes a missing preview URL a failure instead of a note.
//  routes that supply a body never hold (mustNotHold)
//  public rule: none of the banned placeholder strings renders on the eight publicNoPlaceholderRoutes (no TBC note, no gap sentence, no "Placeholder copy", no schema preview)
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-c-holding.mjs
import { main, openPage, withBrowser, readGolden, T, flat, httpAuth } from './_lib.mjs';

const H = T.holding;
const AUDIT = readGolden('holding-audit.json');

function measure({ S }) {
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const t = (e) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const cs = (e) => getComputedStyle(e);
  const main = q('main');
  // every NOS route wraps its page in ONE div (DIV.nos-theme, national-show/layout.tsx): count blocks inside that wrapper, not main's single child
  let contentRoot = main;
  while (contentRoot.children.length === 1 && contentRoot.firstElementChild.tagName === 'DIV') contentRoot = contentRoot.firstElementChild;
  const root = qa(S.root);
  const out = {
    holding: root.length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    mainText: t(main),
    editionCards: qa('[data-nos-edition-card]').length,
    details: qa('main details').length,
    gaps: qa('[data-nos-content-gap]').length,
    h1: t(q('h1')),
    fullIndex: !!q('nav[aria-label="Explore the show pages"]'),
    miniLists: qa(S.cards).length + qa('main h2, main h3, main p, main span').filter((e) => t(e).toLowerCase() === 'explore the show' && !e.closest('nav[aria-label="Explore the show pages"]')).length,
    levels: qa('main h1, main h2, main h3, main h4, main h5, main h6').map((h) => Number(h.tagName[1])),
    buyLinks: qa('main a').filter((x) => t(x) === 'Buy ticket').map((x) => x.getAttribute('href') ?? ''),
    kids: [...contentRoot.children].map((k) => ({
      hero: !!(k.matches('[data-nos-hero]') || k.querySelector('[data-nos-hero]')),
      awaiting: t(k).includes('Show history awaiting committee records'),
      index: !!k.querySelector('nav[aria-label="Explore the show pages"]') || k.matches('nav[aria-label="Explore the show pages"]'),
      royal: k.matches('.nos-section-royal') || !!k.querySelector('.nos-section-royal'),
      facts: !!k.querySelector('[data-nos-facts]'),
      miniList: !!k.querySelector('[data-nos-holding-cards]'),
    })),
  };
  if (!root.length) return out;
  const r = root[0];
  out.state = r.getAttribute('data-nos-content-state');
  const facts = r.querySelector(S.facts);
  out.facts = facts ? { labels: [...facts.querySelectorAll('dt')].map(t), values: [...facts.querySelectorAll('dd')].map(t) } : null;
  const cta = q(S.cta) ?? [...document.querySelectorAll('main section.nos-section-royal')].find((s) => r.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING);
  out.cta = cta ? { text: t(cta), links: [...cta.querySelectorAll('a')].map((a) => ({ text: t(a), href: a.getAttribute('href') })) } : null;
  out.rootText = t(r);
  out.holdSentences = [...r.querySelectorAll('p')].filter((e) => !e.closest(S.cta) && !e.closest(S.facts) && t(e).split(' ').length >= 4).length;
  out.hrefs = [...r.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  const orphans = [];
  for (const e of [r, ...r.querySelectorAll('*')]) {
    const s = cs(e);
    const ruled = parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderBottomWidth) > 0;
    if (ruled && !t(e) && !e.querySelector('img, svg, input, button, a')) orphans.push(e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]);
  }
  out.orphans = orphans;
  const idx = q('nav[aria-label="Explore the show pages"]');
  const kids = [...contentRoot.children];
  out.indexLast = !!idx && kids.length > 0 && (kids[kids.length - 1] === idx || kids[kids.length - 1].contains(idx));
  return out;
}

// the archive shape judgement, pure so a probe can prove a wrong shape still fails
function judgeArchiveShape(k, string) {
  const out = [];
  const heroAt = k.findIndex((x) => x.hero);
  const cardAt = k.findIndex((x) => x.awaiting && !x.hero && !x.index);
  const idxAt = k.findIndex((x) => x.index);
  if (heroAt !== 0) out.push('the hero is not the first block in main');
  if (cardAt < 0) out.push(`no card reading "${string}"`);
  if (k.filter((x) => x.awaiting).length !== 1) out.push(`"${string}" appears in ${k.filter((x) => x.awaiting).length} blocks, want exactly 1`);
  if (idxAt !== k.length - 1 || idxAt < 0) out.push('the Explore index is not the last block');
  if (!(heroAt < cardAt && cardAt < idxAt)) out.push('block order is not hero, card, Explore index');
  if (k.length !== 3) out.push(`${k.length} blocks in main, want exactly 3 (hero, card, Explore index)`);
  if (k.some((x) => x.facts)) out.push('a facts rail renders on the archive holding shape');
  if (k.some((x) => x.miniList)) out.push('a related-page mini list renders on the archive holding shape');
  if (k.some((x) => x.royal)) out.push('a planning band renders on the archive holding shape');
  return out;
}
const blk = (o) => ({ hero: false, awaiting: false, index: false, royal: false, facts: false, miniList: false, ...o });
const SHAPE_STRING = 'Show history awaiting committee records';
const good = [blk({ hero: true }), blk({ awaiting: true }), blk({ index: true })];
if (judgeArchiveShape(good, SHAPE_STRING).length) throw new Error('probe: the correct 3-block archive shape is wrongly rejected');
if (!judgeArchiveShape([...good.slice(0, 2), blk({}), good[2]], SHAPE_STRING).length) throw new Error('probe: a 4-block archive page is NOT rejected');
if (!judgeArchiveShape([good[0], good[1], blk({ royal: true }), good[2]], SHAPE_STRING).length) throw new Error('probe: an extra planning band is NOT rejected');
if (!judgeArchiveShape([blk({ hero: true }), blk({ hero: false })], SHAPE_STRING).length) throw new Error('probe: a single-wrapper count of 1 is NOT rejected');

await main('F18-A3 holding state and public placeholder rule', async (r) => {
  await withBrowser(async (browser) => {
    const hubPage = await openPage(browser, { width: 1280, height: 800 }, '/national-show');
    const hub = await hubPage.page.evaluate(() => ({ values: [...document.querySelectorAll('.nos-hero-facts dd')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()) }));
    await hubPage.ctx.close();

    for (const route of AUDIT.hubFacts.routes) {
      const { ctx, page, status } = await openPage(browser, { width: 1280, height: 800 }, route);
      if (status !== 200) r.fail(`${route}: HTTP ${status}`);
      else {
        const html = flat(await page.evaluate(() => document.documentElement.outerHTML));
        for (const s of AUDIT.hubFacts.unsourced) if (html.toLowerCase().includes(flat(s).toLowerCase())) r.fail(`${route}: public build renders the unsourced hub fact "${s}" (withhold via withholdPlaceholderProse)`);
      }
      await ctx.close();
    }

    // preview half: the same facts, now visible and marked (withheld facts must not vanish on the preview build)
    const previewBase = process.env.PREVIEW_URL ?? process.env.BASE_URL;
    if (!previewBase) {
      if (process.env.F18_REQUIRE_PREVIEW === '1') r.fail('F18_REQUIRE_PREVIEW=1 but neither PREVIEW_URL nor BASE_URL names a SHOW_PLACEHOLDER_PREVIEW=true build');
      else r.note('no PREVIEW_URL or BASE_URL: the preview half of the hub-facts rule was not measured');
    } else {
      const pctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: httpAuth() });
      const ppage = await pctx.newPage();
      const resp = await ppage.goto(`${previewBase}/national-show`, { waitUntil: 'networkidle' });
      if (!resp || resp.status() !== 200) r.fail(`preview /national-show: HTTP ${resp?.status()}`);
      else {
        const res = await ppage.evaluate((groups) => {
          const norm = (x) => (x ?? '').replace(/\s+/g, ' ').toLowerCase();
          return groups.map((g) => {
            const hits = [];
            for (const word of g) {
              const w = norm(word);
              for (const e of document.querySelectorAll('main p, main li, main span, main h2, main h3, main div')) {
                if ([...e.children].some((c) => norm(c.textContent).includes(w))) continue;
                if (!norm(e.textContent).includes(w)) continue;
                const block = e.closest('p, li, section, article, div') ?? e;
                const scope = e.closest('section, article') ?? block;
                const marked = !!e.closest('[data-placeholder]') || /to be confirmed|placeholder/i.test(block.textContent ?? '') || !!scope.querySelector('[data-placeholder]');
                hits.push({ word, marked });
              }
            }
            return { group: g.join(' / '), hits };
          });
        }, AUDIT.hubFacts.previewGroups);
        for (const g of res) {
          if (!g.hits.length) r.fail(`preview /national-show: the unsourced hub fact "${g.group}" is withheld on the preview build (it must show, marked)`);
          else if (g.hits.some((x) => !x.marked)) r.fail(`preview /national-show: the unsourced hub fact "${g.group}" renders without a [data-placeholder] or To-be-confirmed marker`);
        }
      }
      await pctx.close();
    }

    const routes = [...AUDIT.holdingDefinite, ...AUDIT.holdingConditional.map((c) => c.route), ...AUDIT.mustNotHold, ...AUDIT.publicNoPlaceholderRoutes, ...AUDIT.headingOrder.routes].filter((v, i, a) => a.indexOf(v) === i);
    for (const route of routes) {
      for (const [name, [w, h]] of [['1280', T.viewports.desktop], ['390', T.viewports.phone]]) {
        const { ctx, page, status } = await openPage(browser, { width: w, height: h }, route);
        const tag = `${route} @${name}`;
        if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
        const m = await page.evaluate(measure, { S: H.selectors });
        if (m.overflow > 1) r.fail(`${tag}: horizontal overflow ${m.overflow}px`);
        if (m.gaps) r.fail(`${tag}: ${m.gaps} [data-nos-content-gap] block(s) in a public build`);
        if (m.fullIndex && m.miniLists) r.fail(`${tag}: the full Explore index renders AND ${m.miniLists} mini "Explore the show" list/cards do (one list only)`);
        if (AUDIT.publicNoPlaceholderRoutes.includes(route)) for (const s of H.bannedPublic) if (flat(m.mainText).includes(s)) r.fail(`${tag}: public build renders the placeholder string "${s}"`);
        const definite = AUDIT.holdingDefinite.includes(route);
        const cond = AUDIT.holdingConditional.find((c) => c.route === route);
        let expectHold = definite;
        if (cond) expectHold = m.details === 0;
        if (AUDIT.headingOrder.routes.includes(route)) {
          for (let i = 1; i < m.levels.length; i++) if (m.levels[i] > m.levels[i - 1] + 1) { r.fail(`${tag}: heading level skips from h${m.levels[i - 1]} to h${m.levels[i]}`); break; }
          if (m.levels[0] !== 1) r.fail(`${tag}: the first heading in main is h${m.levels[0]}, want h1`);
        }
        if (route === AUDIT.wosa.route) {
          const want = AUDIT.wosa.buyLink;
          if (!m.buyLinks.some((h) => h.endsWith(want.hrefSuffix))) r.fail(`${tag}: no "${want.label}" link to ${want.hrefSuffix} (A31 requires it on the WOSA holding state)`);
        }
        if (route === AUDIT.archiveHolding.route && m.editionCards === 0) {
          const AH = AUDIT.archiveHolding;
          if (m.holding) r.fail(`${tag}: archive renders the standard [data-nos-holding] section; the audit shape is hero, one card, Explore index`);
          for (const f of judgeArchiveShape(m.kids, AH.string)) r.fail(`${tag}: ${f}`);
          await ctx.close();
          continue;
        }
        if (AUDIT.mustNotHold.includes(route) && m.holding) r.fail(`${tag}: renders a holding state but supplies a body (mustNotHold)`);
        if (!expectHold) { await ctx.close(); continue; }
        if (m.holding !== 1) { r.fail(`${tag}: ${m.holding} ${H.selectors.root} sections, want exactly 1`); await ctx.close(); continue; }
        if (!['published', 'fallback-unpublished'].includes(m.state ?? '')) r.fail(`${tag}: the holding section lost data-nos-content-state (${m.state})`);
        if (!m.facts) r.fail(`${tag}: no facts list in the holding state`);
        else {
          if (JSON.stringify(m.facts.labels) !== JSON.stringify(T.longform.factLabels)) r.fail(`${tag}: fact labels ${JSON.stringify(m.facts.labels)}`);
          if (JSON.stringify(m.facts.values) !== JSON.stringify(hub.values)) r.fail(`${tag}: fact values differ from the hub hero facts`);
        }
        if (!m.holdSentences) r.fail(`${tag}: the holding state lost its holding sentence`);
        if (!m.cta) r.fail(`${tag}: no "Be the first to know" band after the holding content`);
        else {
          for (const s of [H.strings.ctaEyebrow, H.strings.ctaTitle]) if (!m.cta.text.includes(s)) r.fail(`${tag}: the closing band does not read "${s}"`);
          if (!m.cta.links.some((a) => a.text === H.strings.ctaAction && a.href === H.strings.ctaHref)) r.fail(`${tag}: the closing band has no "${H.strings.ctaAction}" -> ${H.strings.ctaHref} action`);
        }
        const st = AUDIT.statements[route];
        if (st && !flat(m.rootText).includes(flat(st))) r.fail(`${tag}: the page's own absence sentence is missing from the holding state`);
        const keep = AUDIT.keepLinks[route];
        if (keep && !m.hrefs.includes(keep)) r.fail(`${tag}: the existing link-out ${keep} was dropped`);
        if (m.orphans.length) r.fail(`${tag}: orphan rule(s) with nothing in them: ${m.orphans.join(', ')}`);
        if (!m.indexLast) r.fail(`${tag}: the explore index is not the last block in main`);
        await ctx.close();
      }
    }
  });
});
