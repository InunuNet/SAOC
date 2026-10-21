// nos-critique-r7 f1 rendered (Codi P3 H8; golden nos-v4/plan-your-visit.html l.575-616), BOTH modes, 390 and 1280, /national-show/plan-your-visit.
//   Getting there = ONE role=group disclosure: one full chip first, then h3 Parking / Public transport / Where to stay, no per-item card.
//   Venue aside sits between the two disclosures. Emergency = one role=group: one full chip, tel numbers, the on-site label with the short tag, the committee foot.
//   Page totals: 2 full chips, 1 short tag. what-to-expect is untouched (goldens/f1-baseline.json).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { finish, repoRoot } from './_lib.mjs';
import { AUTH } from './_server.mjs';
import { F1_PATHS, F2_PATHS, golden, openMode } from './r7-lib.mjs';

const NAME = 'f1-rendered.mjs';
const failures = [];
const BASELINE = JSON.parse(golden('f1-baseline.json'));
const ROUTE = '/national-show/plan-your-visit';
const sourceFiles = [...F1_PATHS, ...F2_PATHS].filter((rel) => existsSync(path.join(repoRoot, rel)));
const FULL = BASELINE.planYourVisit.pendingLabel;
const SHORT = BASELINE.planYourVisit.shortLabel;
const GETTING = 'Details to be confirmed by the show committee';
const EMERGENCY = 'Emergency contacts, to be confirmed by the show committee';
const ITEMS = ['Parking', 'Public transport', 'Where to stay'];
const PUBLISHED = 'It will be published here once it is ready.';
const COMMITTEE_FOOT = 'The committee will supply the on-site contact before the show.';
const ONSITE = 'On-site first aid and show duty contact';
const TELS = ['tel:10111', 'tel:10177', 'tel:112'];
const INK_500 = 'rgb(106, 103, 128)'; // #6a6780, nos-v4 index.html --ink-500 (a literal: a var probe resolves against the wrong scope)

const collect = (arg) => {
  const q = (s, r = document) => [...r.querySelectorAll(s)];
  const norm = (t) => t.replace(/\s+/g, ' ').replace(/^※\s*/, '').trim();
  const top = (e) => e.getBoundingClientRect().top + scrollY;
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('script, template, style, noscript').forEach((n) => n.remove());
  const pageText = norm(clone.textContent);
  const aside = document.querySelector('main aside');
  const follows = (a, b) => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const groupInfo = (label, pick = () => true) => {
    const gs = q('[role="group"]').filter((g) => g.getAttribute('aria-label') === label && pick(g));
    const g = gs[0];
    if (!g) return { count: gs.length };
    const badges = q('[data-confirmation-badge]', g).map((b) => {
      const cs = getComputedStyle(b);
      const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      const tops = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const re = /\S+/g; let m;
        while ((m = re.exec(n.data))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); const rc = r.getClientRects()[0]; if (rc) tops.push({ t: rc.top, h: rc.height }); }
      }
      const lines = tops.reduce((acc, w) => (acc.length && Math.abs(acc[acc.length - 1] - w.t) < w.h / 2 ? acc : [...acc, w.t]), []).length;
      return { text: norm(b.textContent), top: top(b), lines, ls: parseFloat(cs.letterSpacing) || 0, fs: parseFloat(cs.fontSize), pl: parseFloat(cs.paddingLeft), pr: parseFloat(cs.paddingRight) };
    });
    const surfacePad = parseFloat(getComputedStyle(g).paddingLeft);
    const h3s = q('h3', g).map((h) => ({ text: norm(h.textContent), top: top(h) }));
    const wrapped = h3s.length === 0 ? [] : q('h3', g).map((h) => {
      for (let n = h.parentElement; n && n !== g; n = n.parentElement) {
        const cs = getComputedStyle(n);
        const border = ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none');
        if (border || cs.boxShadow !== 'none') return norm(h.textContent);
      }
      return null;
    }).filter(Boolean);
    const tels = q('a[href^="tel:"]', g).map((a) => { const r = a.getBoundingClientRect(); return { href: a.getAttribute('href'), w: r.width, h: r.height }; });
    const shorts = q('*', g).filter((e) => e.children.length === 0 && norm(e.textContent) === arg.short).map((e) => {
      const cs = getComputedStyle(e);
      return { inBadge: !!e.closest('[data-confirmation-badge]'), top: top(e), fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color };
    });
    const onsite = q('*', g).find((e) => e.children.length === 0 && norm(e.textContent) === arg.onsite);
    const foots = q('*', g).filter((e) => e.children.length === 0 && norm(e.textContent) === arg.foot).map((e) => top(e));
    return { count: gs.length, node: true, top: top(g), surfacePad, badges, h3s, wrapped, tels, shorts, onsiteTop: onsite ? top(onsite) : null, foots };
  };
  const beforeAside = (g) => follows(g, aside);
  const afterAside = (g) => follows(aside, g);
  const getting = groupInfo(arg.gettingLabel, beforeAside);
  const attrGroup = groupInfo(arg.gettingLabel, afterAside);
  const emergency = groupInfo(arg.emergencyLabel);
  const gEl = q('[role="group"]').find((g) => g.getAttribute('aria-label') === arg.gettingLabel && beforeAside(g));
  const eEl = q('[role="group"]').find((g) => g.getAttribute('aria-label') === arg.emergencyLabel);
  return {
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    allBadges: q('[data-confirmation-badge]').map((b) => norm(b.textContent)),
    allShorts: q('main *').filter((e) => e.children.length === 0 && norm(e.textContent) === arg.short).length,
    publishedCount: pageText.split(arg.published).length - 1,
    getting, emergency, attrGroup,
    outline: q('main h1, main h2, main h3, main h4').map((h) => ({ level: Number(h.tagName[1]), text: norm(h.textContent) })),
    attr: (() => {
      const hd = q('main h2, main h3').find((h) => norm(h.textContent) === arg.attractions);
      if (!hd) return { present: false };
      const sec = hd.closest('section') ?? hd.parentElement;
      return {
        present: true, level: Number(hd.tagName[1]),
        itemLevels: q('h2, h3, h4', sec).filter((h) => h !== hd).map((h) => Number(h.tagName[1])),
        inDisclosure: !!hd.closest('[role="group"], [data-status-disclosure]'),
        badges: q('[data-confirmation-badge]', sec).length, groups: q('[role="group"], [data-status-disclosure]', sec).length,
        afterAside: follows(aside, hd), beforeEmergency: follows(hd, eEl),
      };
    })(),
    order: { gettingBeforeAside: follows(gEl, aside), asideBeforeEmergency: follows(aside, eEl) },
  };
};

let browser;
const handles = [];
try {
  browser = await chromium.launch();
  for (const mode of ['preview', 'public']) {
    const h = await openMode(mode, sourceFiles);
    if (h.stale) finish(NAME, h.stale);
    handles.push(h);
    for (const width of [390, 700, 1280]) { // 700 exactly: the chip-fit and 16px padding cap is inclusive (Codex P3)
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
      const page = await ctx.newPage();
      const tag = `[${mode}] ${ROUTE} @${width}`;
      const res = await page.goto(`${h.origin}${ROUTE}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); await ctx.close(); continue; }
      const m = await page.evaluate(collect, { short: SHORT, onsite: ONSITE, foot: COMMITTEE_FOOT, published: PUBLISHED, gettingLabel: GETTING, emergencyLabel: EMERGENCY, attractions: 'While you are here' });
      if (m.sw > m.cw) failures.push(`${tag}: horizontal overflow ${m.sw} > ${m.cw}`);
      const wantChips = 2 + m.attrGroup.count; // Getting there + emergency, plus the attractions disclosure when its status is not confirmed
      if (m.allBadges.length !== wantChips || m.allBadges.some((t) => t !== FULL)) failures.push(`${tag}: chips [${m.allBadges.join(' | ')}], want ${wantChips} x "${FULL}"`);
      if (m.attrGroup.count > 1) failures.push(`${tag}: ${m.attrGroup.count} attractions disclosure groups, want at most 1`);
      for (let i = 1; i < m.outline.length; i += 1) if (m.outline[i].level - m.outline[i - 1].level > 1) failures.push(`${tag}: heading outline jumps h${m.outline[i - 1].level} "${m.outline[i - 1].text}" to h${m.outline[i].level} "${m.outline[i].text}"`);
      if (m.outline[0] && m.outline[0].level !== 1) failures.push(`${tag}: the first heading is h${m.outline[0].level}, want the page h1`);
      for (const [name, level] of [['Getting there', 2], ['In an emergency', 2]]) { const hd = m.outline.find((x) => x.text === name); if (!hd || hd.level !== level) failures.push(`${tag}: "${name}" is ${hd ? 'h' + hd.level : 'missing'}, want h${level}`); }
      if (m.allShorts !== 1) failures.push(`${tag}: ${m.allShorts} short "${SHORT}" value(s) on the page, want 1`);
      if (m.publishedCount > 1) failures.push(`${tag}: "${PUBLISHED}" appears ${m.publishedCount} times; lede and foot must not duplicate it`);
      const g = m.getting;
      if (g.count !== 1) failures.push(`${tag}: ${g.count} role=group with aria-label "${GETTING}", want 1`);
      else {
        if (g.badges.length !== 1 || g.badges[0].text !== FULL) failures.push(`${tag}: the Getting-there group holds ${g.badges.length} chip(s), want 1 full chip`);
        const names = g.h3s.map((x) => x.text);
        if (JSON.stringify(names) !== JSON.stringify(ITEMS)) failures.push(`${tag}: group h3s [${names.join(', ')}], want [${ITEMS.join(', ')}]`);

        if (width <= 700) {
          const b0 = g.badges[0];
          if (b0) {
            if (b0.lines !== 1) failures.push(`${tag}: Getting-there chip wraps to ${b0.lines} lines, want one`);
            if (Math.abs(b0.ls - 0.06 * b0.fs) > 0.06) failures.push(`${tag}: Getting-there chip letter-spacing ${b0.ls}px, want 0.06em (${(0.06 * b0.fs).toFixed(2)}px)`);
            if (b0.pl !== 10 || b0.pr !== 10) failures.push(`${tag}: Getting-there chip inline padding ${b0.pl}/${b0.pr}, want 10px`);
          }
          if (g.surfacePad !== 16) failures.push(`${tag}: Getting-there surface inline padding ${g.surfacePad}px, want 16px`);
        }
        if (g.badges[0] && g.h3s[0] && g.badges[0].top > g.h3s[0].top) failures.push(`${tag}: the chip must come first, above Parking`);
        if (g.wrapped.length) failures.push(`${tag}: item(s) [${g.wrapped.join(', ')}] sit inside a bordered or shadowed card; the group is one surface`);
      }
      const e = m.emergency;
      if (e.count !== 1) failures.push(`${tag}: ${e.count} role=group with aria-label "${EMERGENCY}", want 1`);
      else {
        if (e.badges.length !== 1 || e.badges[0].text !== FULL) failures.push(`${tag}: the emergency group holds ${e.badges.length} chip(s), want 1 full chip`);

        if (width <= 700) {
          const b0 = e.badges[0];
          if (b0) {
            if (b0.lines !== 1) failures.push(`${tag}: emergency chip wraps to ${b0.lines} lines, want one`);
            if (Math.abs(b0.ls - 0.06 * b0.fs) > 0.06) failures.push(`${tag}: emergency chip letter-spacing ${b0.ls}px, want 0.06em (${(0.06 * b0.fs).toFixed(2)}px)`);
            if (b0.pl !== 10 || b0.pr !== 10) failures.push(`${tag}: emergency chip inline padding ${b0.pl}/${b0.pr}, want 10px`);
          }
          if (e.surfacePad !== 16) failures.push(`${tag}: emergency surface inline padding ${e.surfacePad}px, want 16px`);
        }
        const hrefs = e.tels.map((t) => t.href);
        for (const t of TELS) if (!hrefs.includes(t)) failures.push(`${tag}: emergency group lacks ${t}`);
        for (const t of e.tels) if (t.h < 44 || t.w < 44) failures.push(`${tag}: ${t.href} target ${Math.round(t.w)}x${Math.round(t.h)} is under 44px`);
        const shorts = e.shorts.filter((s) => !s.inBadge);
        if (shorts.length !== 1) failures.push(`${tag}: ${shorts.length} short tag(s) in the emergency group, want 1`);
        else {
          const s = shorts[0];
          if (s.fontSize !== '16px' || s.fontWeight !== '600') failures.push(`${tag}: short tag ${s.fontSize} / ${s.fontWeight}, want 16px / 600`);
          if (s.color !== INK_500) failures.push(`${tag}: short tag colour ${s.color}, want ink-500 ${INK_500}`);
          if (e.onsiteTop === null) failures.push(`${tag}: label "${ONSITE}" not found in the emergency group`);
          else if (s.top < e.onsiteTop - 4) failures.push(`${tag}: the short tag must sit with or below its "${ONSITE}" label`);
          if (e.foots.length !== 1) failures.push(`${tag}: committee foot appears ${e.foots.length} times in the emergency group, want 1`);
          else if (e.foots[0] <= s.top) failures.push(`${tag}: the committee foot must sit below the short tag`);
        }
      }
      if (m.attr.present) {
        // Codi FINAL: extras sit between the venue aside and the emergency group; same status rule as Getting there
        if (m.attr.level !== 2) failures.push(`${tag}: "While you are here" is h${m.attr.level}, want h2`);
        if (m.attr.itemLevels.some((l) => l !== 3)) failures.push(`${tag}: attraction items must be h3, found levels [${m.attr.itemLevels.join(', ')}]`);
        if (!m.attr.afterAside) failures.push(`${tag}: "While you are here" must come after the venue aside`);
        if (!m.attr.beforeEmergency) failures.push(`${tag}: "While you are here" must come before the emergency group, which closes the page`);
        if (m.attr.inDisclosure) failures.push(`${tag}: the "While you are here" heading belongs above its disclosure, not inside it`);
        const ag = m.attrGroup;
        if (ag.count === 1) {
          if (ag.badges.length !== 1 || ag.badges[0].text !== FULL) failures.push(`${tag}: attractions disclosure holds ${ag.badges.length} chip(s), want 1 full chip`);
          if (ag.wrapped.length) failures.push(`${tag}: attraction item(s) [${ag.wrapped.join(', ')}] sit in a card; items inside the disclosure carry no card of their own`);
          if (ag.badges[0] && ag.h3s[0] && ag.badges[0].top > ag.h3s[0].top) failures.push(`${tag}: the attractions chip must come first`);
          if (m.attr.badges !== 1) failures.push(`${tag}: attractions section holds ${m.attr.badges} chip(s), want exactly 1`);
        } else if (m.attr.badges > 0 || m.attr.groups > 0) failures.push(`${tag}: confirmed attractions must be plain, found ${m.attr.badges} chip(s) and ${m.attr.groups} group/disclosure element(s) in the section`);
      } else if (m.attrGroup.count > 0) failures.push(`${tag}: an attractions disclosure renders without the "While you are here" heading`);
      if (!m.order.gettingBeforeAside) failures.push(`${tag}: DOM order - the Getting-there group must come before the venue aside`);
      if (!m.order.asideBeforeEmergency) failures.push(`${tag}: DOM order - the venue aside must come before the emergency group`);
      await ctx.close();
    }
    // KEEP: what-to-expect is untouched
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    const route = '/national-show/what-to-expect';
    const res = await page.goto(`${h.origin}${route}`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) failures.push(`[${mode}] ${route}: HTTP ${res && res.status()}`);
    else {
      const w = await page.evaluate(() => ({
        blocks: [...document.querySelectorAll('[data-confirmation-badge]')].map((b) => (b.closest('section')?.querySelector('h2, h3')?.textContent ?? '?').replace(/\s+/g, ' ').trim()),
        disclosures: document.querySelectorAll('[data-status-disclosure]').length,
      }));
      const want = BASELINE.whatToExpectMustNotChange[mode];
      if (JSON.stringify(w.blocks) !== JSON.stringify(want.badgeBlocks)) failures.push(`[${mode}] ${route}: chips on [${w.blocks.join(', ')}], want unchanged [${want.badgeBlocks.join(', ')}]`);
      if (want.disclosures !== undefined && w.disclosures !== want.disclosures) failures.push(`[${mode}] ${route}: ${w.disclosures} disclosure surface(s), want unchanged ${want.disclosures}`);
    }
    await ctx.close();
    h.stop();
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  for (const h of handles) h.stop();
  if (browser) await browser.close();
}

finish(NAME, failures, 'plan-your-visit at 390 and 1280 in both modes: one Getting-there group (1 chip, 3 h3, no cards), venue between, one emergency group (1 chip, tel >=44px, short tag, committee foot); 2 full chips + 1 short tag; what-to-expect unchanged.');
