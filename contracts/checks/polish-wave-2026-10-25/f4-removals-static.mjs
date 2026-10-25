// F4 static: removals only, no new copy.
//   JudgesDirectory: the log-in clause is gone and the paragraph reads on as two plain sentences
//     built only from words already there. Exact expected text pinned below.
//   /programme: the TicketSection no longer prints a visible H2 (hideHeading); the section keeps
//     its accessible name via aria-label. The hub and /workshops keep their H2.
//   /sponsors (SAOC): no "Our sponsors" eyebrow; the Become-a-sponsor body is left-aligned.
// Run as: node contracts/checks/polish-wave-2026-10-25/f4-removals-static.mjs   (POLISH_ROOT optional)
import { finish, read, tags } from './_lib.mjs';

const failures = [];

const judges = read('components/judging/JudgesDirectory.tsx');
const flat = judges.replace(/\s+/g, ' ');
if (/Log in through/i.test(judges) || /your affiliated society/.test(judges)) failures.push('JudgesDirectory still carries the log-in clause');
const WANT = 'The full accredited judges directory is available to SAOC members. Get in touch with the council directly.';
if (!flat.includes(`>${' '}${WANT}${' '}</p>`) && !flat.includes(WANT)) failures.push(`JudgesDirectory paragraph is not exactly: ${WANT}`);
if (!judges.includes('Contact SAOC →')) failures.push('JudgesDirectory lost the existing Contact SAOC link');

const ts = read('components/tickets/keepsake/TicketSection.tsx');
if (!/hideHeading\??:\s*boolean/.test(ts)) failures.push('TicketSection has no hideHeading?: boolean prop');
if (!/aria-label=\{[^}]*\btitle\b[^}]*\}/.test(ts)) failures.push('TicketSection does not name the section with an aria-label built from title when the heading is hidden');
if (!/hideHeading/.test(ts.split('return')[ts.split('return').length - 1] ?? '')) failures.push('TicketSection render does not use hideHeading');
const programme = read('app/(nos)/national-show/programme/page.tsx');
const progSections = tags(programme, 'TicketSection');
if (progSections.length !== 1) failures.push(`programme/page.tsx: expected one TicketSection, found ${progSections.length}`);
else if (!/\bhideHeading\b/.test(progSections[0])) failures.push('programme/page.tsx TicketSection does not pass hideHeading');
for (const rel of ['app/(nos)/national-show/tickets/page.tsx', 'app/(nos)/national-show/workshops/page.tsx']) {
  if (tags(read(rel), 'TicketSection').some((t) => /\bhideHeading\b/.test(t))) failures.push(`${rel}: must keep its visible H2 (scope creep)`);
}

const sponsors = read('app/(marketing)/sponsors/page.tsx');
if (/eyebrow="Our sponsors"/.test(sponsors)) failures.push('sponsors/page.tsx still passes eyebrow="Our sponsors"');
if (!/heading="Sponsors"/.test(sponsors)) failures.push('sponsors/page.tsx lost heading="Sponsors"');
const at = sponsors.indexOf('Become a sponsor</h2>');
const ctaSection = at < 0 ? '' : sponsors.slice(sponsors.lastIndexOf('<section', at), sponsors.indexOf('</section>', at));
if (!ctaSection) failures.push('could not find the Become a sponsor card');
else {
  const p = tags(ctaSection, 'p')[0] ?? '';
  const wrap = tags(ctaSection, 'div')[0] ?? '';
  if (!/\btext-left\b/.test(p)) failures.push('Become a sponsor body <p> is not text-left');
  if (/\bmx-auto\b/.test(p)) failures.push('Become a sponsor body <p> still has mx-auto (centres the block)');
  if (!/\bitems-start\b/.test(wrap) || /\bitems-center\b/.test(wrap)) failures.push('Become a sponsor body wrapper is not items-start');
  const h2 = tags(ctaSection, 'h2')[0] ?? '';
  if (!/\btext-center\b/.test(h2)) failures.push('Become a sponsor heading must stay centred (text-center on the h2)');
}
finish('f4-removals-static', failures);
