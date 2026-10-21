// nos-critique-r8 f5 rendered (Codi FINAL), live data (on-site contact unconfirmed), both modes, 390 and 1280, /national-show/plan-your-visit.
//   the section is a full-bleed GOLD band (golden l.277-279): section bg rgb(243, 242, 214), edge to edge, no horizontal overflow, h2 32px above the numbers
//   national numbers: plain on the band under the h2, tel: targets >= 44px, never inside a role=group / .on-pale / disclosure, nearest filled ancestor = the gold section, before the on-site contact
//   on-site contact: ONE pale group (aria-label unchanged), bg rgb(251, 250, 240), one full chip, its h3 label, its note once below it; no tel links inside; the inline short "To be confirmed" tag is gone
//   page chips: Getting-there groups + 1 emergency (+ attractions group when present)
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { finish, repoRoot } from './_lib.mjs';
import { AUTH } from './_server.mjs';
import { F1_PATHS, F2_PATHS, F3_PATHS, F4_PATHS, F5_PATHS, openMode } from './r8-lib.mjs';

const NAME = 'f5-rendered.mjs';
const failures = [];
const sourceFiles = [...F1_PATHS, ...F2_PATHS, ...F3_PATHS, ...F4_PATHS, ...F5_PATHS].filter((rel) => existsSync(path.join(repoRoot, rel)));
const ROUTE = '/national-show/plan-your-visit';
const EMERGENCY = 'Emergency contacts, to be confirmed by the show committee';
const GETTING = 'Details to be confirmed by the show committee';
const FULL = 'To be confirmed by the show committee';
const SHORT = 'To be confirmed';
const FOOT = 'The committee will supply the on-site contact before the show.';
const ONSITE = 'On-site first aid and show duty contact';
const PALE_RGB = 'rgb(251, 250, 240)'; // #fbfaf0 = --gold-100
const GOLD_RGB = 'rgb(243, 242, 214)'; // #f3f2d6 = --gold

const collect = (arg) => {
  const q = (s, r = document) => [...r.querySelectorAll(s)];
  const norm = (t) => t.replace(/\s+/g, ' ').replace(/^※\s*/, '').trim();
  const top = (e) => e.getBoundingClientRect().top + scrollY;
  const groups = q('[role="group"]');
  const g = groups.find((x) => x.getAttribute('aria-label') === arg.emergency);
  const h2 = q('main h2').find((h) => norm(h.textContent) === 'In an emergency');
  const band = h2 ? h2.closest('section') : null;
  const filled = (e) => { const c = getComputedStyle(e).backgroundColor; return c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent'; };
  const tels = q('main a[href^="tel:"]').map((a) => {
    const r = a.getBoundingClientRect();
    const grp = a.closest('[role="group"], .on-pale, [data-tone], [data-status-disclosure]');
    let nearest = null;
    for (let n = a.parentElement; n; n = n.parentElement) if (filled(n)) { nearest = n; break; }
    return { href: a.getAttribute('href'), w: r.width, h: r.height, top: top(a), inGroup: !!grp, nearestIsBand: !!nearest && nearest === band };
  });
  const dl = band ? band.querySelector('dl') : null;
  const onsite = q('h3').find((h) => norm(h.textContent) === arg.onsite);
  const foots = g ? q('*', g).filter((e) => e.children.length === 0 && norm(e.textContent) === arg.foot) : [];
  const shortTags = q('main *').filter((e) => e.children.length === 0 && norm(e.textContent) === arg.short && !e.closest('[data-confirmation-badge]'));
  return {
    group: !!g, groupCount: groups.filter((x) => x.getAttribute('aria-label') === arg.emergency).length,
    gettingGroups: groups.filter((x) => x.getAttribute('aria-label') === arg.getting).length,
    bg: g ? getComputedStyle(g).backgroundColor : null, tone: g ? g.getAttribute('data-tone') : null,
    // The visible label span's textContent: the NOS chip is text-transform: uppercase, so innerText would be upper case, and the glyph and the display:none short tag are excluded.
    badges: q('[data-confirmation-badge]').map((b) => ({ text: norm([...b.children].filter((c) => c.getAttribute('aria-hidden') !== 'true' && getComputedStyle(c).display !== 'none').map((c) => c.textContent).join(' ')), inGroup: !!g && g.contains(b) })),
    h2: !!h2, h2Top: h2 ? top(h2) : null, tels,
    band: band ? (() => { const r = band.getBoundingClientRect(); return { bg: getComputedStyle(band).backgroundColor, left: r.left, width: r.width, gap: dl && h2 ? dl.getBoundingClientRect().top - h2.getBoundingClientRect().bottom : null }; })() : null,
    groupAfterNumbers: !!g && !!dl && !g.contains(dl) && !!(dl.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING),
    groupInBand: !!g && !!band && band.contains(g),
    onsite: onsite ? { top: top(onsite), inGroup: !!g && g.contains(onsite) } : null,
    footCount: foots.length, footTop: foots[0] ? top(foots[0]) : null,
    telsInGroup: g ? q('a[href^="tel:"]', g).length : 0,
    shortTags: shortTags.length,
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
};

let browser;
const handles = [];
try {
  browser = await chromium.launch();
  for (const mode of ['public', 'preview']) {
    const h = await openMode(mode, sourceFiles);
    if (h.stale) finish(NAME, h.stale);
    handles.push(h);
    for (const width of [390, 1280]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
      const page = await ctx.newPage();
      const tag = `[${mode}] ${ROUTE} @${width}`;
      const res = await page.goto(`${h.origin}${ROUTE}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); await ctx.close(); continue; }
      const m = await page.evaluate(collect, { emergency: EMERGENCY, getting: GETTING, onsite: ONSITE, foot: FOOT, short: SHORT });
      if (m.sw > m.cw) failures.push(`${tag}: horizontal overflow ${m.sw} > ${m.cw}`);
      if (!m.h2) failures.push(`${tag}: no "In an emergency" h2`);
      if (!m.band) failures.push(`${tag}: the h2 is not inside a section`);
      else {
        if (m.band.bg !== GOLD_RGB) failures.push(`${tag}: emergency section background ${m.band.bg}, want the gold band ${GOLD_RGB}`);
        if (Math.abs(m.band.left) > 1 || Math.abs(m.band.width - m.cw) > 1) failures.push(`${tag}: the band spans x=${m.band.left.toFixed(1)} width ${m.band.width.toFixed(1)}, want edge to edge (${m.cw})`);
        if (m.band.gap === null || Math.abs(m.band.gap - 32) > 2) failures.push(`${tag}: h2 to numbers gap ${m.band.gap}, want 32px (golden .emergency .h2 margin-bottom)`);
      }
      const hrefs = m.tels.map((t) => t.href);
      for (const t of ['tel:10111', 'tel:10177', 'tel:112']) if (!hrefs.includes(t)) failures.push(`${tag}: missing ${t}`);
      for (const t of m.tels) {
        if (t.h < 44 || t.w < 44) failures.push(`${tag}: ${t.href} target ${Math.round(t.w)}x${Math.round(t.h)} is under 44px`);
        if (t.inGroup) failures.push(`${tag}: national number ${t.href} sits inside a role=group / .on-pale / disclosure; they are plain on the band`);
        if (!t.nearestIsBand) failures.push(`${tag}: national number ${t.href}: its nearest filled ancestor must be the gold emergency section`);
        if (m.h2Top !== null && t.top < m.h2Top) failures.push(`${tag}: ${t.href} comes before the "In an emergency" h2`);
      }
      if (m.groupCount !== 1) failures.push(`${tag}: ${m.groupCount} role=group "${EMERGENCY}", want 1 (on-site contact unconfirmed)`);
      else {
        if (!m.groupInBand || !m.groupAfterNumbers) failures.push(`${tag}: the pale disclosure must sit on the band, as a separate block after the numbers`);
        if (m.tone !== 'pale' || m.bg !== PALE_RGB) failures.push(`${tag}: on-site disclosure tone ${m.tone} / ${m.bg}, want pale ${PALE_RGB}`);
        const mine = m.badges.filter((b) => b.inGroup);
        if (mine.length !== 1 || mine[0].text.toLowerCase() !== FULL.toLowerCase()) failures.push(`${tag}: the on-site disclosure holds ${mine.length} chip(s), want one "${FULL}"`);
        if (!m.onsite || !m.onsite.inGroup) failures.push(`${tag}: the "${ONSITE}" label must sit inside the on-site disclosure`);
        if (m.footCount !== 1) failures.push(`${tag}: the on-site note appears ${m.footCount} times in the disclosure, want once`);
        else if (m.onsite && m.footTop <= m.onsite.top) failures.push(`${tag}: the note must sit below the on-site label`);
        if (m.telsInGroup > 0) failures.push(`${tag}: ${m.telsInGroup} tel link(s) inside the on-site disclosure; the numbers are outside it`);
        if (m.onsite && m.tels.some((t) => t.top > m.onsite.top)) failures.push(`${tag}: the national numbers must come before the on-site contact`);
      }
      if (m.shortTags !== 0) failures.push(`${tag}: ${m.shortTags} inline short "${SHORT}" tag(s) remain; the chip says it (H8)`);
      const wantChips = m.gettingGroups + 1 + 0; // Getting-there group(s) incl. an attractions group + the emergency one
      if (m.badges.length !== wantChips) failures.push(`${tag}: ${m.badges.length} chips, want ${wantChips} (one per disclosure)`);
      await ctx.close();
    }
    h.stop();
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  for (const h of handles) h.stop();
  if (browser) await browser.close();
}

finish(NAME, failures, 'the section is a full-bleed gold band (rgb(243, 242, 214)) with the h2 32px above the numbers; national numbers are plain tel targets on the band; the unconfirmed on-site contact is one pale disclosure (rgb(251, 250, 240)) with one chip and its note; the inline short tag is gone.');
