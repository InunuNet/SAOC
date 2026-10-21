// nos-critique-r8 f5 fixture (Codi FINAL, supersedes golden l.605-616), props only.
// GOLD BAND (Codi FINAL, golden l.277-279): VisitEmergency renders the WHOLE band: a full-width <NosSection> carrying `bg-[var(--gold)]` (the section's own background, the whole viewport width),
// its wrap, and the h2 with a 32px bottom margin (`mb-8`). The page places it as a top-level sibling AFTER the main NosSection (not inside its wrap) and before the CtaBand. The band is
// the section's, not a status's, so it stays in every state, including confirmed.
// Contract for the dev: components/show/VisitDisclosure.tsx exports VisitEmergency({ title, label, contacts, status, pendingLabel, researchLabel }),
// contacts = [{ _key?, label, number?, note? }]. The component renders the section: an h2 `title`, then
//   dial contacts (number is phone-shaped: PHONE_SHAPED moves here from the page) ALWAYS plain, directly under the h2: tel: links, no surface, no chip, whatever `status` says;
//   then the other contacts (the on-site first aid / show duty contact), following `status`:
//     not 'confirmed' (pending, research, unset): ONE pale VisitDisclosure (data-tone="pale", aria-label = `label`) with one chip (pending or unset beats research), each contact's label as an h3 and its note as the foot;
//       the contact's own value (Sanity "To be confirmed") is NOT drawn, because the chip says it;
//     'confirmed': plain h3 label, the value, and the note: no surface, no chip, no role=group;
//   an empty list renders nothing, and no on-site contact means no disclosure at all.
// Invariant in every case: the national numbers are never inside a role=group whose aria-label mentions "to be confirmed".
// Dry run only: NOS_CR8_VISIT_COMPONENT points at a reference implementation.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';

import { finish, repoRoot, specDir } from './_lib.mjs';

const NAME = 'f5-fixture.mjs';
const failures = [];
const comp = process.env.NOS_CR8_VISIT_COMPONENT ?? path.join(repoRoot, 'components/show/VisitDisclosure.tsx');
const LABEL = 'Emergency contacts, to be confirmed by the show committee';

let rendered;
try {
  rendered = JSON.parse(execFileSync(path.join(repoRoot, 'node_modules/.bin/tsx'), [path.join(specDir, 'checks/f5-fixture-run.mjs'), repoRoot, comp], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 24 }));
} catch (e) {
  finish(NAME, [`could not render VisitEmergency from ${comp}: ${String(e.stderr || e.message).split('\n').slice(0, 4).join(' | ')}`]);
}

const analyse = (arg) => {
  const q = (s, r = document) => [...r.querySelectorAll(s)];
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  const root = document.getElementById('root');
  const follows = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const groups = q('[role="group"]');
  const g = groups.find((x) => x.getAttribute('aria-label') === arg.label);
  const tels = q('a[href^="tel:"]');
  const onsite = q('h3').find((h) => norm(h.textContent) === 'ONSITE-LABEL-FROM-CMS');
  const title = q('h2').find((h) => norm(h.textContent) === 'EMERGENCY-TITLE');
  const band = title ? title.closest('section') : null;
  const text = norm(root.textContent);
  return {
    empty: root.children.length === 0,
    band: !!band, bandCls: band ? band.className : '', bandWrap: !!band && !!band.querySelector(':scope > [data-nos-wrap]'), bandTels: !!band && tels.every((a) => band.contains(a)), bandGroup: !!band && (!g || band.contains(g)), headingMb: !!title && !!title.closest('[class*="mb-8"]') && band.contains(title.closest('[class*="mb-8"]')),
    title: !!title,
    groups: groups.length, group: !!g, tone: g ? g.getAttribute('data-tone') : null,
    badges: q('[data-confirmation-badge]').map((b) => ({ text: norm(b.textContent), inGroup: !!g && g.contains(b) })),
    tels: tels.map((a) => ({ href: a.getAttribute('href'), inToBeConfirmedGroup: !!a.closest('[role="group"]') && /to be confirmed/i.test(a.closest('[role="group"]').getAttribute('aria-label') || ''), inAnyGroup: !!a.closest('[role="group"]') })),
    onsite: onsite ? { inGroup: !!g && g.contains(onsite), after: tels.length > 0 && follows(tels[tels.length - 1], onsite), before: tels.length > 0 && follows(onsite, tels[0]) } : null,
    hasValue: text.includes('ONSITE-VALUE-FROM-CMS'), hasFoot: text.includes('FOOT-FROM-CMS'), footInGroup: !!g && g.textContent.includes('FOOT-FROM-CMS'),
    mobileNote: text.includes('MOBILE-NOTE-FROM-CMS'),
  };
};

const WANT = {
  pending: { group: true, chip: 'PENDING-FIX' },
  research: { group: true, chip: 'RESEARCH-FIX' },
  unset: { group: true, chip: 'PENDING-FIX' },
  confirmed: { group: false },
  onsiteFirst: { group: true, chip: 'PENDING-FIX' },
  dialOnlyPending: { group: false, noOnsite: true },
};
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [name, want] of Object.entries(WANT)) {
    await page.setContent(`<!doctype html><body>${rendered[name]}</body>`);
    const r = await page.evaluate(analyse, { label: LABEL });
    const tag = `[${name}]`;
    if (!r.title) failures.push(`${tag}: the h2 title is missing`);
    if (!r.band || !/bg-\[var\(--gold\)\]/.test(r.bandCls)) failures.push(`${tag}: the section must carry the gold band (bg-[var(--gold)]) in every state, got "${r.bandCls}"`);
    if (!/\bnos-section\b/.test(r.bandCls) || !r.bandWrap) failures.push(`${tag}: the band must be a NosSection (full-width section with its [data-nos-wrap])`);
    if (!r.bandTels || !r.bandGroup) failures.push(`${tag}: the numbers and the on-site disclosure must sit inside the band section`);
    if (!r.headingMb) failures.push(`${tag}: the h2 needs the 32px bottom margin (mb-8)`);
    if (JSON.stringify(r.tels.map((t) => t.href)) !== JSON.stringify(['tel:10111', 'tel:10177', 'tel:112'])) failures.push(`${tag}: tel links ${JSON.stringify(r.tels.map((t) => t.href))}, want the three national numbers in order`);
    for (const t of r.tels) {
      if (t.inToBeConfirmedGroup) failures.push(`${tag}: national number ${t.href} sits inside a "to be confirmed" group; national numbers are always plain`);
      if (t.inAnyGroup) failures.push(`${tag}: national number ${t.href} sits inside a role=group; they are plain, directly under the h2`);
    }
    if (!r.mobileNote) failures.push(`${tag}: the mobile-emergency note was dropped`);
    if (want.group) {
      if (!r.group || r.groups !== 1) failures.push(`${tag}: want ONE role=group "${LABEL}", got ${r.groups} (label ok ${r.group})`);
      if (r.tone !== 'pale') failures.push(`${tag}: the disclosure must be the pale tone (data-tone="pale"), got ${r.tone}`);
      if (r.badges.length !== 1 || !r.badges[0].inGroup || !r.badges[0].text.includes(want.chip)) failures.push(`${tag}: want one ${want.chip} chip inside the group, got ${JSON.stringify(r.badges)}`);
      if (!r.onsite || !r.onsite.inGroup) failures.push(`${tag}: the on-site contact label must sit inside the disclosure`);
      if (!r.footInGroup) failures.push(`${tag}: the on-site note (foot) must sit inside the disclosure`);
      if (r.hasValue) failures.push(`${tag}: the on-site value "To be confirmed" is drawn; the chip says it, so the inline tag is dropped (H8)`);
    } else if (want.noOnsite) {
      if (r.groups !== 0 || r.badges.length !== 0) failures.push(`${tag}: no on-site contact means no disclosure and no chip, got ${r.groups} group(s), ${r.badges.length} chip(s)`);
    } else {
      if (r.groups !== 0 || r.badges.length !== 0) failures.push(`${tag}: confirmed means plain, got ${r.groups} group(s) and ${r.badges.length} chip(s)`);
      if (!r.onsite) failures.push(`${tag}: the on-site contact label is missing`);
      if (!r.hasValue || !r.hasFoot) failures.push(`${tag}: confirmed on-site contact must show its value and its note (value ${r.hasValue}, note ${r.hasFoot})`);
    }
    if (name !== 'onsiteFirst' && r.onsite && !r.onsite.after) failures.push(`${tag}: the on-site contact must come after the national numbers`);
    if (name === 'onsiteFirst' && r.onsite && !r.onsite.after) failures.push(`${tag}: even when the CMS lists it first, the on-site contact comes after the national numbers`);
  }
  await page.setContent(`<!doctype html><body>${rendered.empty}</body>`);
  const empty = await page.evaluate(() => document.getElementById('root').children.length);
  if (empty !== 0) failures.push('[empty]: no contacts must render nothing at all');
} finally {
  await browser.close();
}

finish(NAME, failures, 'VisitEmergency renders the gold band section in every state, keeps the national numbers plain under the h2 in every state; the on-site contact is one pale disclosure with one chip and its foot when unconfirmed (value dropped), plain when confirmed.');
