// nos-critique-r6 f6 -- rendered check for R34 on /national-show/exhibitors (production build, next start 3010-3019), 390 and 1280.
//   CHIPS   >=768: exactly one visible <nav aria-label="On this page"> under the hero, one chip per section heading (the 4 page h2s plus
//           the 9 reference-section h3s = 13 in preview, flat, page order, wrapping to <=3 rows), label = the heading text verbatim, href = its id; chip style = the FAQ R52 chip (14px / 600, 1px royal outline, transparent, ink, >=44px),
//           bone fill on hover and on keyboard focus-visible
//   LAND    every chip lands its h2 clear of the sticky header (measured chrome: header relative below 700, sticky from 700; heading fully visible, not under it, within 96px of it)
//   MOBILE  <768: native <details> collapsed on load, summary "On this page" >=44px with an svg chevron, opens with JS disabled,
//           same chips inside; the desktop nav is not visible
//   BANNER  the R11 banner carries a "Contact the council" button to /contact, above the chips; the end CTA stays (>=2 links)
//   FAQ     /national-show/faq chips unchanged: nav "FAQ categories", classes = goldens/f6-chip-class.txt, same computed style
//   STEPS   R34 #4: the step <ol> numerals compute Fraunces at >=16px
//   C4      no horizontal overflow
// Run as: node f6-rendered.mjs   (NOS_CR6_ROOT selects the worktree; NOS_CR6_ORIGIN drives a running origin for a dry run)
import { finish, scopeFiles } from './_lib.mjs';
import { AUTH, require } from './_server.mjs';
import { DISCLOSURE_PROBE, disclosureFailures, golden, openMode, probeAt } from './f6-f8-lib.mjs';

const NAME = 'f6-rendered.mjs';
const failures = [];
const R52 = golden('f6-chip-class.txt').trim();
const PREVIEW = JSON.parse(golden('f6-preview-counts.json'));
const ROUTE = '/national-show/exhibitors';
// Codi 2026-10-17 (FINAL): in the public disclosure list the steps section's item is the design-ruled label "steps", not its h2 sentence
const STEPS_LIST_LABEL = 'steps';
const STEPS_HEADING_ID = 'exhibitor-steps';
const BANNER_TEXT = 'Exhibitor entries are not yet open';
const BANNER_FULL = 'Exhibitor entries are not yet open — this page covers what to expect when they do. Contact the council to be notified.'; // page.tsx, verbatim

/** In-page: the one gold surface's body, foot line, button and order, resolved against the tokens inside the surface. */
const SURFACE_EXTRA = () => {
  const el = document.querySelector('[data-status-disclosure]');
  if (!el) return { linkHeights: [], body: null, foot: null, button: null, tops: {}, navTop: null, bannerCopies: 0, contactAboveNavOutside: 0, ink700: '', ink500: '' };
  const res = (v) => { const e = document.createElement('span'); e.style.color = v; el.appendChild(e); const r = getComputedStyle(e).color; e.remove(); return r; };
  const css = (n) => { if (!n) return null; const cs = getComputedStyle(n); return { text: n.textContent, fontSize: cs.fontSize, lineHeight: cs.lineHeight, color: cs.color, textTransform: cs.textTransform, borderTopWidth: cs.borderTopWidth, backgroundColor: cs.backgroundColor }; };
  const body = el.querySelector('[data-status-body]');
  const foot = el.querySelector('[data-status-foot]');
  const button = [...el.querySelectorAll('a[href="/contact"]')].find((a) => /Contact the council/.test(a.textContent)) ?? null;
  const top = (n) => (n ? n.getBoundingClientRect().top + scrollY : null);
  const chip = el.querySelector('[data-exhibitor-marker], [data-confirmation-badge]');
  const list = el.querySelector('[data-status-list]');
  const nav = [...document.querySelectorAll('nav[aria-label="On this page"], details')].find((e) => (e.tagName === 'DETAILS' ? e.querySelector('summary')?.textContent.includes('On this page') : true) && e.getClientRects().length > 0);
  const navTop = nav ? nav.getBoundingClientRect().top + scrollY : null;
  const lastEl = el.lastElementChild;
  const clone = document.body.cloneNode(true); clone.querySelectorAll('script, template, style, noscript').forEach((n) => n.remove());
  const copies = clone.textContent.replace(/\s+/g, ' ').split('Exhibitor entries are not yet open').length - 1;
  const outside = [...document.querySelectorAll('a[href="/contact"]')].filter((a) => /Contact the council/.test(a.textContent) && !el.contains(a) && navTop !== null && a.getBoundingClientRect().top + scrollY < navTop).length;
  const linkHeights = [...el.querySelectorAll('a')].map((a) => ({ text: a.textContent.trim().slice(0, 40), h: a.getBoundingClientRect().height }));
  return { linkHeights, body: css(body), foot: css(foot), button: !!button, buttonIsLast: !!button && !!lastEl && (lastEl === button || lastEl.contains(button)) && [...el.querySelectorAll('a, button')].pop() === button, tops: { chip: top(chip), list: top(list), body: top(body), foot: top(foot), button: top(button) }, navTop, bannerCopies: copies, contactAboveNavOutside: outside, ink700: res('var(--ink-700)'), ink500: res('var(--ink-500)') };
};
const { chromium } = require('playwright');

const files = scopeFiles();

const collect = (arg) => {
  const q = (s, r = document) => [...r.querySelectorAll(s)];
  const visible = (el) => !!el && el.getClientRects().length > 0 && el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true });
  const css = (el, props) => { const cs = getComputedStyle(el); return Object.fromEntries(props.map((p) => [p, cs[p]])); };
  const STYLE = ['fontSize', 'fontWeight', 'fontFamily', 'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'backgroundColor', 'color', 'borderTopLeftRadius', 'paddingLeft', 'letterSpacing', 'textTransform'];
  const navs = q('nav[aria-label="On this page"]');
  const visNavs = navs.filter(visible);
  const detailsAll = q('details').filter((d) => d.querySelector('summary')?.textContent.trim() === 'On this page');
  const det = detailsAll[0] ?? null;
  const sum = det?.querySelector('summary') ?? null;
  const h1 = document.querySelector('h1');
  const anyNav = visNavs[0] ?? navs[0] ?? null;
  const wrap = anyNav?.closest('[data-nos-wrap]') ?? document.querySelector('main [data-nos-wrap]');
  const inNav = (el) => !!el.closest('nav[aria-label="On this page"], details');
  const h2s = wrap ? q('h2, section.nos-surface > h3', wrap).filter((h) => !inNav(h)).map((h) => ({ id: h.id, text: h.textContent.trim().replace(/\s+/g, ' ') })) : [];
  const chipNav = visNavs[0] ?? null;
  const chips = chipNav ? q('a', chipNav).map((a) => ({ text: a.textContent.trim().replace(/\s+/g, ' '), href: a.getAttribute('href'), cls: a.className })) : [];
  const first = chipNav?.querySelector('a') ?? null;
  const probe = document.createElement('span');
  probe.className = 'bg-bone';
  (document.querySelector('.nos-theme') ?? document.body).appendChild(probe);
  const bone = getComputedStyle(probe).backgroundColor;
  probe.remove();
  const ink = (() => { const p = document.createElement('span'); p.style.color = 'var(--ink)'; (document.querySelector('.nos-theme') ?? document.body).appendChild(p); const c = getComputedStyle(p).color; p.remove(); return c; })();
  const bannerNode = q('body *').find((e) => e.textContent.includes(arg.bannerText) && ![...e.children].some((c) => c.textContent.includes(arg.bannerText)));
  let banner = null;
  for (let e = bannerNode; e && e !== document.body && !banner; e = e.parentElement) if (q('a[href="/contact"]', e).length > 0 && e.querySelectorAll('h2').length === 0) banner = e;
  const bannerCta = banner ? q('a[href="/contact"]', banner).find((a) => /Contact the council/.test(a.textContent)) : null;
  const contactLinks = q('a[href="/contact"]').filter((a) => /Contact the council/.test(a.textContent));
  const ol = q('main ol').find((o) => [...o.children].every((li) => li.tagName === 'LI' && li.querySelector('h3'))) ?? null;
  // Codi (final): the step timing line (the p straight after each step's h3, from `when`) is 14px / 1.45 in ink-700
  // resolve --ink-700 in the measured element's own context: it is defined on .nos-theme, not on body
  const inkProbe = document.createElement('span'); inkProbe.style.color = 'var(--ink-700)'; (ol ?? document.body).appendChild(inkProbe);
  const ink700 = getComputedStyle(inkProbe).color; inkProbe.remove();
  const timing = ol ? [...ol.children].map((li) => { const h = li.querySelector('h3'); const p = h && h.nextElementSibling && h.nextElementSibling.tagName === 'P' ? h.nextElementSibling : null; return p ? { text: p.textContent.trim(), ink700, ...css(p, ['fontSize', 'lineHeight', 'color']) } : null; }) : [];
  const numerals = ol ? [...ol.children].map((li) => { const s = li.querySelector('[aria-hidden="true"]'); return s ? { text: s.textContent.trim(), ...css(s, ['fontFamily', 'fontSize']) } : null; }) : [];
  return {
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    navCount: navs.length, visNavCount: visNavs.length,
    named: q('[aria-label="On this page"]').filter((e) => e.getClientRects().length > 0).map((e) => e.tagName + (e.getAttribute('role') ? `[role=${e.getAttribute('role')}]` : '')),
    groupsNamed: q('[role="group"][aria-label="On this page"]').length,
    det: det ? { count: detailsAll.length, open: det.open, visible: visible(det), display: getComputedStyle(det).display } : null,
    sum: sum ? { text: sum.textContent.trim().replace(/\s+/g, ' '), h: sum.getBoundingClientRect().height, visible: visible(sum), svg: !!sum.querySelector('svg'), top: sum.getBoundingClientRect().top + scrollY } : null,
    navH: chipNav ? chipNav.getBoundingClientRect().height : 0,
    navTop: chipNav ? chipNav.getBoundingClientRect().top + scrollY : null,
    h1Bottom: h1 ? h1.getBoundingClientRect().bottom + scrollY : null,
    firstH2Top: h2s[0] && document.getElementById(h2s[0].id) ? document.getElementById(h2s[0].id).getBoundingClientRect().top + scrollY : null,
    navLabel: chipNav?.getAttribute('aria-label') ?? null,
    h2s, chips, bone, ink,
    firstChip: first ? { ...css(first, STYLE), h: first.getBoundingClientRect().height } : null,
    banner: banner ? { found: true, ctaFound: !!bannerCta, ctaHref: bannerCta?.getAttribute('href') ?? null, ctaH: bannerCta?.getBoundingClientRect().height ?? 0, ctaTop: bannerCta ? bannerCta.getBoundingClientRect().top + scrollY : null, text: banner.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) } : { found: false },
    contactLinkCount: contactLinks.length,
    steps: { found: !!ol, n: ol ? ol.children.length : 0, numerals, timing },
  };
};

const TRANSITION_MS = 450; // chip colour transitions finish well inside this; computed fills are read after it
const settle = async (page) => {
  let last = -1;
  for (let i = 0; i < 20; i += 1) {
    const y = await page.evaluate(() => Math.round(scrollY));
    if (y === last) return;
    last = y;
    await page.waitForTimeout(150);
  }
};

const landing = () => {
  const id = location.hash.slice(1);
  const el = document.getElementById(id);
  if (!el) return { missing: true };
  // the sticky chrome is measured, not assumed: below 700 the header is position:relative (nothing covers the target),
  // from 700 it is sticky and covers the top hb px of the viewport
  const hdr = document.querySelector('#nh, header, [role="banner"]');
  const pos = hdr ? getComputedStyle(hdr).position : 'static';
  const hb = hdr && (pos === 'sticky' || pos === 'fixed') ? hdr.getBoundingClientRect().bottom : 0;
  const r = el.getBoundingClientRect();
  const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
  return { tag: el.tagName, top: r.top, bottom: r.bottom, hb, pos, atBottom, vh: innerHeight, margin: parseFloat(getComputedStyle(el).scrollMarginTop) };
};


const MARKERS = (arg) => {
  const q = (s) => [...document.querySelectorAll(s)];
  const count = (k) => q(`[data-exhibitor-marker="${k}"]`).length;
  const first = (k) => q(`[data-exhibitor-marker="${k}"]`)[0]?.textContent.replace(/\s+/g, ' ').replace(/^※\s*/, '').trim() ?? null;
  const h1 = document.querySelector('h1');
  const navEl = [...document.querySelectorAll('nav[aria-label="On this page"], details')].find((e) => e.tagName === 'DETAILS' ? e.querySelector('summary')?.textContent.includes('On this page') && e.getClientRects().length > 0 : e.getClientRects().length > 0);
  const tops = (k) => q(`[data-exhibitor-marker="${k}"]`).map((m) => m.getBoundingClientRect().top + scrollY);
  const host = (m) => (m.closest('tr, li, section')?.textContent ?? '').replace(m.textContent, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return {
    question: count('question'), research: count('research'), pending: count('pending'), total: q('[data-exhibitor-marker]').length,
    labels: { question: first('question'), research: first('research'), pending: first('pending') },
    hosts: q('[data-exhibitor-marker="question"]').map(host),
    // the RSC flight payload sits in <script> tags and repeats every label string, so text is read from a clone without script/template/style
    body: ((r) => { const c = r.cloneNode(true); c.querySelectorAll('script, template, style, noscript').forEach((n) => n.remove()); return c.textContent; })(document.body).replace(/\s+/g, ' '),
    h1Bottom: h1 ? h1.getBoundingClientRect().bottom + scrollY : null,
    chipTop: navEl ? navEl.getBoundingClientRect().top + scrollY : null,
    researchTops: tops('research'), pendingTops: tops('pending'),
    // preview: the headings of the sections that carry a pending (TBC) marker; public: how many markers sit outside the one disclosure surface
    pendingHeadings: (() => { const seen = new Set(); return q('[data-exhibitor-marker="pending"]').map((m) => m.closest('section')?.querySelector('h2, h3')).filter(Boolean).map((h) => ({ text: h.textContent.trim(), id: h.id })).filter((h) => (seen.has(h.text) ? false : seen.add(h.text))); })(),
    surfaces: q('[data-status-disclosure]').length,
    markersOutside: q('[data-exhibitor-marker]').filter((m) => !m.closest('[data-status-disclosure]')).length,
  };
};

const record = { labels: null, hosts: [], pendingHeadings: [] };
async function suite(origin, mode) {
  // MODE: marker counts. preview = BASE (3 / 9 / 11); public = 0 question rows, ONE research line, ONE pending line, nothing per row.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    const res = await page.goto(`${origin}${ROUTE}`, { waitUntil: 'networkidle' });
    const tag = `[${mode}] ${ROUTE} markers`;
    if (!res || res.status() !== 200) failures.push(`${tag}: HTTP ${res && res.status()}`);
    else {
      const k = await page.evaluate(MARKERS);
      if (mode === 'preview') {
        for (const key of ['question', 'research', 'pending']) if (k[key] !== PREVIEW[key]) failures.push(`${tag}: ${k[key]} ${key} marker(s), want the BASE count ${PREVIEW[key]} (beta/preview stays exactly as today)`);
        record.labels = k.labels;
        record.hosts = k.hosts;
        record.pendingHeadings = k.pendingHeadings;
      } else {
        if (k.question !== 0) failures.push(`${tag}: ${k.question} open-question marker(s), want 0 (rows hidden entirely)`);
        if (record.labels?.question && k.body.includes(record.labels.question)) failures.push(`${tag}: the open-question label text is still on the page`);
        for (const h of record.hosts.filter((x) => x.length >= 12)) if (k.body.includes(h)) failures.push(`${tag}: hidden open-question row text still renders: "${h}"`);
        // Codi FINAL: banner pill, research pill and pending disclosure are ONE gold R11 surface; the research label is its foot line
        if (k.surfaces !== 1) failures.push(`${tag}: ${k.surfaces} [data-status-disclosure] surface(s) on the page, want exactly 1`);
        if (k.markersOutside > 0) failures.push(`${tag}: ${k.markersOutside} status marker(s) outside the one disclosure surface`);
        if (record.labels?.research && k.body.split(record.labels.research).length - 1 !== 1) failures.push(`${tag}: the research label must render exactly once (it is the foot line)`);
        if (record.labels?.pending && k.pending !== 1) failures.push(`${tag}: ${k.pending} pending chip(s), want exactly 1`);
        if (k.total > 2) failures.push(`${tag}: ${k.total} markers in total, want at most the chip (and the foot if it keeps a marker)`);
        const lines = [...k.researchTops, ...k.pendingTops];
        for (const t of lines) {
          if (t < k.h1Bottom) failures.push(`${tag}: a status line sits above the hero`);
          if (k.chipTop !== null && t > k.chipTop) failures.push(`${tag}: a status line sits below the chips; they belong directly under the hero, above the chip list`);
        }
      }
    }
    await ctx.close();
  }
  const lead = {};
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const ctx = await browser.newContext({ viewport: vp, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    const tag = `[${mode}] ${ROUTE} @${vp.width}`;
    const res = await page.goto(`${origin}${ROUTE}`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); await ctx.close(); continue; }
    const mobile = vp.width < 768;
    let m = await page.evaluate(collect, { bannerText: BANNER_TEXT });
    if (m.sw > m.cw) failures.push(`${tag}: horizontal overflow ${m.sw} > ${m.cw}`);
    if (m.h2s.length === 0) { failures.push(`${tag}: no content heading found; is NEXT_PUBLIC_SANITY_PROJECT_ID set for the build?`); await ctx.close(); continue; }

    // BANNER
    if (!m.banner.found) failures.push(`${tag}: R11 banner ("${BANNER_TEXT}") with a /contact link inside it not found (R34 #3)`);
    else {
      if (!m.banner.ctaFound) failures.push(`${tag}: banner has no "Contact the council" link (R34 #3)`);
      if (m.banner.ctaHref !== '/contact') failures.push(`${tag}: banner CTA href ${m.banner.ctaHref}, want /contact`);
      if (mobile && m.banner.ctaH < 44) failures.push(`${tag}: banner CTA ${m.banner.ctaH}px tall, want >=44`);
    }
    if (m.contactLinkCount < 2) failures.push(`${tag}: ${m.contactLinkCount} "Contact the council" link(s); banner and end CTA both stay (>=2)`);

    if (mobile) {
      if (!m.det) failures.push(`${tag}: no <details> with summary "On this page"`);
      else {
        if (m.det.count !== 1) failures.push(`${tag}: ${m.det.count} "On this page" details, want 1`);
        if (m.det.open) failures.push(`${tag}: details is open on load, want collapsed`);
        if (!m.sum.visible) failures.push(`${tag}: summary not visible`);
        if (m.sum.h < 44) failures.push(`${tag}: summary ${m.sum.h}px tall, want >=44`);
        if (!m.sum.svg) failures.push(`${tag}: summary has no chevron svg`);
        if (m.sum.text !== 'On this page') failures.push(`${tag}: summary text "${m.sum.text}"`);
        if (m.visNavCount !== 0) failures.push(`${tag}: ${m.visNavCount} chip nav visible while the details is collapsed, want 0`);
        if (m.banner.found && m.banner.ctaTop !== null && m.sum.top < m.banner.ctaTop) failures.push(`${tag}: summary above the banner CTA; order is hero, banner, chips`);
        if (m.sum.top < m.h1Bottom) failures.push(`${tag}: summary above the hero`);
        await page.locator('summary', { hasText: 'On this page' }).click();
        m = await page.evaluate(collect, { bannerText: BANNER_TEXT });
        if (!m.det.open) failures.push(`${tag}: summary click did not open the details`);
      }
    } else {
      if (m.det && m.det.display !== 'none') failures.push(`${tag}: the mobile details is displayed at ${vp.width}px, want hidden`);
    }
    // Codex P3: the landmark is announced once - exactly one rendered element named "On this page" (the nav), and no role=group wrapper repeating it
    if (m.named.length !== 1 || m.named[0] !== 'NAV') failures.push(`${tag}: elements named "On this page": [${m.named.join(', ')}], want exactly one NAV`);
    if (m.groupsNamed > 0) failures.push(`${tag}: ${m.groupsNamed} role="group" wrapper(s) also named "On this page"`);
    if (m.visNavCount !== 1) failures.push(`${tag}: ${m.visNavCount} visible nav[aria-label="On this page"] (details ${mobile ? 'open' : 'n/a'}), want exactly 1`);
    else {
      // chips <-> h2s
      const texts = m.chips.map((c) => c.text);
      if (m.chips.length < 2) failures.push(`${tag}: ${m.chips.length} chip(s), want one per section heading (>=2)`);
      if (m.chips.length !== m.h2s.length) failures.push(`${tag}: ${m.chips.length} chips for ${m.h2s.length} section headings (the page h2s plus the reference-section h3s)`);
      if (mode === 'preview' && m.chips.length !== PREVIEW.chips) failures.push(`${tag}: ${m.chips.length} chips in preview, want ${PREVIEW.chips} (4 h2 + 9 reference h3, flat, page order)`);
      if (!mobile && m.navH > 3 * 52 + 8) failures.push(`${tag}: the chip list is ${m.navH}px tall, want at most 3 wrapped rows`);
      if (m.h2s.map((h) => h.text).join('|') !== m.chips.map((c) => c.text).join('|')) failures.push(`${tag}: chips are not in page order`);
      for (const h of m.h2s) if (!texts.includes(h.text)) failures.push(`${tag}: h2 "${h.text}" has no chip with that label verbatim`);
      for (const c of m.chips) {
        const h = m.h2s.find((x) => x.text === c.text);
        if (!h) failures.push(`${tag}: chip "${c.text}" matches no h2 text`);
        else if (!h.id || c.href !== `#${h.id}`) failures.push(`${tag}: chip "${c.text}" href ${c.href}, want #${h.id || '<h2 id>'}`);
        if (c.cls !== R52) failures.push(`${tag}: chip "${c.text}" class differs from the FAQ R52 chip`);
      }
      if (m.navLabel !== 'On this page') failures.push(`${tag}: nav aria-label "${m.navLabel}"`);
      if (!mobile) {
        if (m.navTop < m.h1Bottom) failures.push(`${tag}: chip nav above the hero`);
        if (m.firstH2Top !== null && m.navTop > m.firstH2Top) failures.push(`${tag}: chip nav below the first section`);
        if (m.banner.found && m.banner.ctaTop !== null && m.navTop < m.banner.ctaTop) failures.push(`${tag}: chips above the banner CTA; order is hero, banner, chips`);
      }
      const s = m.firstChip;
      if (s.fontSize !== '14px') failures.push(`${tag}: chip font-size ${s.fontSize}, want 14px`);
      if (s.fontWeight !== '600') failures.push(`${tag}: chip weight ${s.fontWeight}, want 600`);
      if (s.borderTopWidth !== '1px' || s.borderTopStyle !== 'solid') failures.push(`${tag}: chip border ${s.borderTopWidth} ${s.borderTopStyle}, want 1px solid`);
      if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') failures.push(`${tag}: chip fill ${s.backgroundColor}, want transparent`);
      if (s.color !== m.ink) failures.push(`${tag}: chip text ${s.color}, want ink ${m.ink}`);
      if (s.h < 44) failures.push(`${tag}: chip ${s.h}px tall, want >=44`);
      lead[vp.width] = s;

      // LAND
      const LAND_MAX = 96; // at most one sticky-header height of air between the covered band and the heading
      for (const c of m.chips) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await settle(page);
        await page.locator(`nav[aria-label="On this page"] a[href="${c.href}"]`).filter({ visible: true }).first().click();
        await settle(page);
        const L = await page.evaluate(landing);
        if (L.missing) { failures.push(`${tag}: chip "${c.text}" target ${c.href} not found`); continue; }
        if (L.tag !== 'H2' && L.tag !== 'H3') failures.push(`${tag}: chip "${c.text}" targets <${L.tag}>, want the section heading (h2 or reference h3)`);
        if (L.top < L.hb - 1) failures.push(`${tag}: "${c.text}" lands ${L.top.toFixed(0)}px, under the ${L.pos} header (covers to ${L.hb.toFixed(0)}px)`);
        else if (!L.atBottom && L.top - L.hb > LAND_MAX) failures.push(`${tag}: "${c.text}" lands ${(L.top - L.hb).toFixed(0)}px below the header band, want <=${LAND_MAX}`);
        if (L.bottom > L.vh) failures.push(`${tag}: "${c.text}" is not fully visible (bottom ${L.bottom.toFixed(0)}px of ${L.vh}px)`);
      }
    }

    // DISCLOSURE (Codi FINAL, public): the page-level pending line is the v4 R11 disclosure - gold surface, one-line chip, sentence-case list
    if (mode === 'public' && record.labels?.pending) {
      const ds = (await page.evaluate(DISCLOSURE_PROBE)).filter((d) => d.chip && d.chip.marker === 'pending');
      if (ds.length !== 1) failures.push(`${tag}: ${ds.length} pending disclosure surface(s), want exactly 1`);
      else {
        failures.push(...disclosureFailures(`${tag} pending line`, ds[0], vp.width, { text: record.labels.pending, link: false }));
        // list = the headings of the sections that carried TBC content in preview, de-duplicated; first as written, the rest lower case
        const items = (ds[0].list?.text ?? '').replace(/\.$/, '').split(' · ').map((x) => x.trim()).filter(Boolean);
        // every item is a pending section's heading, except the steps section which maps to the ruled label
        const want = record.pendingHeadings.map((h) => (h.id === STEPS_HEADING_ID ? STEPS_LIST_LABEL : h.text));
        if (items.length === 0) failures.push(`${tag}: the list is empty`);
        if (new Set(items.map((x) => x.toLowerCase())).size !== items.length) failures.push(`${tag}: the list repeats a section heading: ${items.join(' · ')}`);
        const norm1 = (x) => x.toLowerCase().replace(/\s+/g, ' ');
        if (want.length > 0) {
          const missing = want.filter((h) => !items.map(norm1).includes(norm1(h)));
          const extra = items.filter((it) => !want.map(norm1).includes(norm1(it)));
          if (missing.length || extra.length) failures.push(`${tag}: list items differ from the sections that carry TBC content (preview markers): missing [${missing.join(' | ')}], extra [${extra.join(' | ')}]`);
          const first = want.find((h) => norm1(h) === norm1(items[0] ?? ''));
          if (first && items[0] !== first) failures.push(`${tag}: the first list item must keep the heading as written ("${first}"), got "${items[0]}"`);
          for (const it of items.slice(1)) if (it !== it.toLowerCase()) failures.push(`${tag}: list item "${it}" after the first must be lower case`);
        }
        // one surface: chip -> list -> body -> research foot -> Contact the council button, all above "On this page"
        const x = await page.evaluate(SURFACE_EXTRA);
        const fail1 = (m) => failures.push(`${tag}: ${m}`);
        if (!x.body) fail1('[data-status-body] missing inside the surface (the existing banner sentence, verbatim)');
        else {
          if (x.body.text.replace(/\s+/g, ' ').trim() !== `${BANNER_FULL}`) fail1(`body reads "${x.body.text}", want the existing sentence verbatim`);
          if (x.body.fontSize !== '16px') fail1(`body font-size ${x.body.fontSize}, want 16px`);
          if (Math.abs(parseFloat(x.body.lineHeight) - 24.8) > 0.6) fail1(`body line-height ${x.body.lineHeight}, want ~24.8px`);
          if (x.body.color !== x.ink700) fail1(`body colour ${x.body.color}, want ink-700 ${x.ink700}`);
          if (x.body.textTransform !== 'none') fail1(`body text-transform ${x.body.textTransform}, want none`);
          if (parseFloat(x.body.borderTopWidth) > 0 || x.body.backgroundColor !== 'rgba(0, 0, 0, 0)') fail1('the body is still drawn as a pill/badge (border or fill); it is plain text');
        }
        if (!x.foot) fail1('[data-status-foot] missing inside the surface (the research label as the foot line)');
        else {
          if (record.labels?.research && x.foot.text.replace(/\s+/g, ' ').replace(/^\u203b\s*/, '').trim() !== record.labels.research) fail1(`foot reads "${x.foot.text}", want the existing research label "${record.labels.research}" verbatim`);
          if (x.foot.fontSize !== '15px') fail1(`foot font-size ${x.foot.fontSize}, want 15px`);
          if (Math.abs(parseFloat(x.foot.lineHeight) - 23.25) > 0.6) fail1(`foot line-height ${x.foot.lineHeight}, want ~23.25px (1.55)`);
          if (x.foot.color !== x.ink500) fail1(`foot colour ${x.foot.color}, want ink-500 ${x.ink500}`);
          if (x.foot.textTransform !== 'none') fail1(`foot text-transform ${x.foot.textTransform}, want none (sentence case)`);
        }
        for (const l of x.linkHeights) if (l.h < 44) fail1(`link "${l.text}" inside the surface is ${l.h.toFixed(1)}px tall, want >=44px`);
        if (!x.button) fail1('the "Contact the council" button is not inside the surface');
        else if (!x.buttonIsLast) fail1('the "Contact the council" button must be the last item inside the surface');
        const t = x.tops;
        if (!(t.chip < t.list && t.list < t.body && t.body < t.foot && t.foot < t.button)) fail1(`order inside the surface is wrong (chip ${t.chip}, list ${t.list}, body ${t.body}, foot ${t.foot}, button ${t.button}); want chip, list, body, foot, button`);
        if (x.navTop !== null && t.button !== null && t.button > x.navTop) fail1('the surface button sits below "On this page"; the whole surface is above it');
        if (x.bannerCopies !== 1) fail1(`the banner sentence renders ${x.bannerCopies}x, want once (inside the surface)`);
        if (x.contactAboveNavOutside > 0) fail1(`${x.contactAboveNavOutside} "Contact the council" link(s) above "On this page" outside the surface`);
      }
    }

    if (mode === 'public' && vp.width === 390 && record.labels?.pending) {
      const n = await probeAt(browser, `${origin}${ROUTE}`, AUTH, 320);
      const ds = n.ds.filter((d) => d.chip && d.chip.marker === 'pending');
      if (n.status !== 200) failures.push(`[public] ${ROUTE} @320: HTTP ${n.status}`);
      else if (ds.length !== 1) failures.push(`[public] ${ROUTE} @320: ${ds.length} pending disclosure surface(s), want 1`);
      else failures.push(...disclosureFailures(`[public] ${ROUTE} @320 pending line`, ds[0], 320, { text: record.labels.pending, link: false }));
    }

    // STEPS
    if (!m.steps.found || m.steps.n < 1) failures.push(`${tag}: step <ol> not found (R34 #4)`);
    else {
      m.steps.numerals.forEach((n, i) => {
        if (!n) failures.push(`${tag}: step ${i + 1} has no aria-hidden numeral`);
        else {
          if (n.text !== String(i + 1)) failures.push(`${tag}: step ${i + 1} numeral reads "${n.text}"`);
          if (!/fraunces/i.test(n.fontFamily)) failures.push(`${tag}: step ${i + 1} numeral family ${n.fontFamily}, want Fraunces`);
          if (parseFloat(n.fontSize) < 16) failures.push(`${tag}: step ${i + 1} numeral ${n.fontSize}, want >=16px`);
        }
      });
    }

    // TIMING lines (Codi ruling): 14px, line-height 1.45 (20.3px), ink-700, for every step that carries one
    if (m.steps.found) {
      const lines = m.steps.timing.filter(Boolean);
      if (lines.length < 1) failures.push(`${tag}: no step timing line found (the p after each step h3)`);
      for (const t of lines) {
        if (t.fontSize !== '14px') failures.push(`${tag}: timing line "${t.text}" font-size ${t.fontSize}, want 14px`);
        if (Math.abs(parseFloat(t.lineHeight) - 20.3) > 0.6) failures.push(`${tag}: timing line "${t.text}" line-height ${t.lineHeight}, want ~20.3px (1.45)`);
        if (t.color !== t.ink700) failures.push(`${tag}: timing line "${t.text}" colour ${t.color}, want ink-700 ${t.ink700}`);
      }
    }

    // interactive states at desktop
    if (!mobile && m.visNavCount === 1) {
      const chip = page.locator('nav[aria-label="On this page"] a').filter({ visible: true }).first();
      await page.evaluate(() => window.scrollTo(0, 0));
      await chip.hover();
      await page.waitForTimeout(TRANSITION_MS);
      const hov = await chip.evaluate((a) => getComputedStyle(a).backgroundColor);
      if (hov !== m.bone) failures.push(`${tag}: chip hover fill ${hov}, want bone ${m.bone}`);
      await page.mouse.move(0, 0);
      let focused = false;
      for (let i = 0; i < 60 && !focused; i += 1) {
        await page.keyboard.press('Tab');
        focused = await page.evaluate(() => !!document.activeElement?.closest('nav[aria-label="On this page"]'));
      }
      if (!focused) failures.push(`${tag}: keyboard Tab never reached a chip`);
      else {
        await page.waitForTimeout(TRANSITION_MS);
        const foc = await page.evaluate(() => getComputedStyle(document.activeElement).backgroundColor);
        if (foc !== m.bone) failures.push(`${tag}: chip focus-visible fill ${foc}, want bone ${m.bone}`);
      }
    }

    // FAQ unchanged (once, at 1280)
    if (!mobile) {
      const f = await page.goto(`${origin}/national-show/faq`, { waitUntil: 'networkidle' });
      if (!f || f.status() !== 200) failures.push(`/national-show/faq: HTTP ${f && f.status()}`);
      else {
        const q = await page.evaluate((cls) => {
          const nav = document.querySelector('nav[aria-label="FAQ categories"]');
          if (!nav) return null;
          const a = [...nav.querySelectorAll('a')];
          const cs = getComputedStyle(a[0]);
          return { navClass: nav.className, ulClass: nav.querySelector('ul')?.className, n: a.length, allR52: a.every((x) => x.className === cls), style: { fontSize: cs.fontSize, fontWeight: cs.fontWeight, borderTopWidth: cs.borderTopWidth, backgroundColor: cs.backgroundColor, color: cs.color, borderTopLeftRadius: cs.borderTopLeftRadius, h: a[0].getBoundingClientRect().height }, ids: a.every((x) => document.getElementById(x.getAttribute('href').slice(1))) };
        }, R52);
        if (!q) failures.push('/national-show/faq: nav[aria-label="FAQ categories"] missing');
        else {
          if (q.navClass !== 'mb-10') failures.push(`/faq nav class "${q.navClass}", want mb-10`);
          if (q.ulClass !== 'flex flex-wrap gap-2') failures.push(`/faq ul class "${q.ulClass}"`);
          if (!q.allR52) failures.push('/faq chips no longer carry the R52 class string');
          if (!q.ids) failures.push('/faq chips lost their faq-<category> targets');
          const a = q.style; const b = lead[1280];
          if (b && (a.fontSize !== b.fontSize || a.fontWeight !== b.fontWeight || a.borderTopWidth !== b.borderTopWidth || a.backgroundColor !== b.backgroundColor || a.color !== b.color || a.borderTopLeftRadius !== b.borderTopLeftRadius)) failures.push('exhibitor chips and FAQ chips compute different styles');
        }
      }
    }
    await ctx.close();
  }

}

let browser;
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
finish(NAME, failures, 'R34 rendered at 390 and 1280: one chip per h2 (verbatim, linked), R52 style and states, every chip lands fully visible and clear of the measured header, banner CTA plus end CTA, FAQ chips unchanged, Fraunces step numerals, no overflow.');
