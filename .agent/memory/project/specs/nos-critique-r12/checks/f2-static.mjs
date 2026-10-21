// nos-critique-r12 f2 static (QA input, hash-locked): the single-ticket heading level (sweep-221 axe heading-order, /tickets/vip h1 -> h3).
//   S1  components/tickets/keepsake/TicketCard.tsx takes `headingLevel?: 'h2' | 'h3'` defaulting to 'h3' (the VisitorInfoBlock idiom); the name keeps
//       data-ticket-name and className "nk-name"; at most 14 changed lines against BASE.
//   S2  app/(marketing)/tickets/[slug]/page.tsx: F2's only change is one added line `headingLevel="h2"` on the summary TicketCard; outside it the file
//       equals BASE except F3/F4's generateMetadata and F4's seo import (checks/_ticketpage.mjs, shared by f2-f4).
//   S3  launch-weekend F18-A28 check-s-cards-render.mts still passes in the worktree, so every card rendered without the prop keeps its h3 name.
//   S4  docs/nos-critique-r12.md records F2 and heading-order.
import { execFileSync } from 'node:child_process';

import { BASE, DOC, finish, git, readBaseFile, readRepoFile, repoRoot, stripComments } from './_lib.mjs';
import { TICKET_PAGE, ticketPageFailures } from './_ticketpage.mjs';

const NAME = 'f2-static.mjs';
const failures = [];
const CARD = 'components/tickets/keepsake/TicketCard.tsx';
const PAGE = TICKET_PAGE;
const MAX_CARD_LINES = 14;

function numstat(rel) {
  const line = git('diff', '--numstat', BASE, '--', rel).trim();
  if (!line) return { added: 0, deleted: 0 };
  const [added, deleted] = line.split('\t');
  return { added: Number(added), deleted: Number(deleted) };
}

// S1
const card = readRepoFile(CARD);
if (card === null) failures.push(`${CARD} is missing (S1)`);
else {
  const code = stripComments(card);
  if (!/headingLevel\?:\s*'h2'\s*\|\s*'h3';/.test(code)) failures.push(`${CARD}: TicketCardProps lacks \`headingLevel?: 'h2' | 'h3';\` (S1)`);
  if (!/headingLevel\s*=\s*'h3'/.test(code)) failures.push(`${CARD}: headingLevel must default to 'h3' (S1)`);
  if (!/data-ticket-name=""/.test(code) || !/className="nk-name"/.test(code)) failures.push(`${CARD}: the name must keep data-ticket-name="" and className="nk-name" (S1)`);
  if (/<h3 data-ticket-name/.test(code)) failures.push(`${CARD}: the name is still a literal h3 (S1)`);
  const { added, deleted } = numstat(CARD);
  if (added + deleted > MAX_CARD_LINES) failures.push(`${CARD}: ${added}+/${deleted}- lines against BASE, want at most ${MAX_CARD_LINES} (S1)`);
}

// S2
const page = readRepoFile(PAGE);
failures.push(...ticketPageFailures(page, readBaseFile(PAGE), 'S2'));
if (page !== null) {
  const code = stripComments(page);
  const at = code.indexOf('<TicketCard');
  const block = at < 0 ? '' : code.slice(at, code.indexOf('/>', at));
  if ((code.match(/headingLevel=/g) ?? []).length !== 1 || !block.includes('headingLevel="h2"')) failures.push(`${PAGE}: want exactly one headingLevel="h2", on the summary <TicketCard> (S2)`);
}

// S3
try {
  execFileSync('pnpm', ['exec', 'tsx', 'contracts/checks/launch-weekend/f18/check-s-cards-render.mts'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  failures.push(`launch-weekend F18-A28 check-s-cards-render failed: ${String(e.stderr || e.stdout || e.message).trim().split('\n').slice(0, 4).join(' | ')} (S3)`);
}

// S4
const doc = readRepoFile(DOC);
if (doc === null || !/\bF2\b/.test(doc) || !doc.includes('heading-order')) failures.push(`${DOC} must record F2 and heading-order (S4)`);

finish(NAME, failures, 'TicketCard takes headingLevel (default h3), the single-ticket page passes h2 in one line, F18-A28 cards render green, docs record F2.');
