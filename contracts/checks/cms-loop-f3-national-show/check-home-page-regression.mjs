#!/usr/bin/env node
// cms-loop-f3-national-show A2: regression assertion (mandatory per dispatch brief)
// — F3 touches components/show/ShowCountdown.tsx to accept a countdownDate prop,
// the same shared field (nationalShow.countdownDate) that components/home/ShowBand.tsx
// on the HOME PAGE already consumes correctly today (confirmed live 2026-08-05: the
// home page's raw HTML embeds the literal stored ISO string, e.g.
// "2027-09-18T09:00:00+02:00", in its RSC flight payload). This check proves F3's
// edits to the shared component/field did not collateral-damage that pre-existing,
// working path.
//
// Read-only, non-mutating, safe to run at any time (including right now, pre-fix,
// pre-implementation) — asserts against WHATEVER the current live countdownDate value
// is, not a hardcoded one, so it stays valid across this check's own A1/A3 mutate-
// and-restore cycles and after @dev's implementation lands.
//
// NOTE on what this proves and does not: this reads the raw HTML response
// (`cache: 'no-store'` on our own request), which contains the value as serialized
// Server Component prop data for the client to hydrate from — ShowCountdown.tsx's own
// comment explains the server always renders a frozen 00:00:00:00 placeholder and
// only the client ticks the real countdown after hydration, so a plain HTTP fetch can
// never observe the rendered digits themselves. This check is honest about that
// distinction: it proves the correct value REACHED the home page's response for the
// client to use, not that the visible digits were eyeballed in a browser.
//
// Exit codes: 0 = current countdownDate value is present verbatim in both the
// dataset and the home page's HTML. 1 = missing from either, or host unreachable —
// never a skip.

import { getSanityClient, fetchPublicPageContains, HOME_PAGE_PATH, TARGET_DOC_ID } from './_shared.mjs';

const client = getSanityClient();

let current;
try {
  current = await client.fetch(`*[_id == $id][0].countdownDate`, { id: TARGET_DOC_ID });
} catch (err) {
  console.error(`FAIL: dataset read for ${TARGET_DOC_ID}.countdownDate threw — ${err.message}`);
  process.exit(1);
}

if (!current) {
  console.error(`FAIL: ${TARGET_DOC_ID}.countdownDate is empty in the dataset — cannot verify the home page reflects it.`);
  process.exit(1);
}
console.log(`Current countdownDate in dataset: ${current}`);

const home = await fetchPublicPageContains(current, HOME_PAGE_PATH);
console.log(`Home page (${HOME_PAGE_PATH}) status: ${home.status}, contains value: ${home.hasNeedle}`);

if (home.status === 200 && home.hasNeedle) {
  console.log('PASS: the home page (ShowBand) still correctly reflects nationalShow.countdownDate.');
  process.exit(0);
}
console.error(
  'FAIL: the home page no longer embeds the current countdownDate value — this is a regression against a ' +
    'previously-working path (ShowBand.tsx), most likely caused by an unrelated edit to the shared ' +
    'ShowCountdown/countdownDate contract while wiring /national-show.'
);
process.exit(1);
