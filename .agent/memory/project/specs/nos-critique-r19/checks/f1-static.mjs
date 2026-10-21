// nos-critique-r19 F1 static (QA input, hash-locked). Goldens: goldens/f1-edits.json, f1-footprint.json, f1-spec.md.
//   S1  app/(marketing)/tickets/cancelled/page.tsx equals BASE with exactly lines 15 and 50 changed: the title is "Payment cancelled" (R64
//       sentence case) and the centred 600px column becomes the nk-state context.
//   S2  app/(marketing)/national-show/nos-structure.css equals BASE plus one rule block after line 2016: .nos-theme .nk-state .nk-cta
//       { width: auto; grid-column: auto } (the .nk-checkout-total .nk-cta pattern, kept apart from r18's .nk-crumbs edit).
//   S3  app/(marketing)/tickets/confirmation/page.tsx keeps normalizeBookingRefParam (BASE 17-19) and the whole success render (BASE 48-127)
//       byte-identical, exports generateMetadata, decides not-found on the server through lib/ticket-status.ts, and renders the not-found
//       state as hero h1 "Booking not found" + the confirmationNotFoundMessage lede + the NOS button in an nk-state context.
//   S4  components/tickets/ConfirmationPoller.tsx no longer renders a not-found state: a 404 from /api/tickets/status calls router.refresh()
//       so the server renders it, AT MOST ONCE per mount (Codi FINAL pre-merge, the refresh-loop guard, goldens/f1-edits.json `poller`):
//       a refreshedOn404 flag declared beside `attempts` in the polling effect; the first 404 sets it, refreshes and keeps polling; a 404
//       with the flag set falls through to the existing timed-out state. router.refresh() is called exactly three times in the code (comments aside) (the
//       empty ref, the guarded 404, a confirmed status) and the 404 one only behind the flag.
//   S5  app/api/tickets/status/route.ts looks the status up through lib/ticket-status.ts and keeps its responses (404 "Not found.",
//       { status } only, 500).
//   S6  lib/ticket-status.ts exports getTicketStatus(ref), the one tickets-by-bookingRef lookup.
//   S7  NO INVENTION: no new prose literal in the F1 files that is not already in BASE.
//   S8  docs/nos-critique-r19.md has a "## F1" section.
import { DOC, finish, goldenJson, readBaseFile, readRepoFile } from './_lib.mjs';
import { exactEdits, newProse } from './_edits.mjs';

const NAME = 'f1-static.mjs';
const G = goldenJson('f1-edits.json');
const FP = goldenJson('f1-footprint.json');
const failures = [];
const need = (file, text, what, tag) => { if (!(text ?? '').match(what.re)) failures.push(`${file}: ${what.msg} (${tag})`); };

// S1, S2
failures.push(...exactEdits(G.cancelled.file, G.cancelled.lineEdits, G.cancelled.drops, 'S1'));
failures.push(...exactEdits(G.css.file, G.css.lineEdits, G.css.drops, 'S2'));

// S3
const C = G.confirmation;
const page = readRepoFile(C.file);
const basePage = (readBaseFile(C.file) ?? '').split('\n');
if (page === null) failures.push(`${C.file}: missing (S3)`);
else {
  for (const [a, b] of [C.keepBlock, C.keepSuccess]) {
    const block = basePage.slice(a - 1, b).join('\n');
    if (!page.includes(block)) failures.push(`${C.file}: BASE lines ${a}-${b} are not kept verbatim (S3)`);
  }
  need(C.file, page, { re: /export async function generateMetadata\(/, msg: 'no generateMetadata export' }, 'S3');
  need(C.file, page, { re: /import \{[^}]*\bgetTicketStatus\b[^}]*\} from '@\/lib\/ticket-status';/, msg: 'getTicketStatus is not imported from @/lib/ticket-status' }, 'S3');
  need(C.file, page, { re: /'Booking not found'|"Booking not found"/, msg: 'no "Booking not found" title' }, 'S3');
  need(C.file, page, { re: /confirmationNotFoundMessage/, msg: 'no confirmationNotFoundMessage lede' }, 'S3');
  need(C.file, page, { re: /className="nk-state"/, msg: 'no nk-state context' }, 'S3');
  need(C.file, page, { re: /className="nk-btn nk-cta[ "]/, msg: 'no nk-btn nk-cta "Back to tickets"' }, 'S3');
}

// S4
const POLLER = 'components/tickets/ConfirmationPoller.tsx';
const poller = readRepoFile(POLLER);
if (poller === null) failures.push(`${POLLER}: missing (S4)`);
else {
  for (const [re, msg] of [[/not-found/, "still has a 'not-found' state"], [/Booking not found/, 'still renders "Booking not found"'], [/confirmationNotFoundMessage/, 'still reads confirmationNotFoundMessage']]) if (re.test(poller)) failures.push(`${POLLER}: ${msg} (S4)`);
  const P = G.poller;
  need(POLLER, poller, { re: new RegExp(P.guardDeclRe), msg: 'no `let refreshedOn404 = false;` beside `let attempts = 0;` in the polling effect' }, 'S4');
  need(POLLER, poller, { re: new RegExp(P.guarded404Re), msg: 'the 404 branch is not the golden one-shot guard (flag set -> timed-out; else set flag, refresh once, keep polling)' }, 'S4');
  const code = poller.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const refreshes = (code.match(/router\.refresh\(\)/g) ?? []).length;
  if (refreshes !== P.refreshCalls) failures.push(`${POLLER}: router.refresh() is called ${refreshes} times, want ${P.refreshCalls} (empty ref, guarded 404, confirmed) (S4)`);
}

// S5
const ROUTE = 'app/api/tickets/status/route.ts';
const route = readRepoFile(ROUTE);
if (route === null) failures.push(`${ROUTE}: missing (S5)`);
else {
  need(ROUTE, route, { re: /import \{[^}]*\bgetTicketStatus\b[^}]*\} from '@\/lib\/ticket-status';/, msg: 'getTicketStatus is not imported from @/lib/ticket-status' }, 'S5');
  if (/collection\('tickets'\)/.test(route)) failures.push(`${ROUTE}: still queries the tickets collection itself (S5)`);
  need(ROUTE, route, { re: /NextResponse\.json\(\{ status \}\)/, msg: 'no status-only success response' }, 'S5');
  need(ROUTE, route, { re: /\{ error: 'Not found\.' \}, \{ status: 404 \}/, msg: 'no 404 "Not found." response' }, 'S5');
  need(ROUTE, route, { re: /status: 500/, msg: 'no 500 response' }, 'S5');
}

// S6
const LIB = 'lib/ticket-status.ts';
const lib = readRepoFile(LIB);
need(LIB, lib, { re: /export async function getTicketStatus\(/, msg: 'no exported async getTicketStatus' }, 'S6');
need(LIB, lib, { re: /collection\('tickets'\)\s*\.where\('bookingRef', '==', /, msg: "no tickets-by-bookingRef query" }, 'S6');

// S7
for (const f of FP) failures.push(...newProse(f, [...FP, POLLER], { allow: G.allowCopy ?? [] }));

// S8
if (!/^## F1\b/m.test(readRepoFile(DOC) ?? '')) failures.push(`${DOC}: no "## F1" section (S8)`);

finish(NAME, failures, 'F1 static: cancelled title and column fixed, the nk-state override, the not-found state decided and rendered on the server with its title, success render and normalizeBookingRefParam untouched, one status lookup, no new copy, docs F1.');
