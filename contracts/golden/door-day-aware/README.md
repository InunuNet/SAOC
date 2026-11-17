# Day-aware door admission — implementation contract

Status: specification only. Tests deliberately target the future implementation and fail on
this branch until dev implements it. Do not weaken them to accept today's single-use service.
No production implementation is delivered by this contract. Canonical contract:
`contracts/door-day-aware.yaml`. No network, credentials, emulator, browser or running server
is needed for its assertions. Run from repository root; no `cd`. Same commands and artefacts
apply to Claude Code, Gemini CLI and OpenCode.

## Decision and evidence

Use exact persisted `ticketType` values `weekend-pass` and `weekend-pass-early-bird` for
multi-day entitlement. Verified in `lib/provisional-figures.ts`, `lib/admission-siblings.ts`,
`lib/checkout-reservation.ts`, `lib/orders.ts`, `types/index.ts`. These are trusted catalogue
slugs stored by issuance, not display labels. No additional entitlement marker or migration
is necessary. A missing, unknown, display-name or retired `early-bird-weekend-pass` slug
remains single-use. Do not infer entitlement from price, amount zero, order quantity, VIP,
name substrings, or a caller-supplied flag. VIP remains single-use; its entitlement is an
open owner question, not part of this implementation.

`requiresDaySelection` is NOT stored on Ticket or Order today. Checkout reads it from
Sanity, validates chosenDay, and the multi-position builder persists chosenDay; single and
comp builders may omit it. Resolve the flag from the existing
`ticketTypeScheduleTraitsQuery` (includes inactive products), keyed by the stored slug.
Use literal `true`; ignore extra request-body fields. Existing `day-visitor` and `early-bird`
remain required-day products even if their catalogue document has been retired or its flag
is absent; include these two in the resolved set. Also include ANY catalogue slug with
`requiresDaySelection === true`, including future products. A catalogue fetch failure must
NOT become an empty successful set: retain the error for the service's infra-error path.
Unknown legacy slugs absent from a successfully loaded catalogue remain single-use.
No new creation field is needed with this lookup strategy; do not modify creation or payment
writes. PR #69 provenance on every order and ticket must remain untouched.

Tradeoff: live catalogue traits avoid duplicate issuance metadata and legacy backfills, but
add a read/availability dependency and mean an owner's flag edit affects existing tickets.
Fetch once outside the retrying Firestore transaction, include inactive products, and use
one immutable context for all retries. A future immutable entitlement snapshot is a separate
migration, not an excuse to let legacy required-day tickets through here.

## Service boundaries and injected clock

Add `lib/checkin-day-policy.ts` exporting synchronous pure
`decideDayAdmission({ ticket, now, window, requiresDaySelection })`. `now` is an explicit
Date; `window` is `{ startDate: Date, endDate: Date } | null`. Ticket includes ticketType,
status, chosenDay, checkIns and checkedInAt; pure checkedInAt is a Date or null (invalid Date
is permitted as corrupt legacy input). Map values are opaque existing timestamps; the pure
policy never mutates them. Return exactly the shape used by truth-table.json:

- Allow: `{ ok: true, day: 'YYYY-MM-DD', firstAdmission: boolean }`.
- Refuse: `{ ok: false, code, httpStatus, error }`.

This policy begins at not_show_day, AFTER the existing test-ticket guard. It also implements
wrong_day, duplicate and unpaid decisions. No Date.now(), no zero-argument new Date(), no
I/O in the policy. Use fixed UTC+2 for now's date. Reuse computeShowDays from
`lib/show-window-lookup.ts`; validate finite dates and reject reversed instants BEFORE
calling it. Membership is calendar-day membership, not opening-hour enforcement. Thus a
09:00 opening does not deny a 00:00 scan on that SAST date. Invalid/missing window denies
not_show_day. Window source uses the existing fetchActiveShowWindow/buildShowWindow path.
Do not hard-code fixture dates into production.

Add `lib/checkin-context.ts` exporting `getCheckinContext(now: Date)` returning
`{ window, daySelectionTypes: string[] }`. Use existing resolveShowWindowLookup with
NATIONAL_SHOW_ID and injected now (TTL-bound cache), plus ticketTypeScheduleTraitsQuery
through the existing Sanity client. A missing client/catalogue fetch error throws; a valid
empty catalogue still includes day-visitor/early-bird. Show source failure already maps to
null via existing helpers and therefore not_show_day. Do not confuse Sanity `_id` with
Firestore NATIONAL_SHOW_ID. Do not use a stale indefinite cache.

Extend `checkInByBookingRef(bookingRef, deps?)`, where deps has
`now?: () => Date` and `getContext?: (now: Date) => Promise<Context>`. Production defaults
use a real clock and getCheckinContext. Validate reference first, sample clock ONCE, then
prepare context once outside the transaction. Catch a context error into local state;
throw it only AFTER not-found, wrong-show and the PR #69 guard have had their decisions.
This preserves precedence even during catalogue outages. The route calls this real service;
never implement admission in the route. Convert Firestore checkedInAt to Date for the pure
policy; keep original Timestamp for storage/response. Admission timestamps use
Timestamp.fromDate(the sampled now), never an independent Timestamp.now().

## Exact decision order and responses

| Priority | Condition | HTTP | code / audit outcome | Exact error copy |
| --- | --- | --- | --- | --- |
| 1 | No/invalid session | 401 | not-authorized | Unauthorized |
| 1 | Other auth refusal | 403 | not-authorized | Forbidden |
| 2 | JSON cannot parse | 400 | bad-request / malformed | Invalid request body. |
| 2 | Missing, non-string, blank reference | 400 | bad-request / malformed | A booking reference is required. |
| 3 | Transaction read, no ticket | 404 | not-found | Ticket not found |
| 4 | Different show | 403 | wrong-show | This ticket is not for this show. |
| 5 | PR #69 guard refuses | 403 | test_ticket | Test ticket — not valid for entry |
| 6 | Today absent from valid show days | 403 | not_show_day | The show is not open today. |
| 7 | Required chosenDay valid but not today | 403 | wrong_day | Valid on Friday 24 September 2027 (derive from stored date) |
| 7 | Required chosenDay absent/invalid | 403 | wrong_day | This ticket has no valid selected day. Please contact the ticket desk. |
| 8 | Already used for relevant scope | 409 | already-checked-in | Already checked in |
| 9 | Unpaid | 403 | unpaid | This ticket has not been paid for. |
| 10 | Admission | 200 | admit | No error |
| exceptional | Database/catalogue infrastructure error | 500 | infra-error | Check-in failed. Please try again. |

Every refusal has `{ success: false, code, error }`; authenticated result codes map through
the existing exhaustive audit mapping, including the two new codes. Preserve existing
HTTP/copy and PR #69 guard function/order. Add explicit codes to malformed/auth/infra paths
that currently omit them. Auth must precede body parsing and all ticket/context access.

User requirement expands current auth behavior: currently auth returns before any audit.
Write one `not-authorized` attempt through the existing audit mechanism, with null UID,
bookingRef, showId, orderId (do not parse untrusted body to enrich it). Audit-only database
access after auth refusal is allowed; ticket reads/admission writes are forbidden. All
other attempts also append exactly once OUTSIDE the transaction, not once per retry. On
an audit-store outage, exactly one append is attempted and logged through the existing
failure logger; the refusal still returns. Durable delivery during an outage is not
promised by the existing best-effort mechanism. Never retry admission to repair auditing.

The existing DoorResultBanner error branch renders all refusals; no visual redesign.
Duplicate retains its amber Already used branch, other errors retain Not checked in.

## Day and status truth table

`truth-table.json` is the executable 231-row table, not illustrative sample data. It crosses
nine product categories, first/last/outside days, two SAST midnight boundaries and three
history states, with additional malformed, unpaid and legacy-history cases.

| Product | Today outside show | Required day differs/missing | No relevant prior scan | Relevant prior scan |
| --- | --- | --- | --- | --- |
| day-visitor / early-bird / future flagged product | not_show_day | wrong_day | admit once if paid | already-checked-in (after date check) |
| either Weekend Pass | not_show_day | ignored unless catalogue requires selection | admit if paid or previously checked-in on other day | already-checked-in today |
| VIP / other / missing identity / retired slug | not_show_day | ignored unless catalogue requires selection | admit once if paid | already-checked-in forever |

Required-day check applies before multi-day handling even if contradictory catalogue data
marks a pass as requiring selection. Valid chosenDay must be a strict real Gregorian
YYYY-MM-DD (reject rollovers such as February 30, non-strings and datetime strings). Derive
weekday/month/year only from stored chosenDay using deterministic English formatting and
UTC for the date-only parse. A valid date outside the window still gets its own valid-day
copy when today is a show day. Invalid input must not be interpolated into the banner.

A pass has a duplicate when checkIns has an OWN key for today, even if that value is null.
For all other types, status checked-in is a lifetime duplicate. For a pass, status paid or
checked-in is eligible after duplicate check; reserved/cancelled/refunded/unknown are unpaid.
No amount or order status bypass. Duplicate deliberately wins over unpaid, per coordinator.

For legacy passes without a usable map, derive the already-used date from a valid first
checkedInAt. It blocks that date and permits later show dates. On next success seed that
historical date into the map as well as today. Also honour checkedInAt when a partial map
omits its date. A checked-in pass with no valid first timestamp refuses already-checked-in, even if
a partial daily map exists (conservative single-use fallback; do not fabricate the unknown first admission). No guessing a date,
no backfill on refusal. A paid pass with no history admits. Malformed non-object/array maps
are unusable; use valid first timestamp or fail closed when already checked-in.

SAST boundaries in fixture: 2027-09-22 21:59Z is outside, 22:00Z is first show day;
2027-09-23 21:59Z is September 23, 22:00Z is September 24; September 26 21:59Z is last
show day, 22:00Z is outside. The test window ends September 26 at 13:00Z on purpose.
The example in docs/f5-day-selection-attendees.md ending at 23:59:59Z incorrectly claims
September 26 as its last SAST date; code computes September 27. Follow the helper, not that
prose example. No reinterpretation of UTC as SAST.

## Writes, races and compatibility

Use a `checkIns: Record<string, Timestamp>` map ON the ticket document. Bounded by the
show's calendar days; simplest fit for the existing one-document transaction. A subcollection
would add read/write paths and complicate deduplication without benefit at this scale.
Write the merged map atomically in the same transaction as status and checkedInAt. Preserve
all existing day entries exactly. Retried transaction reads fresh history, so concurrent same-day
scans commit at most once. One transaction update per admission, zero on every refusal.
No undefined values in new map entries/patches; omit optional properties or use null.

Keep status checked-in after first admission, and checkedInAt as the FIRST admission
Timestamp forever. On subsequent pass admission preserve it, never overwrite it with today.
Return these same semantics in the ticket response, plus top-level `firstAdmission: boolean`.
First-ever admission is true, later per-day admissions false. No payment status reset at
midnight and no daily status reset job. Expose optional checkIns on Ticket without breaking
existing Ticket literals; preserve chosenDay in the check-in DTO.

`lib/admin-dashboard.ts:fetchCheckedInCount` counts unique tickets with status checked-in.
`DoorScannerClient.applyResult` currently increments on every success; change it to increment
only when firstAdmission is true. Preserve its null-counter behavior. Existing admin status
and CSV remain one checked-in ticket/row, not one row per day. CSV currently has six columns
and NO checkedInAt column; retain schema. Any timestamp reader continues to see first entry.
Daily attendance can later use checkIns/audits; do not relabel today's unique-ticket counter.

## Verification and risks

The node tests transpile REAL TypeScript into a VM with an explicit dependency allowlist,
modelled on PR #69. Only infrastructure, time/context input and auth are injected. Policy,
service, route, guard, audit builder and rendered banner remain real. Ambient clock access
throws in policy/service. Test requests deliberately forge date/flag/history inputs to prove
that stored data and server dependencies win. Retry/sequential tests are deterministic fake
Firestore evidence, not a claim to prove Firestore isolation in production.

PR #69's standalone original route tests lack a show clock and will become date-dependent;
this contract ports its complete provenance matrix and builders into the new deterministic
harness. Keep its guard and issuance tests intact; when implementing, update the old harness
with the same injected show context/clock so it remains runnable. Do not disable old checks.
The contract runs original pure/builder tests separately as unchanged regression evidence.

Type-check and lint commands are offline, using installed pnpm/dependencies. No deploy,
network, browser, production code change or cross-model remote QA is authorised in this
architect task. Residual implementation risks: catalogue edits/outages; malformed legacy
history; scanner counter drift if the new response field is ignored; duplicate audit writes
inside retried transactions. Tests plus the exact rules above address these boundaries.
