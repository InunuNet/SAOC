// nos-critique-r7 f1 fixture (Codi FINAL, Codex P2): the Getting-there group is split by status, driven through props, never through a production switch.
//   confirmed items  plain h3 + body, no surface, no chip
//   unconfirmed      ONE role=group disclosure after the confirmed ones, one chip: pending if any item is pending (or unset), else research
//   all confirmed    no disclosure; order inside each part follows the golden (Parking, Public transport, Where to stay)
// Contract for the dev: components/show/VisitDisclosure.tsx exports VisitGettingThere({ items, pendingLabel, researchLabel }),
// items = [{ heading, body?, status?, children? }]; page.tsx maps the CMS fields to items and renders nothing else for this part.
// Attractions (Codi FINAL clarification): VisitAttractions({ title, attractions: [{ name, note?, url? }], status?, pendingLabel, researchLabel }) applies the same rule to
// "While you are here": h2 title; confirmed = plain section (no group, no chip, no nos-surface; the existing Cards may stay); any other status = the title stays above ONE
// role=group (the golden aria-label, reused verbatim) holding one chip and the items as plain h3 + note + link with no card; no attractions = nothing rendered.
// Dry run only: NOS_CR7_VISIT_COMPONENT points at a reference implementation.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';

import { finish, repoRoot, specDir } from './_lib.mjs';

const NAME = 'f1-fixture.mjs';
const failures = [];
const GETTING = 'Details to be confirmed by the show committee';
const comp = process.env.NOS_CR7_VISIT_COMPONENT ?? path.join(repoRoot, 'components/show/VisitDisclosure.tsx');
const names = ['Parking', 'Public transport', 'Where to stay'];

let rendered;
try {
  rendered = JSON.parse(execFileSync(path.join(repoRoot, 'node_modules/.bin/tsx'), [path.join(specDir, 'checks/f1-fixture-run.mjs'), repoRoot, comp], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 24 }));
} catch (e) {
  finish(NAME, [`could not render VisitGettingThere from ${comp}: ${String(e.stderr || e.message).split('\n').slice(0, 4).join(' | ')}`]);
}

const analyse = (label) => {
  const q = (s, r = document) => [...r.querySelectorAll(s)];
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  const root = document.getElementById('root');
  const groups = q('[role="group"]').filter((g) => g.getAttribute('aria-label') === label);
  const g = groups[0];
  const badges = q('[data-confirmation-badge]');
  const h3s = q('h3');
  const follows = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const info = (h) => {
    const next = h.nextElementSibling;
    let boxed = false;
    for (let n = h.parentElement; n && n !== root; n = n.parentElement) {
      if (g && n === g) break;
      if (/nos-surface|\bborder|\bshadow|\bbg-/.test(n.className || '')) boxed = true;
    }
    return { text: norm(h.textContent), inGroup: !!g && g.contains(h), body: next ? norm(next.textContent) : null, boxed, beforeGroup: g ? follows(h, g) : null };
  };
  return {
    groups: groups.length,
    badges: badges.map((b) => ({ text: norm(b.textContent), inGroup: !!g && g.contains(b), first: !!g && g.querySelector('[data-confirmation-badge]') === b && (g.firstElementChild === b || g.firstElementChild?.contains(b)) })),
    items: h3s.map(info),
  };
};

const WANT = {
  allConfirmed: { group: [], plain: names, chip: null },
  mixed: { group: ['Public transport', 'Where to stay'], plain: ['Parking'], chip: 'PENDING-FIX' },
  allPending: { group: names, plain: [], chip: 'PENDING-FIX' },
  allResearch: { group: names, plain: [], chip: 'RESEARCH-FIX' },
  confirmedAndResearch: { group: ['Public transport'], plain: ['Parking', 'Where to stay'], chip: 'RESEARCH-FIX' },
  unsetStatus: { group: names, plain: [], chip: 'PENDING-FIX' },
};

const analyseAttr = (label) => {
  const q = (s, r = document) => [...r.querySelectorAll(s)];
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  const root = document.getElementById('root');
  const g = q('[role="group"]').find((x) => x.getAttribute('aria-label') === label);
  const title = q('h2').find((h) => norm(h.textContent) === 'ATTR-TITLE');
  const items = q('h3');
  return {
    html: root.innerHTML.length, title: !!title, titleInGroup: !!(g && title && g.contains(title)),
    groups: q('[role="group"]').length, groupLabelOk: !!g,
    badges: q('[data-confirmation-badge]').map((b) => ({ text: norm(b.textContent), inGroup: !!g && g.contains(b), first: !!g && (g.firstElementChild === b || !!g.firstElementChild?.contains(b)) })),
    items: items.map((h) => ({ text: norm(h.textContent), inGroup: !!g && g.contains(h), boxed: (() => { for (let n = h.parentElement; n && n !== root; n = n.parentElement) { if (g && n === g) break; if (/\bCard\b|\bborder\b|border-|\bshadow|\bbg-/.test(n.className || '')) return true; } return false; })(), note: h.parentElement?.textContent.includes(h.textContent === 'Alpha Garden' ? 'Alpha note from the CMS' : 'Beta note from the CMS') })),
    link: q('a').map((a) => a.getAttribute('href')),
    surface: q('[class*="nos-surface"]').length,
  };
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [name, want] of Object.entries(WANT)) {
    await page.setContent(`<!doctype html><body>${rendered[name]}</body>`);
    const r = await page.evaluate(analyse, GETTING);
    const tag = `[${name}]`;
    if (want.group.length === 0) {
      if (r.groups !== 0) failures.push(`${tag}: ${r.groups} disclosure group(s), want none when nothing is unconfirmed`);
      if (r.badges.length !== 0) failures.push(`${tag}: ${r.badges.length} chip(s), want none`);
    } else {
      if (r.groups !== 1) failures.push(`${tag}: ${r.groups} role=group "${GETTING}", want exactly 1`);
      if (r.badges.length !== 1) failures.push(`${tag}: ${r.badges.length} chip(s), want exactly 1`);
      else {
        const b = r.badges[0];
        if (!b.inGroup) failures.push(`${tag}: the chip must sit inside the disclosure group`);
        if (!b.first) failures.push(`${tag}: the chip must come first in the group`);
        if (!b.text.includes(want.chip)) failures.push(`${tag}: chip reads "${b.text}", want the ${want.chip} label`);
        if (want.chip === 'RESEARCH-FIX' && b.text.includes('PENDING-FIX')) failures.push(`${tag}: pending chip shown although nothing is pending`);
      }
    }
    const inG = r.items.filter((i) => i.inGroup).map((i) => i.text);
    const plain = r.items.filter((i) => !i.inGroup).map((i) => i.text);
    if (JSON.stringify(inG) !== JSON.stringify(want.group)) failures.push(`${tag}: group h3s [${inG.join(', ')}], want [${want.group.join(', ')}]`);
    if (JSON.stringify(plain) !== JSON.stringify(want.plain)) failures.push(`${tag}: plain h3s [${plain.join(', ')}], want [${want.plain.join(', ')}]`);
    for (const i of r.items) {
      if (i.body !== `${i.text} body from the CMS`) failures.push(`${tag}: "${i.text}" body is "${i.body}", want its CMS body right after the h3`);
      if (!i.inGroup && i.boxed) failures.push(`${tag}: plain item "${i.text}" sits in a surface, border or fill; confirmed items have no surface`);
      if (!i.inGroup && i.beforeGroup === false) failures.push(`${tag}: plain item "${i.text}" must come before the disclosure group`);
    }
  }
  const AW = { attrConfirmed: { group: false }, attrPending: { group: true, chip: 'PENDING-FIX' }, attrResearch: { group: true, chip: 'RESEARCH-FIX' }, attrUnset: { group: true, chip: 'PENDING-FIX' } };
  for (const [name, want] of Object.entries(AW)) {
    await page.setContent(`<!doctype html><body>${rendered[name]}</body>`);
    const r = await page.evaluate(analyseAttr, GETTING);
    const tag = `[${name}]`;
    if (!r.title) failures.push(`${tag}: the h2 title is missing`);
    if (r.items.map((i) => i.text).join('|') !== 'Alpha Garden|Beta Winery') failures.push(`${tag}: item h3s [${r.items.map((i) => i.text).join(', ')}], want [Alpha Garden, Beta Winery]`);
    if (r.items.some((i) => !i.note)) failures.push(`${tag}: an item lost its note`);
    if (!r.link.includes('https://example.org/alpha')) failures.push(`${tag}: the item link is missing`);
    if (r.surface > 0) failures.push(`${tag}: ${r.surface} nos-surface wrapper(s); the section itself has no surface`);
    if (want.group) {
      if (r.groups !== 1 || !r.groupLabelOk) failures.push(`${tag}: want ONE role=group with the golden label, got ${r.groups} (label ok ${r.groupLabelOk})`);
      if (r.titleInGroup) failures.push(`${tag}: the h2 title belongs above the group, not inside it`);
      if (r.badges.length !== 1 || !r.badges[0].inGroup || !r.badges[0].first || !r.badges[0].text.includes(want.chip)) failures.push(`${tag}: want one ${want.chip} chip first in the group, got ${JSON.stringify(r.badges)}`);
      if (r.items.some((i) => !i.inGroup)) failures.push(`${tag}: every item must sit inside the group`);
      if (r.items.some((i) => i.boxed)) failures.push(`${tag}: items inside the disclosure carry no card of their own`);
    } else {
      if (r.groups !== 0 || r.badges.length !== 0) failures.push(`${tag}: confirmed attractions are plain, got ${r.groups} group(s) and ${r.badges.length} chip(s)`);
    }
  }
  await page.setContent(`<!doctype html><body>${rendered.attrEmpty}</body>`);
  const empty = await page.evaluate(() => document.getElementById('root').children.length);
  if (empty !== 0) failures.push('[attrEmpty]: no attractions must render nothing at all');
} finally {
  await browser.close();
}

finish(NAME, failures, 'VisitGettingThere and VisitAttractions split by status: confirmed items plain, unconfirmed in ONE group with one chip (pending wins over research), no group when all confirmed, golden order within each part.');
