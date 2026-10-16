// nos-critique-r5 F2 — rendered check for R52, the restyled FAQ category chips on /national-show/faq.
// Ported from nos-critique-r4/check-rendered.mjs: every R44-A3 assertion stays (labelled nav after the hero,
// one chip per section in source order, <= 2 rows at 375/768/1280, no overflow, targets >= 44px, landing
// under the header, theme focus ring present from the first frame, instant scroll, no-JS) because R52
// changes the chip box (it gains a 1px border). R52 adds, at 320/375/768/1280:
//   BOX    every chip: border 1px solid, all four sides = resolved --primary (royal); background transparent at
//          rest; text colour = resolved --ink; font-size 14px; weight 600-700; letter-spacing 0 / normal;
//          text-transform none; Karla (--font-sans); transition-property lists no outline*/border*/all
//   STATES hovering a chip -> background = resolved --bone; leaving -> transparent again; keyboard focus-visible
//          -> background = --bone AND the outline is the --ring-focus colour; text stays ink in every state
//   CONTRAST ink-on-ground (rest) and ink-on-bone (hover and focus) >= 4.5:1, computed from the resolved
//          colours (ground = first non-transparent ancestor background)
//   BADGE  the per-answer [data-confirmation-badge] markers keep their low-tint style (bg parchment, border
//          --rule, text --muted) and do not change when hovered
// Requires a current build. Run as: node contracts/checks/nos-critique-r5/check-rendered-f2.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { LIST, NAV_LABEL, finish, gitRoot } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';

const NAME = 'check-rendered-f2.mjs';
const failures = [];
const { chromium } = require('playwright');
const SHOTS = path.resolve(gitRoot, '..', 'critique-r5-shots');
const URL_PATH = '/national-show/faq';

const stale = assertFreshBuild([LIST]);
if (stale.length > 0) finish(NAME, stale);

const VIEWPORTS = [
  { width: 320, height: 700, maxRows: 3 },
  { width: 375, height: 812, maxRows: 2 },
  { width: 768, height: 1024, maxRows: 2 },
  { width: 1280, height: 800, maxRows: 2 },
];
const NAV = `nav[aria-label="${NAV_LABEL}"]`;
const rows = [];
const parseRgb = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = '1'] = m[1].split(/[ ,/]+/).filter(Boolean); return { r: +r, g: +g, b: +b, a: +a }; };
const lum = ({ r, g, b }) => { const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
// Page-side functions: serialised with toString() and re-evaluated in the browser.
const tokenColours = () => {
  const nav = document.querySelector('nav[aria-label="FAQ categories"]');
  const out = {};
  for (const t of ['primary', 'ink', 'bone', 'rule', 'muted', 'parchment']) {
    const p = document.createElement('span');
    p.style.color = `var(--${t})`;
    nav.appendChild(p);
    out[t] = getComputedStyle(p).color;
    p.remove();
  }
  return out;
};
const chipStyle = (el) => {
  const cs = getComputedStyle(el);
  return {
    bt: cs.borderTopWidth, bs: cs.borderTopStyle,
    bc: [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor],
    bw: [cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth],
    bg: cs.backgroundColor, color: cs.color, size: cs.fontSize, weight: cs.fontWeight, ls: cs.letterSpacing,
    tt: cs.textTransform, fam: cs.fontFamily, tp: cs.transitionProperty,
  };
};
const groundOf = (el) => {
  for (let e = el.parentElement; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; }
  return 'rgb(255, 255, 255)';
};
const CHIP_FN = `(${chipStyle.toString()})`;
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
    await page.screenshot({ path: path.join(SHOTS, `r52-faq-${vp.width}.png`) });

    // ---- R52 box / states / contrast / badge ----
    {
      const tok = await page.evaluate(tokenColours);
      const resting = await page.locator(`${NAV} a`).evaluateAll(eval(`(els) => els.map(${CHIP_FN})`));
      const ground = await page.locator(`${NAV} a`).first().evaluate(eval(`(${groundOf.toString()})`));
      resting.forEach((c, i) => {
        const t = `${tag} chip ${i}`;
        if (c.bt !== '1px' || c.bs !== 'solid' || c.bw.some((w) => w !== '1px')) failures.push(`${t}: border ${c.bt} ${c.bs} (${c.bw.join('/')}), want 1px solid on all sides`);
        if (c.bc.some((x) => x !== tok.primary)) failures.push(`${t}: border colour ${c.bc[0]}, want --primary ${tok.primary}`);
        if (c.bg !== TRANSPARENT) failures.push(`${t}: rest background ${c.bg}, want transparent`);
        if (c.color !== tok.ink) failures.push(`${t}: text ${c.color}, want --ink ${tok.ink}`);
        if (c.size !== '14px') failures.push(`${t}: font-size ${c.size}, want 14px`);
        if (!(Number(c.weight) >= 600 && Number(c.weight) <= 700)) failures.push(`${t}: weight ${c.weight}, want 600-700`);
        if (c.ls !== 'normal' && parseFloat(c.ls) !== 0) failures.push(`${t}: letter-spacing ${c.ls}, want 0`);
        if (c.tt !== 'none') failures.push(`${t}: text-transform ${c.tt}, want none (sentence case)`);
        if (!/karla/i.test(c.fam)) failures.push(`${t}: font-family ${c.fam.slice(0, 60)}, want Karla`);
        if (/\b(all|outline|outline-color|border|border-color)\b/.test(c.tp)) failures.push(`${t}: transition-property ${c.tp} may only list color/background-color`);
      });
      const inkRgb = parseRgb(tok.ink);
      const restRatio = contrast(inkRgb, parseRgb(ground));
      if (restRatio < 4.5) failures.push(`${tag}: ink on ground ${ground} contrast ${restRatio.toFixed(2)}:1 < 4.5`);
      const boneRatio = contrast(inkRgb, parseRgb(tok.bone));
      if (boneRatio < 4.5) failures.push(`${tag}: ink on bone contrast ${boneRatio.toFixed(2)}:1 < 4.5`);
      if (vp.width === 375 || vp.width === 1280) {
        const last = page.locator(`${NAV} a`).last();
        await last.hover();
        await page.waitForTimeout(450);
        const hov = await last.evaluate(eval(CHIP_FN));
        if (hov.bg !== tok.bone) failures.push(`${tag}: hovered chip background ${hov.bg}, want --bone ${tok.bone}`);
        if (hov.color !== tok.ink) failures.push(`${tag}: hovered chip text ${hov.color}, want ink (no colour change on hover)`);
        if (hov.bc.some((x) => x !== tok.primary)) failures.push(`${tag}: hovered chip border ${hov.bc[0]}, want --primary`);
        await page.mouse.move(2, 2);
        await page.waitForTimeout(450);
        const off = await last.evaluate(eval(CHIP_FN));
        if (off.bg !== TRANSPARENT) failures.push(`${tag}: chip background ${off.bg} after the pointer left, want transparent`);
        const badge = page.locator('[data-confirmation-badge]').first();
        if ((await badge.count()) > 0) {
          await badge.scrollIntoViewIfNeeded();
          const restB = await badge.evaluate(eval(CHIP_FN));
          await badge.hover();
          await page.waitForTimeout(450);
          const hovB = await badge.evaluate(eval(CHIP_FN));
          if (restB.bg !== tok.parchment || restB.bc.some((x) => x !== tok.rule) || restB.color !== tok.muted) failures.push(`${tag}: status badge rest style bg ${restB.bg} border ${restB.bc[0]} text ${restB.color}, want parchment/--rule/--muted`);
          if (hovB.bg !== restB.bg || hovB.color !== restB.color || hovB.bc[0] !== restB.bc[0]) failures.push(`${tag}: status badge changes on hover (${restB.bg} -> ${hovB.bg}); badges stay low-tint with no hover`);
          await page.mouse.move(2, 2);
          await page.evaluate(() => window.scrollTo(0, 0));
        } else failures.push(`${tag}: no [data-confirmation-badge] found; cannot assert the badges are unchanged`);
      }
      rows.push(`    R52 @${vp.width}: border ${resting[0].bt} ${resting[0].bs}, bg ${resting[0].bg}, ${resting[0].size}/${resting[0].weight}/ls ${resting[0].ls}, contrast ${restRatio.toFixed(1)}:1 rest, ${boneRatio.toFixed(1)}:1 on bone`);
    }

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
      await page.waitForTimeout(450);
      const fs = await first.evaluate((el) => {
        const cs = getComputedStyle(el);
        const probe = (v) => { const p = document.createElement('span'); p.style.color = `var(--${v})`; el.parentElement.appendChild(p); const c = getComputedStyle(p).color; p.remove(); return c; };
        return { bg: cs.backgroundColor, bone: probe('bone'), color: cs.color, ink: probe('ink'), outline: cs.outlineColor, fv: el.matches(':focus-visible') };
      });
      if (!fs.fv) failures.push(`${tag}: chip lost :focus-visible after 450ms`);
      if (fs.bg !== fs.bone) failures.push(`${tag}: focus-visible chip background ${fs.bg}, want --bone ${fs.bone}`);
      if (fs.color !== fs.ink) failures.push(`${tag}: focus-visible chip text ${fs.color}, want ink ${fs.ink}`);
      if (fs.outline !== ring.want) failures.push(`${tag}: focus ring ${fs.outline} after 450ms, want ${ring.want} (the bone fill must not replace or fade the ring)`);
      await page.screenshot({ path: path.join(SHOTS, `r52-faq-focus-${vp.width}.png`) });
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
      await page.screenshot({ path: path.join(SHOTS, `r52-faq-jumped-${vp.width}.png`) });
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

finish(NAME, failures, `R52 chips (1px --primary border, transparent rest, ink text, bone on hover/focus-visible, 14px sentence case, contrast >= 4.5) and every R44-A3 behaviour kept: one per category in source order, labelled nav, <=2 rows at 375/768/1280, no overflow, targets >= 44px, heading clears the sticky header, theme focus ring, instant scroll, no JS needed. Measured:\n${rows.join('\n')}\nShots: ${SHOTS}`);
