#!/usr/bin/env node
// F18-A3 (R76, R77 #5, R78 #3, R76 public mode): the holding state and the public-mode placeholder rule, against a PUBLIC build (SITE_PUBLIC_LAUNCH=true).
// goldens/f18/holding-audit.json is the route audit.
//  holding routes (programme, international-guests, wosa-conference; archive and faq when they have nothing): exactly one [data-nos-holding] section (it also carries the existing
//     data-nos-content-state marker), built only from existing parts:
//       - the hub's facts (Dates, Host, Venue, Cycle; values identical to the hub hero facts)
//       - related-page cards = the OTHER leaves of the route's own nav-config group, each the nav-config label as a link and the nav-config descriptor, nothing else
//       - the existing "Be the first to know" band (eyebrow "Stay informed", action "Ask the council" to /contact)
//       - the page's own absence sentence where it has one (international-guests), the WOSA link-out where it has one
//     no [data-nos-content-gap], no orphan rule (no element that has only a border and nothing in it), no horizontal overflow at 1280 and 390, the explore index last
//  routes that supply a body never hold (mustNotHold)
//  public rule: none of the banned placeholder strings renders on the eight publicNoPlaceholderRoutes (no TBC note, no gap sentence, no "Placeholder copy", no schema preview)
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-c-holding.mjs
import { main, openPage, withBrowser, readGolden, T, flat } from './_lib.mjs';
import { NAV } from '../../../../components/chrome/nav-config.ts';
import { groupFor } from '../../nos-own-brand-chrome/f3/_f3lib.mjs';

const H = T.holding;
const AUDIT = readGolden('holding-audit.json');

const descriptors = new Map();
(function walk(n) {
  if (!n || typeof n !== 'object') return;
  if (typeof n.href === 'string' && typeof n.descriptor === 'string' && !descriptors.has(n.href)) descriptors.set(n.href, n.descriptor);
  for (const v of Object.values(n)) walk(v);
})(NAV);

function measure({ S }) {
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const t = (e) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const cs = (e) => getComputedStyle(e);
  const main = q('main');
  const root = qa(S.root);
  const out = {
    holding: root.length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    mainText: t(main),
    editionCards: qa('[data-nos-edition-card]').length,
    details: qa('main details').length,
    gaps: qa('[data-nos-content-gap]').length,
    h1: t(q('h1')),
  };
  if (!root.length) return out;
  const r = root[0];
  out.state = r.getAttribute('data-nos-content-state');
  const facts = r.querySelector(S.facts);
  out.facts = facts ? { labels: [...facts.querySelectorAll('dt')].map(t), values: [...facts.querySelectorAll('dd')].map(t) } : null;
  const cards = r.querySelector(S.cards);
  out.cards = cards ? [...cards.querySelectorAll(S.card)].map((c) => ({ label: t(c.querySelector('a')), href: c.querySelector('a')?.getAttribute('href'), text: t(c), links: c.querySelectorAll('a').length })) : null;
  const cta = q(S.cta) ?? [...document.querySelectorAll('main section.nos-section-royal')].find((s) => r.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING);
  out.cta = cta ? { text: t(cta), links: [...cta.querySelectorAll('a')].map((a) => ({ text: t(a), href: a.getAttribute('href') })) } : null;
  out.rootText = t(r);
  out.hrefs = [...r.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  const orphans = [];
  for (const e of [r, ...r.querySelectorAll('*')]) {
    const s = cs(e);
    const ruled = parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderBottomWidth) > 0;
    if (ruled && !t(e) && !e.querySelector('img, svg, input, button, a')) orphans.push(e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]);
  }
  out.orphans = orphans;
  const idx = q('nav[aria-label="Explore the show pages"]');
  const kids = [...main.children];
  out.indexLast = !!idx && kids.length > 0 && (kids[kids.length - 1] === idx || kids[kids.length - 1].contains(idx));
  return out;
}

await main('F18-A3 holding state and public placeholder rule', async (r) => {
  await withBrowser(async (browser) => {
    const hubPage = await openPage(browser, { width: 1280, height: 800 }, '/national-show');
    const hub = await hubPage.page.evaluate(() => ({ values: [...document.querySelectorAll('.nos-hero-facts dd')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()) }));
    await hubPage.ctx.close();

    const routes = [...AUDIT.holdingDefinite, ...AUDIT.holdingConditional.map((c) => c.route), ...AUDIT.mustNotHold, ...AUDIT.publicNoPlaceholderRoutes].filter((v, i, a) => a.indexOf(v) === i);
    for (const route of routes) {
      for (const [name, [w, h]] of [['1280', T.viewports.desktop], ['390', T.viewports.phone]]) {
        const { ctx, page, status } = await openPage(browser, { width: w, height: h }, route);
        const tag = `${route} @${name}`;
        if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
        const m = await page.evaluate(measure, { S: H.selectors });
        if (m.overflow > 1) r.fail(`${tag}: horizontal overflow ${m.overflow}px`);
        if (m.gaps) r.fail(`${tag}: ${m.gaps} [data-nos-content-gap] block(s) in a public build`);
        if (AUDIT.publicNoPlaceholderRoutes.includes(route)) for (const s of H.bannedPublic) if (flat(m.mainText).includes(s)) r.fail(`${tag}: public build renders the placeholder string "${s}"`);
        const definite = AUDIT.holdingDefinite.includes(route);
        const cond = AUDIT.holdingConditional.find((c) => c.route === route);
        let expectHold = definite;
        if (cond) expectHold = route.endsWith('/archive') ? m.editionCards === 0 : m.details === 0;
        if (AUDIT.mustNotHold.includes(route) && m.holding) r.fail(`${tag}: renders a holding state but supplies a body (mustNotHold)`);
        if (!expectHold) { await ctx.close(); continue; }
        if (m.holding !== 1) { r.fail(`${tag}: ${m.holding} ${H.selectors.root} sections, want exactly 1`); await ctx.close(); continue; }
        if (!['published', 'fallback-unpublished'].includes(m.state ?? '')) r.fail(`${tag}: the holding section lost data-nos-content-state (${m.state})`);
        if (!m.facts) r.fail(`${tag}: no facts list in the holding state`);
        else {
          if (JSON.stringify(m.facts.labels) !== JSON.stringify(T.longform.factLabels)) r.fail(`${tag}: fact labels ${JSON.stringify(m.facts.labels)}`);
          if (JSON.stringify(m.facts.values) !== JSON.stringify(hub.values)) r.fail(`${tag}: fact values differ from the hub hero facts`);
        }
        const group = groupFor(route);
        const want = group ? group.group.links.filter((l) => l.href !== route) : [];
        if (!m.cards) r.fail(`${tag}: no related-page cards`);
        else {
          if (JSON.stringify(m.cards.map((c) => c.href)) !== JSON.stringify(want.map((l) => l.href))) r.fail(`${tag}: cards ${JSON.stringify(m.cards.map((c) => c.href))}, want the other leaves of "${group?.group.heading}": ${JSON.stringify(want.map((l) => l.href))}`);
          for (const c of m.cards) {
            const leaf = want.find((l) => l.href === c.href);
            if (!leaf) continue;
            if (c.label !== leaf.label) r.fail(`${tag}: card "${c.label}" is not the nav-config label "${leaf.label}"`);
            const d = descriptors.get(c.href);
            if (!d || flat(c.text) !== flat(`${leaf.label} ${d}`) && !flat(c.text).includes(flat(d))) r.fail(`${tag}: card ${c.href} does not carry its nav-config descriptor "${d}"`);
            if (c.links !== 1) r.fail(`${tag}: card ${c.href} has ${c.links} links, want exactly 1`);
          }
        }
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
