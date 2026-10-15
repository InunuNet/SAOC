// F2 / A1 — no NOS surface links to the bare SAOC /tickets listing.
// Brad 2026-10-15: NOS "Book tickets" goes to the existing /tickets/[slug] flow. Every NOS
// link that pointed at /tickets (hero, /national-show/tickets admission card, what-to-expect)
// must now go to /national-show/tickets or /tickets/<slug>. Catches JSX href="/tickets",
// href={'/tickets'}, href={`/tickets`}, config `href: '/tickets'`, and the /tickets/, /tickets?x
// and /tickets#x spellings of the same listing.
// One exception (D4): the base "Get visitor tickets" button on /national-show/tickets, when it
// renders only for an empty admission-product list (emptyListFallbackSpan). Anywhere else,
// including an unconditional copy of that same button, still fails.
import {
  NOS_TICKETS_PAGE_FILE,
  emptyListFallbackSpan,
  fail,
  lineOf,
  pass,
  readRepoFile,
  stripComments,
  walk,
} from './f2-_lib.mjs';

const ID = 'f2-no-bare-tickets-listing';
const SCAN_DIRS = ['app/(marketing)/national-show', 'components/show', 'components/nos'];
const BARE = /href\s*[=:]\s*\{?\s*(["'`])\/tickets\/?(?:[?#][^"'`]*)?\1/g;

const problems = [];
let scanned = 0;
for (const dir of SCAN_DIRS) {
  for (const rel of walk(dir, /\.(tsx|ts)$/)) {
    const src = stripComments(readRepoFile(rel));
    scanned += 1;
    const allowed = rel === NOS_TICKETS_PAGE_FILE ? emptyListFallbackSpan(src) : null;
    for (const m of src.matchAll(BARE)) {
      if (allowed && m.index >= allowed[0] && m.index < allowed[1]) continue;
      problems.push(`${rel}:${lineOf(src, m.index)} links the bare listing: ${m[0]}`);
    }
  }
}
if (scanned === 0) problems.push(`no .ts/.tsx files found under ${SCAN_DIRS.join(', ')}`);
if (problems.length) fail(ID, problems);
pass(ID, `${scanned} files scanned`);
