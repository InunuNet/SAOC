// nos-critique-r4 F1 — rendered check for the R44-A3 FAQ category jump chips on /national-show/faq.
// Starts `next start` on 3010-3019 (never 3002) via _server.mjs. At 320, 375, 768 and 1280:
//   NAV     exactly one nav[aria-label="FAQ categories"] (accessible name), after the hero and before the
//           first category section, no search/filter control anywhere in main
//   LINKS   one link per category section, in source order, text equal to the section h2, each href "#id"
//           resolving to that section's h2; link text carries no "To be confirmed" marker
//   LAYOUT  <= 2 rows at 375/768/1280 (<= 3 at 320), no horizontal overflow on the page or the nav, no
//           scrolling container around the chips
//   TARGET  every link >= 44px tall and wide
//   SCROLL  each h2 scroll-margin-top >= the ruled value (62px below 768, 74px from 768; the NOS header is
//           only sticky above 699px, so the margin is NOT compared with the header height). Clicking each
//           link sets the hash and: where the header computes sticky/fixed, the heading lands at or below the
//           header bottom and within header bottom + 120px; where it does not, the heading lands in the
//           viewport within 160px of the top (a scrolled-away header is never the reference). The upper
//           bounds are skipped when the page cannot scroll that far.
//   FOCUS   keyboard-focused link shows an outline >= 2px in the theme ring colour (--ring-focus) from the
//           first frame: outline-color is not transitioned (transition-property excludes all/outline*)
//   MOTION  html scroll-behavior is never smooth; click works under prefers-reduced-motion: reduce
//   NO-JS   with JavaScript disabled the nav, links and sections still render
// Requires a current build. Run as: node contracts/checks/nos-critique-r4/check-rendered.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { LIST, NAV_LABEL, PAGE, finish, gitRoot } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';

const NAME = 'check-rendered.mjs';
const failures = [];
const { chromium } = require('playwright');
const SHOTS = path.resolve(gitRoot, '..', 'critique-r4-shots');
const URL_PATH = '/national-show/faq';

const stale = assertFreshBuild([LIST, PAGE]);
if (stale.length > 0) finish(NAME, stale);

const VIEWPORTS = [
  { width: 320, height: 700, maxRows: 3 },
  { width: 375, height: 812, maxRows: 2 },
  { width: 768, height: 1024, maxRows: 2 },
  { width: 1280, height: 800, maxRows: 2 },
];
const NAV = `nav[aria-label="${NAV_LABEL}"]`;
const rows = [];
let browser;
let stop = () => {};

const measure = (navSel) => {
  const nav = document.querySelector(navSel);
  const navs = document.querySelectorAll(navSel).length;
  const sections = [...document.querySelectorAll('section[aria-labelledby^="faq-"]')];
  const heads = sections.map((s) => document.getElementById(s.getAttribute('aria-labelledby')));
  const links = nav ? [...nav.querySelectorAll('a')] : [];
  const header = document.querySelector('.nh') ?? document.querySelector('header');
  const hero = document.querySelector('[data-nos-hero]');
  const main = document.querySelector('main') ?? document.body;
  const scrollers = nav
    ? [nav, ...nav.querySelectorAll('*')].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth)
    : [];
  const probe = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
  return {
    navs,
    label: nav ? nav.getAttribute('aria-label') : null,
    linkText: links.map((a) => a.textContent.replace(/\s+/g, ' ').trim()),
    hrefs: links.map((a) => a.getAttribute('href')),
    headText: heads.map((h) => (h ? h.textContent.replace(/\s+/g, ' ').trim() : null)),
    targetsAreH2: links.map((a) => {
      const el = document.getElementById((a.getAttribute('href') || '').slice(1));
      return !!el && el.tagName === 'H2' && heads.includes(el);
    }),
    order: heads.length ? { afterHero: probe(hero ?? document.querySelector('main h1'), nav), beforeFirstSection: probe(nav, sections[0]) } : null,
    boxes: links.map((a) => { const r = a.getBoundingClientRect(); return { w: r.width, h: r.height, top: Math.round(r.top + window.scrollY) }; }),
    scrollMargins: heads.map((h) => (h ? parseFloat(getComputedStyle(h).scrollMarginTop) : 0)),
    headerH: header ? header.getBoundingClientRect().height : 0,
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    navOverflow: nav ? nav.scrollWidth > nav.clientWidth + 1 : false,
    scrollers: scrollers.length,
    filters: main.querySelectorAll('input, textarea, select, [role="search"], [type="search"]').length,
    smooth: getComputedStyle(document.documentElement).scrollBehavior === 'smooth',
    tbc: links.filter((a) => /to be confirmed|tbc/i.test(a.textContent)).length,
  };
};

try {
  const srv = await startServer();
  stop = srv.stop;
  const { origin } = srv;
  mkdirSync(SHOTS, { recursive: true });
  browser = await chromium.launch();
  const headers = { authorization: AUTH };

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, extraHTTPHeaders: headers });
    const page = await ctx.newPage();
    const tag = `${URL_PATH} @${vp.width}`;
    const res = await page.goto(`${origin}${URL_PATH}`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); await ctx.close(); continue; }
    const m = await page.evaluate(measure, NAV);

    if (m.navs !== 1) { failures.push(`${tag}: ${m.navs} ${NAV} elements, want exactly 1`); await ctx.close(); continue; }
    if (!m.label || !m.label.trim()) failures.push(`${tag}: nav has no accessible name`);
    const n = m.linkText.length;
    if (n < 2) failures.push(`${tag}: ${n} chip link(s), want one per category section (>= 2)`);
    if (n !== m.headText.length) failures.push(`${tag}: ${n} chips but ${m.headText.length} category sections`);
    if (JSON.stringify(m.linkText) !== JSON.stringify(m.headText)) failures.push(`${tag}: chip text/order ${JSON.stringify(m.linkText)} != section headings ${JSON.stringify(m.headText)}`);
    m.hrefs.forEach((h, i) => {
      if (!/^#faq-[a-z-]+$/.test(h || '')) failures.push(`${tag}: chip ${i} href ${JSON.stringify(h)} is not an in-page #faq-<category>`);
      if (!m.targetsAreH2[i]) failures.push(`${tag}: chip ${i} href ${JSON.stringify(h)} does not resolve to a category section h2`);
    });
    if (new Set(m.hrefs).size !== m.hrefs.length) failures.push(`${tag}: duplicate chip hrefs`);
    if (!m.order || !m.order.afterHero || !m.order.beforeFirstSection) failures.push(`${tag}: nav must follow the hero and precede the first category section ${JSON.stringify(m.order)}`);
    if (m.filters > 0) failures.push(`${tag}: ${m.filters} input/search/filter control(s) in main (R44-A3: no filter)`);
    if (m.tbc > 0) failures.push(`${tag}: ${m.tbc} chip(s) carry a To-be-confirmed marker (R41 is out of scope)`);
    const rowTops = new Set(m.boxes.map((b) => b.top));
    if (rowTops.size > vp.maxRows) failures.push(`${tag}: chips wrap to ${rowTops.size} rows, want <= ${vp.maxRows}`);
    if (m.sw > m.cw) failures.push(`${tag}: horizontal overflow ${m.sw} > ${m.cw}`);
    if (m.navOverflow || m.scrollers > 0) failures.push(`${tag}: chips sit in a scrolling container (nav overflow ${m.navOverflow}, ${m.scrollers} scrollers); must wrap`);
    m.boxes.forEach((b, i) => { if (b.h < 44 || b.w < 44) failures.push(`${tag}: chip ${i} target ${Math.round(b.w)}x${Math.round(b.h)}px, want >= 44x44`); });
    const ruledMargin = vp.width >= 768 ? 74 : 62;
    m.scrollMargins.forEach((s, i) => { if (s < ruledMargin) failures.push(`${tag}: section ${i} scroll-margin-top ${s}px < ruled ${ruledMargin}px`); });
    if (m.smooth) failures.push(`${tag}: html scroll-behavior is smooth; jumps must be instant`);
    rows.push(`  ${tag}: ${n} chips in ${rowTops.size} row(s), header ${Math.round(m.headerH)}px, margins ${m.scrollMargins.join('/')}px, min target ${Math.round(Math.min(...m.boxes.map((b) => b.h)))}px`);
    await page.screenshot({ path: path.join(SHOTS, `r44-a3-faq-${vp.width}.png`) });

    // keyboard focus ring on the first chip
    const first = page.locator(`${NAV} a`).first();
    let focused = false;
    for (let i = 0; i < 60 && !focused; i += 1) {
      await page.keyboard.press('Tab');
      focused = await first.evaluate((el) => el === document.activeElement);
    }
    if (!focused) failures.push(`${tag}: first chip never received keyboard focus`);
    else {
      const ring = await first.evaluate((el) => {
        // Refocus synchronously: a transitioned outline-color would still read its start value here.
        el.blur();
        el.focus();
        const cs = getComputedStyle(el);
        const p = document.createElement('span');
        p.style.color = 'var(--ring-focus)';
        el.parentElement.appendChild(p);
        const want = getComputedStyle(p).color;
        p.remove();
        return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor, want, tp: cs.transitionProperty, focusVisible: el.matches(':focus-visible') };
      });
      if (ring.style === 'none' || ring.width < 2) failures.push(`${tag}: focused chip outline ${ring.style} ${ring.width}px, want >= 2px solid`);
      if (!ring.focusVisible) failures.push(`${tag}: refocused chip is not :focus-visible; cannot assert the ring`);
      if (/\b(all|outline|outline-color)\b/.test(ring.tp)) failures.push(`${tag}: chip transitions ${ring.tp}; outline-color must not animate (ring would fade in from the text colour)`);
      if (ring.color !== ring.want) failures.push(`${tag}: focus ring ${ring.color}, want theme --ring-focus ${ring.want}`);
      await page.screenshot({ path: path.join(SHOTS, `r44-a3-faq-focus-${vp.width}.png`) });
    }

    // click every chip: hash set, heading clear of the header
    const landings = [];
    if (vp.width === 375 || vp.width === 1280) {
      for (let i = 0; i < n; i += 1) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.locator(`${NAV} a`).nth(i).click();
        await page.waitForTimeout(350);
        const r = await page.evaluate((idx) => {
          const a = document.querySelectorAll('nav[aria-label="FAQ categories"] a')[idx];
          const id = a.getAttribute('href').slice(1);
          const h = document.getElementById(id);
          const header = document.querySelector('.nh') ?? document.querySelector('header');
          const pos = header ? getComputedStyle(header).position : 'static';
          return {
            hash: location.hash,
            id,
            top: h.getBoundingClientRect().top,
            vh: window.innerHeight,
            sticky: pos === 'sticky' || pos === 'fixed',
            headerBottom: header ? header.getBoundingClientRect().bottom : 0,
            atBottom: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2,
          };
        }, i);
        if (r.hash !== `#${r.id}`) failures.push(`${tag}: chip ${i} click left hash ${r.hash}, want #${r.id}`);
        if (r.sticky) {
          if (r.top < r.headerBottom - 1) failures.push(`${tag}: chip ${i} heading at ${Math.round(r.top)}px is under the ${Math.round(r.headerBottom)}px sticky header`);
          else if (!r.atBottom && r.top > r.headerBottom + 120) failures.push(`${tag}: chip ${i} heading at ${Math.round(r.top)}px is ${Math.round(r.top - r.headerBottom)}px below the sticky header, want <= 120`);
        } else {
          if (r.top < 0 || r.top >= r.vh) failures.push(`${tag}: chip ${i} heading at ${Math.round(r.top)}px is outside the viewport`);
          else if (!r.atBottom && r.top > 160) failures.push(`${tag}: chip ${i} heading at ${Math.round(r.top)}px, want within 160px of the top (header not sticky here)`);
        }
        landings.push(`${Math.round(r.top)}${r.sticky ? 's' : ''}`);
      }
      rows.push(`    landings @${vp.width} (px from top, s = sticky header): ${landings.join(' ')}`);
      await page.screenshot({ path: path.join(SHOTS, `r44-a3-faq-jumped-${vp.width}.png`) });
    }
    await ctx.close();
  }

  // reduced motion: the jump still lands and nothing animates the scroll
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce', extraHTTPHeaders: headers });
    const page = await ctx.newPage();
    await page.goto(`${origin}${URL_PATH}`, { waitUntil: 'networkidle' });
    await page.locator(`${NAV} a`).last().click();
    const r = await page.evaluate(() => ({ hash: location.hash, smooth: getComputedStyle(document.documentElement).scrollBehavior === 'smooth' }));
    if (!r.hash.startsWith('#faq-')) failures.push(`reduced-motion: click did not set the hash (${r.hash})`);
    if (r.smooth) failures.push('reduced-motion: scroll-behavior smooth');
    await ctx.close();
  }

  // no JavaScript: server-rendered nav and sections
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, javaScriptEnabled: false, extraHTTPHeaders: headers });
    const page = await ctx.newPage();
    await page.goto(`${origin}${URL_PATH}`, { waitUntil: 'load' });
    const links = await page.locator(`${NAV} a`).count();
    const secs = await page.locator('section[aria-labelledby^="faq-"]').count();
    if (links < 2 || links !== secs) failures.push(`no-JS: ${links} chip(s) vs ${secs} section(s)`);
    await ctx.close();
  }
} catch (err) {
  failures.push(`${err.name}: ${err.message}`);
} finally {
  if (browser) await browser.close();
  stop();
}

finish(NAME, failures, `R44-A3 FAQ jump chips: one per category in source order, labelled nav, <=2 rows at 375/768/1280, no overflow, targets >= 44px, heading clears the sticky header, theme focus ring, instant scroll, no JS needed. Measured:\n${rows.join('\n')}\nShots: ${SHOTS}`);
