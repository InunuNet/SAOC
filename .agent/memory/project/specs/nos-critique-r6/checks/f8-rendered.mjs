// nos-critique-r6 f8 -- rendered check for R50 on /national-show/what-to-expect (production build, next start 3010-3019), 390 and 1280.
//   ORDER   the visit logistics render directly under the hero: the first content h2 is a logistics heading and every logistics
//           block precedes the LongFormPage promo prose ([data-nos-longform]); order Show dates, Opening hours, Admission,
//           Food and refreshments, Photography, Cloakroom and plant holding, Accessibility (those present)
//   H2      every logistics heading is an h2 (none an h3), siblings in one container, one computed font-size and family
//   DATES   the Show dates line is exactly goldens/f8-weekday-range.txt; the ShowFacts aside no longer repeats a Dates fact
//           (Host, Venue, Cycle stay); /faq still carries the string (warning only if its data moved)
//   STATUS  Codi Q3: per h2 block at most ONE status marker (only unconfirmed blocks render one), no nested card, the unconfirmed phrase once, no
//           badge in the heading, no marker outside a block; the Drive opening sentence renders once (no hero-lede duplicate)
//   PUBLIC  Codi (final): every unconfirmed logistics row is hidden and ONE R11 line at the top reads "<label>: <hidden headings lower case \u00b7 joined>" (exactly the
//           rows that carry a marker in preview), then the "Be the first to know" link; the unsourced hero lede is withheld; no marker per row
//   MODE    run in BOTH modes (preview = SHOW_PLACEHOLDER_PREVIEW=true + wall, public = unset); public withholds the unsourced
//           concession and photography text (goldens/f8-unsourced.json), preview keeps it
//   PROSE   the seven narrative paragraphs equal goldens/f8-narrative.txt (Drive "3.1 Info - What to Expect")
//   OTHERS  the other LongFormPage routes (about, vendors, sa-exhibitors) keep head/aside/body order and the four ShowFacts;
//           plan-your-visit keeps its h3 VisitorInfoBlock headings
//   C4      no horizontal overflow, one h1
// Run as: node f8-rendered.mjs   (NOS_CR6_ROOT selects the worktree; NOS_CR6_ORIGIN drives a running origin for a dry run)
import { finish, scopeFiles } from './_lib.mjs';
import { AUTH, require } from './_server.mjs';
import { DISCLOSURE_PROBE, disclosureFailures, golden, norm, openMode, probeAt } from './f6-f8-lib.mjs';

const NAME = 'f8-rendered.mjs';
const failures = [];
const ROUTE = '/national-show/what-to-expect';
const ORDER = ['Show dates', 'Opening hours', 'Admission', 'Food and refreshments', 'Photography', 'Cloakroom and plant holding', 'Accessibility'];
const WEEKDAY = golden('f8-weekday-range.txt').trim();
const NARRATIVE = golden('f8-narrative.txt').split('\n').map(norm).filter(Boolean);
const { chromium } = require('playwright');

const files = scopeFiles();
const UNSOURCED = JSON.parse(golden('f8-unsourced.json'));
const PROMISE = NARRATIVE[0].split(' celebrating')[0];

const collect = ([order, promise]) => {
  const q = (s, r = document) => [...r.querySelectorAll(s)];
  const text = (e) => e.textContent.trim().replace(/\s+/g, ' ');
  const main = document.querySelector('main') ?? document.body;
  const pos = (e) => e.getBoundingClientRect().top + scrollY;
  const allH = q('h1, h2, h3', main).map((h) => ({ tag: h.tagName, text: text(h), top: pos(h), el: h }));
  const logistics = allH.filter((h) => order.includes(h.text) && !h.el.closest('[data-nos-longform]'));
  const longform = main.querySelector('[data-nos-longform]');
  const contentH2 = allH.filter((h) => h.tag === 'H2' && !h.el.closest('nav'));
  const lastLogisticsBottom = logistics.length ? Math.max(...logistics.map((h) => (h.el.closest('section') ?? h.el).getBoundingClientRect().bottom + scrollY)) : 0;
  const parents = new Set(logistics.map((h) => (h.el.closest('section.nos-surface') ?? h.el).parentElement));
  const size = (h) => { const cs = getComputedStyle(h.el); return `${cs.fontSize}|${cs.fontFamily}`; };
  const dateBlock = logistics.find((h) => h.text === 'Show dates');
  const dateLine = dateBlock ? dateBlock.el.closest('section')?.querySelector('p')?.textContent.trim().replace(/\s+/g, ' ') ?? null : null;
  const facts = longform ? q('[data-nos-facts] dt', longform).map(text) : [];
  const badges = q('[data-confirmation-badge]');
  const blocksEls = logistics.map((h) => ({ name: h.text, el: h.el.closest('section.nos-surface') })).filter((b) => b.el);
  const phrase = /to be confirmed|not yet confirmed|not confirmed/gi;
  const blocks = blocksEls.map(({ name, el }) => ({
    name, badges: q('[data-confirmation-badge]', el).length, nested: q('.nos-surface', el).length,
    phrases: (el.textContent.match(phrase) ?? []).length, headingBadge: !!el.querySelector('h2 [data-confirmation-badge], h3 [data-confirmation-badge]'),
    paras: q('p', el).filter((p) => !p.hasAttribute('data-confirmation-badge')).length,
  }));
  const strayBadges = badges.filter((b) => !blocksEls.some(({ el }) => el.contains(b))).length;
  const heroLedeEl = document.querySelector('[data-nos-hero-lede]');
  const promiseCount = (((r) => { const c = r.cloneNode(true); c.querySelectorAll('script, template, style, noscript').forEach((n) => n.remove()); return c.textContent; })(main).replace(/\s+/g, ' ').split(promise).length - 1); // not main.textContent: inline RSC <script> payloads repeat the string
  return {
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    h1: allH.filter((h) => h.tag === 'H1').length,
    logistics: logistics.map((h) => ({ tag: h.tag, text: h.text, top: h.top, size: size(h) })),
    h3Named: allH.filter((h) => h.tag === 'H3' && order.includes(h.text)).map((h) => h.text),
    firstContentH2: contentH2[0]?.text ?? null,
    longformTop: longform ? pos(longform) : null,
    lastLogisticsBottom,
    parentCount: parents.size,
    dateLine, facts,
    markers: badges.map((b) => ({ text: text(b).replace(/^\u203b\s*/, ''), top: pos(b) })),
    beFirst: (() => { const a = q('a[href="/contact"]', main).find((x) => text(x) === 'Be the first to know'); return a ? { top: pos(a) } : null; })(),
    blocks, strayBadges, promiseCount, heroLede: heroLedeEl ? text(heroLedeEl) : null,
    narrative: longform ? [text(longform.querySelector('[data-nos-longform-lede]')), ...q('[data-nos-longform-body] > p', longform).map(text)] : [],
    longformKids: longform ? [...longform.children].map((c) => Object.keys(c.dataset).find((k) => k.startsWith('nosLongform')) ?? '?') : [],
  };
};

const record = { unconfirmed: [], label: null };
let browser;
async function suite(origin, mode) {
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const ctx = await browser.newContext({ viewport: vp, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    const tag = `[${mode}] ${ROUTE} @${vp.width}`;
    const res = await page.goto(`${origin}${ROUTE}`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); await ctx.close(); continue; }
    const m = await page.evaluate(collect, [ORDER, PROMISE]);
    if (m.sw > m.cw) failures.push(`${tag}: horizontal overflow ${m.sw} > ${m.cw}`);
    if (m.h1 !== 1) failures.push(`${tag}: ${m.h1} h1, want 1`);
    if (m.logistics.length === 0) { failures.push(`${tag}: no logistics headings found; is NEXT_PUBLIC_SANITY_PROJECT_ID set for the build?`); await ctx.close(); continue; }

    // ORDER + H2
    const names = m.logistics.map((h) => h.text);
    const expected = ORDER.filter((n) => names.includes(n));
    if (names.join('|') !== expected.join('|')) failures.push(`${tag}: logistics order ${names.join(' > ')}, want ${expected.join(' > ')}`);
    if (m.firstContentH2 !== m.logistics[0].text) failures.push(`${tag}: first content h2 is "${m.firstContentH2}", want the first logistics heading "${m.logistics[0].text}" (logistics straight under the hero)`);
    if (m.longformTop === null) failures.push(`${tag}: LongFormPage ([data-nos-longform]) missing; the promo prose must stay`);
    else if (m.lastLogisticsBottom > m.longformTop) failures.push(`${tag}: logistics end at ${m.lastLogisticsBottom.toFixed(0)}px, after the promo prose starts at ${m.longformTop.toFixed(0)}px; logistics come first`);
    for (const h of m.logistics) if (h.tag !== 'H2') failures.push(`${tag}: "${h.text}" is an ${h.tag}, want h2`);
    if (m.h3Named.length > 0) failures.push(`${tag}: h3 headings remain for ${m.h3Named.join(', ')}`);
    if (m.parentCount !== 1) failures.push(`${tag}: logistics blocks sit in ${m.parentCount} containers, want siblings in one`);
    if (new Set(m.logistics.map((h) => h.size)).size > 1) failures.push(`${tag}: sibling h2s compute different type (${[...new Set(m.logistics.map((h) => h.size))].join(' / ')})`);

    // DATES
    if (names.includes('Show dates')) {
      if (m.dateLine !== WEEKDAY) failures.push(`${tag}: Show dates reads "${m.dateLine}", want "${WEEKDAY}"`);
      if (m.facts.includes('Dates')) failures.push(`${tag}: the ShowFacts aside still repeats a Dates fact beside the Show dates block`);
      for (const f of ['Host', 'Venue', 'Cycle']) if (!m.facts.includes(f)) failures.push(`${tag}: ShowFacts aside lost its ${f} fact`);
    }

    // STATUS + MODE rulings
    if (mode === 'preview') {
      // Codi Q3 (beta/preview): ONE R11 line per h2 block, only on an unconfirmed block, no nested card, no stacked phrase
      for (const b of m.blocks) {
        if (b.badges > 1) failures.push(`${tag}: "${b.name}" has ${b.badges} status markers, want at most one line`);
        if (b.nested > 0) failures.push(`${tag}: "${b.name}" nests ${b.nested} card(s) (.nos-surface) inside the block; one line, no card`);
        if (b.phrases > 1) failures.push(`${tag}: "${b.name}" says it is unconfirmed ${b.phrases} times (marker + prose/card/heading badge); once`);
        if (b.headingBadge) failures.push(`${tag}: "${b.name}" carries a status badge inside its heading`);
      }
      if (m.strayBadges > 0) failures.push(`${tag}: ${m.strayBadges} status marker(s) outside any logistics block in preview`);
      record.unconfirmed = m.blocks.filter((b) => b.name !== 'Show dates' && b.badges > 0).map((b) => b.name);
      record.label = m.markers[0] ? m.markers[0].text : null;
      if (m.heroLede && NARRATIVE[0] && (norm(m.heroLede) === NARRATIVE[0] || NARRATIVE[0].includes(norm(m.heroLede)) || norm(m.heroLede).includes(NARRATIVE[0]))) failures.push(`${tag}: the hero lede repeats the first Drive paragraph`);
    } else {
      // Codi public ruling: every unconfirmed logistics row hidden, ONE R11 line at the top of the block naming exactly those rows, then the
      // existing "Be the first to know" link. The unsourced hero lede is withheld too.
      const hidden = record.unconfirmed;
      for (const n of hidden) if (names.includes(n)) failures.push(`${tag}: unconfirmed row "${n}" still renders in public`);
      for (const b of m.blocks) if (b.badges > 0) failures.push(`${tag}: "${b.name}" still carries a status marker in public; the one line sits at the top of the block`);
      if (m.heroLede !== null) failures.push(`${tag}: the unsourced hero lede (Sanity expectIntro) renders in public; withhold it`);
      if (hidden.length === 0) {
        if (m.markers.length > 0) failures.push(`${tag}: a status line renders but no row was unconfirmed in preview`);
      } else if (m.markers.length !== 1) failures.push(`${tag}: ${m.markers.length} status line(s) in public, want exactly one`);
      else {
        // Codi FINAL: the v4 R11 disclosure. Chip = the existing pending label alone (one line); list = the hidden rows' own headings, the
        // first as written, the rest lower case, joined by " · ", ending "."; the link is inside the same gold surface.
        const wantList = `${hidden.map((n, i) => (i === 0 ? n : n.toLowerCase())).join(' · ')}.`;
        if (!record.label) failures.push(`${tag}: no preview label recorded`);
        else {
          const ds = await page.evaluate(DISCLOSURE_PROBE);
          if (ds.length !== 1) failures.push(`${tag}: ${ds.length} [data-status-disclosure] surface(s), want exactly 1`);
          else failures.push(...disclosureFailures(tag, ds[0], vp.width, { text: record.label, list: wantList, link: true }));
        }
        if (m.logistics.length > 0 && m.markers[0].top > m.logistics[0].top) failures.push(`${tag}: the status line is not above the remaining logistics headings`);
        if (!m.beFirst) failures.push(`${tag}: the existing "Be the first to know" link (href /contact) is missing after the line`);
        else if (m.beFirst.top < m.markers[0].top || (m.logistics.length > 0 && m.beFirst.top > m.logistics[0].top)) failures.push(`${tag}: "Be the first to know" must sit directly after the status line, above the remaining rows`);
      }
    }
    // NARROW phone (Codi): at 320 the chip may wrap to two lines, no more
    if (mode === 'public' && vp.width === 390 && record.unconfirmed.length > 0 && record.label) {
      const n = await probeAt(browser, `${origin}${ROUTE}`, AUTH, 320);
      if (n.status !== 200) failures.push(`[public] ${ROUTE} @320: HTTP ${n.status}`);
      else if (n.ds.length !== 1) failures.push(`[public] ${ROUTE} @320: ${n.ds.length} disclosure surface(s), want 1`);
      else failures.push(...disclosureFailures(`[public] ${ROUTE} @320`, n.ds[0], 320, { text: record.label, link: true }));
    }
    // DUPLICATE intro: the Drive opening sentence renders once
    if (m.promiseCount !== 1) failures.push(`${tag}: the sentence "${PROMISE}" renders ${m.promiseCount}x, want once`);

    // PROSE
    const got = m.narrative.map(norm);
    if (got.length !== NARRATIVE.length) failures.push(`${tag}: ${got.length} narrative paragraphs, want ${NARRATIVE.length}`);
    NARRATIVE.forEach((w, i) => { if (got[i] !== w) failures.push(`${tag}: narrative paragraph ${i + 1} differs from the Drive mirror: "${(got[i] ?? '').slice(0, 60)}"`); });
    await ctx.close();
  }

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, extraHTTPHeaders: { authorization: AUTH } });
  const page = await ctx.newPage();
  // OTHERS: shared template unchanged on its other routes
  for (const r of ['about', 'vendors', 'sa-exhibitors']) {
    const res = await page.goto(`${origin}/national-show/${r}`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) { failures.push(`/national-show/${r}: HTTP ${res && res.status()}`); continue; }
    const m = await page.evaluate(collect, [ORDER, PROMISE]);
    if (m.longformTop === null) { failures.push(`/national-show/${r}: no [data-nos-longform]`); continue; }
    const kids = m.longformKids.filter((k) => ['nosLongformHead', 'nosLongformAside', 'nosLongformBody', 'nosLongformCta'].includes(k));
    if (kids.slice(0, 3).join(',') !== 'nosLongformHead,nosLongformAside,nosLongformBody') failures.push(`/national-show/${r}: longform children order ${kids.join(',')}`);
    if (m.facts.join(',') !== 'Dates,Host,Venue,Cycle') failures.push(`/national-show/${r}: ShowFacts ${m.facts.join(',')}, want Dates,Host,Venue,Cycle`);
  }
  const pv = await page.goto(`${origin}/national-show/plan-your-visit`, { waitUntil: 'networkidle' });
  if (!pv || pv.status() !== 200) failures.push(`/national-show/plan-your-visit: HTTP ${pv && pv.status()}`);
  else {
    const c = await page.evaluate(() => ({ h2: document.querySelectorAll('section.nos-surface > h2.nos-opsz-32').length, h3: document.querySelectorAll('section.nos-surface > h3.nos-opsz-32').length }));
    if (c.h2 > 0) failures.push(`/national-show/plan-your-visit: ${c.h2} VisitorInfoBlock heading(s) became h2; its default stays h3`);
    if (c.h3 < 1) failures.push('/national-show/plan-your-visit: no VisitorInfoBlock h3 headings found');
  }
  // DATES source: the FAQ still carries the string we derive
  const faq = await page.goto(`${origin}/national-show/faq`, { waitUntil: 'networkidle' });
  if (faq && faq.status() === 200 && !(await page.evaluate(() => document.body.innerText)).includes(WEEKDAY)) console.warn(`note: /national-show/faq no longer contains "${WEEKDAY}"; the derived range cannot be compared to its source`);
  await ctx.close();

  // MODE (Athanor review): sources are traced in goldens/f8-spec.md; unsourced concessions and photography rules are withheld in
  // public (behind withholdPlaceholderProse) and stay in the beta preview
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    const res = await page.goto(`${origin}${ROUTE}`, { waitUntil: 'networkidle' });
    const tag = `[${mode}] ${ROUTE} sources`;
    if (!res || res.status() !== 200) failures.push(`${tag}: HTTP ${res && res.status()}`);
    else {
      const k = await page.evaluate((order) => {
        const main = document.querySelector('main') ?? document.body;
        const blk = {};
        for (const h of [...main.querySelectorAll('h2, h3')]) if (order.includes(h.textContent.trim())) { const el = h.closest('section.nos-surface'); if (el) blk[h.textContent.trim()] = { text: el.textContent.replace(/\s+/g, ' ').trim(), paras: [...el.querySelectorAll('p')].filter((p) => !p.hasAttribute('data-confirmation-badge')).length }; }
        return { body: ((r) => { const c = r.cloneNode(true); c.querySelectorAll('script, template, style, noscript').forEach((n) => n.remove()); return c.textContent; })(main).replace(/\s+/g, ' '), blk };
      }, ORDER);
      if (mode === 'public') {
        for (const s of UNSOURCED.withheldInPublic) if (k.body.includes(s)) failures.push(`${tag}: unsourced text still renders in public: "${s}"`);
      } else {
        if (!k.blk.Admission) failures.push(`${tag}: Admission block missing in preview (beta stays as today)`);
        if (!k.blk.Photography) console.warn(`${tag}: note: no Photography block in preview; Sanity has no photographyPolicy`);
        for (const s of UNSOURCED.withheldInPublic) if (!k.body.includes(s)) console.warn(`${tag}: note: preview no longer contains "${s}" (Sanity text edited?)`);
      }
    }
    await ctx.close();
  }
}

try {
  browser = await chromium.launch();
  for (const mode of ['preview', 'public']) {
    const h = await openMode(mode, files);
    if (h.stale) { failures.push(...h.stale); break; }
    try {
      await suite(h.origin, mode);
    } finally {
      h.stop();
    }
  }
} catch (e) {
  failures.push(`render error: ${e.message}`);
} finally {
  if (browser) await browser.close();
}
finish(NAME, failures, 'R50 rendered at 390 and 1280: logistics straight under the hero and before the promo prose, h2 siblings with one type, weekday range, no repeated Dates fact, one status line per unconfirmed block, unsourced text withheld in public only, seven Drive paragraphs verbatim, other LongFormPage routes and plan-your-visit unchanged, no overflow.');
