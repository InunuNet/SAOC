# F4 - Events honesty (implementation spec for @dev)

Base: `origin/main`. Rule: docs/rules/no-invention.md. All 17 societyEvent docs other than
`societyEvent-15-19th-south-african-national-orchid-show` were seeded 2026-06-30 from `lib/data/events.ts`
(scaffold, no source) and are invented. Goldens: `invented-events.json` (ids, titles, slugs), `scope-allowlist.json`.

## 1. Code - delete the static events and every fallback onto it
- Delete `lib/data/events.ts`; remove `export * from './events'` from `lib/data/index.ts`. The `SocietyEvent` type in
  `types/index.ts` stays (EventRow and EventsStrip still use it).
- `app/(marketing)/events/page.tsx`: drop `getFallbackEvents`; `events = raw ?? []`.
- `app/(marketing)/societies/[slug]/page.tsx`: drop `getFallbackEventsForSociety` and the `staticEvents` import;
  `getSocietyEvents` returns the Sanity result only. `components/societies/SocietyEvents.tsx`: with no fallback the
  `live` prop and `FallbackEventRow` are dead - remove them (and the prop at the call site). Keep the existing
  "has no upcoming events listed yet" empty state untouched.
- `components/home/EventsStrip.tsx`: drop the `staticEvents` import and fallback. With zero events render the existing
  section header and the same empty state as the events page (below), not an empty rule line.
- `components/chrome/SearchOverlay.tsx`: this client component imported the static events (and so shipped them in the
  browser bundle). Remove the event results (types, memo branch, rendering); keep the "Events calendar" quick link and
  society results. A client component cannot read Sanity, so searching events is out of scope for F4.
- `app/api/events.ics/route.ts`: drop `getFallbackInputs`; an empty list yields a valid empty VCALENDAR.
- `app/api/events/[slug]/ics/route.ts`: drop the static slug match; unknown slug is 404.
- `scripts/seed-sanity.ts`: remove `mapEvents`, its `seedBatch('events', ...)` call and the `events` import, so a re-seed
  cannot recreate the invented docs.
- `public/llms-full.txt`: after the Sanity apply (section 3), run `pnpm refresh-llms` (uses the editor token in
  `.env.local`; never print it) and commit the regenerated file. The nightly workflow would fix it eventually; the
  committed file must not carry the invented list at merge. Known, out of scope: that file prints `[object Object]`
  under About - report it, do not fix it here.

## 2. Empty state - existing copy and marker only
Events page and home strip, when there are no events: render the existing sentence `No upcoming events scheduled.`
followed by `<ConfirmationBadge status="pending" />` (thin wrapper over `components/show/_shared/StatusMarker.tsx`,
kind `confirmation`; no label prop, so the hardcoded floor label "To be confirmed" shows and
`data-confirmation-badge="pending"` is emitted). No new prose, colour, token or component. With the National Show
present the page lists it through the existing EventCard / MonthGroup path.

## 3. Content - script `scripts/unpublish-invented-events.ts`
Run with `pnpm exec tsx scripts/unpublish-invented-events.ts --dry-run | --apply`. Neither flag: print usage, exit 2.
- Read `.env.local` directly (no dotenv - its banner has corrupted an env value here before, see
  scripts/seed-qa-fixture-ticket-type.ts). Token = `SANITY_API_TOKEN`, only required for `--apply`; never print it or
  any header. Project `NEXT_PUBLIC_SANITY_PROJECT_ID` (26yfbug4), dataset production.
- Fetch published societyEvent docs (`_id` not starting `drafts.`) with full body and `_rev`.
- Target set is the explicit seeded id list from `invented-events.json` (inline it as constants). A published
  societyEvent that is neither in that list nor the KEEP id is printed as `UNLISTED <id>` and the script exits 3
  without writing (it may be a real, newly added event). A missing KEEP doc also exits 3.
- Output contract (A4 asserts it), one per line:
  `MODE dry-run|apply`, `FOUND <n>`, `KEEP <id>`, `UNPUBLISH <id> rev=<_rev>` per target,
  `SUMMARY unpublish=<n> keep=1 backup=<path|none>`.
- `--apply` order: (1) write the full JSON of every target doc to
  `.tmp/sandbox/launch-weekend-f4-backup/<ISO timestamp>.json` and re-read it to verify count == target count, else
  exit 1 before any write; (2) per doc, one transaction: no-op `patch(id, { ifRevisionID: _rev })` lock +
  `createIfNotExists({ ...doc, _id: 'drafts.' + id })` + `delete(id)` - a stale revision fails that transaction and
  the script stops; (3) print `DONE unpublished=<n>`. Proves nothing fabricated: no field edits.
- Verify the stale-revision lock really aborts (try one doc with a wrong `ifRevisionID` against a dry transaction or
  Sanity's `dryRun` option) before trusting it; report the finding.
- Unpublished docs become drafts, so they stay recoverable in Studio and in the backup.

## 4. QA fixture ticketType - NOT unpublished (decision for the lead)
`ticketType-qa-fixture` (`qa-fixture-ticket`, demo:true, category `qa-fixture-only`) is the target of
contracts/checks/ticketing-hardening/_shared.mjs (`TARGET_TICKET_TYPE`) - the capacity/idempotency round trips fail
with FIXTURE MISSING without it - and scripts/seed-qa-fixture-ticket-type.ts recreates it. Public pages already
filter `demo` (filterPubliclyListableTicketTypes) and its category matches no page query. So F4 does not touch it;
check B asserts it is not listed on /national-show/tickets or /tickets. Unpublishing it is only right if Brad
accepts retiring the ticketing-hardening suite's live round trips.

## Out of scope / known follow-ups
- National Show event dates in Sanity (2027-09-23 today, show confirmed 23-26 Sept) are pending Brad; no check asserts a date.
- contracts/checks/cms-loop-f2-event-tags targets `societyEvent-10-midlands-orchid-show` and will stop working once
  it is unpublished; it only needs to exist for the CI inventory ratchet. Retire it in its own contract.
- /events kind/heading copy ("Upcoming society shows" on the home strip) now shows the National Show; heading is existing copy, left as is.
