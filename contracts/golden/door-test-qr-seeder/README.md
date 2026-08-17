# Golden — door test-ticket QR seeder (F6 unblock)

## Why this exists

`/admin/door` (camera, page render, admin auth) is proven working. What is NOT proven
is the check-in decision table (`lib/checkin.ts`, golden:
`contracts/golden/ticketing-hardening/checkin-admission-rules.golden.md`) end to end
through a real scan, because there are no scannable QR codes for any of its five
outcomes. This tool seeds real Firestore fixtures covering four of those outcomes
(a fifth, `bad-request`, cannot be represented as a scannable QR — an empty/whitespace
string is not something a QR encoder can usefully render as "the missing case"; it is
already covered by `lib/checkin.ts`'s own guard and is out of scope here) and renders
them as an offline, printable HTML sheet.

**PayFast is not involved.** Fixtures are written directly via the Admin SDK, exactly
like `contracts/checks/ticketing-hardening/_shared.mjs`'s `createTicketDoc()` does.
`app/api/tickets/itn/route.ts` is not touched.

## Deliverables (production code — @dev writes these, NOT architect)

| File | Purpose |
|---|---|
| `scripts/seed-door-test-tickets.ts` | `pnpm exec tsx scripts/seed-door-test-tickets.ts seed \| teardown` |
| `scripts/output/door-test-qr/sheet.html` | generated, gitignored — the printable/scannable sheet |
| `scripts/output/door-test-qr/manifest.json` | generated, gitignored — machine-readable mirror of `fixtures.golden.json`'s `scans[0].expect` per fixture, for the check scripts to assert against |
| `package.json` scripts `door:seed`, `door:teardown` | thin wrappers around the two subcommands |
| `scripts/scan-firestore-residue.ts` | one additive, narrowly-scoped change — see below |
| `.gitignore` | add `scripts/output/` |

New devDependencies (script-only, never imported by client or server app code, so the
"no invented brand assets / minimal scope" and coding-standard rules about client
bundles do not apply): `qrcode`, `@types/qrcode` (QR PNG encoding), `jsqr`, `pngjs`,
`@types/pngjs` (QR decode, used only by check A7 to prove the sheet encodes the exact
booking-ref string, not a wrapped/JSON payload).

## Fixture table

Exact shapes: `contracts/golden/door-test-qr-seeder/fixtures.golden.json`. Summary:

| bookingRef | Firestore doc? | showId | status | 1st scan | 2nd scan |
|---|---|---|---|---|---|
| `DOOR-QR-ADMIT-01` | yes | `nationalShow` | `paid` | 200 admit → `checked-in` | 409 `already-checked-in` |
| `DOOR-QR-UNPAID-01` | yes | `nationalShow` | `reserved` | 403 `unpaid` | (not re-scanned) |
| `DOOR-QR-WRONGSHOW-01` | yes | `door-qr-check-wrong-show` | `paid` | 403 `wrong-show` | (not re-scanned) |
| `DOOR-QR-MISSING-01` | **no** | — | — | 404 `not-found` | (not re-scanned) |

One ticket (`ADMIT`) is deliberately reused for both the admit outcome AND the
anti-passback (`already-checked-in`) outcome — scanning its QR twice proves both rows
of the decision table with one printed code, per the task brief.

`seed` is idempotent: look up each `bookingRef`, and if the doc exists, overwrite its
fields back to the exact shape in `fixtures.golden.json` (this is what resets `ADMIT`
from `checked-in` back to `paid` for a repeat test); if it does not exist, create it.
`teardown` deletes ONLY docs matching these three exact `bookingRef` values (a targeted
`where('bookingRef','in',[...])` query, not a marker-domain sweep) — the hard constraint
below explains why the sweep pattern the ticketing-hardening suite uses is deliberately
NOT reused here.

## Marker scheme

- `attendeeEmail`: `fixture@door-qr-check.invalid` (RFC 2606 `.invalid`, unreachable by
  construction — same convention as `SENTINEL_EMAIL_DOMAIN` in
  `contracts/checks/ticketing-hardening/_shared.mjs`).
- `attendeeName`: `Door QR Fixture`.
- `bookingRef` prefix: `DOOR-QR-` — visually distinct at a glance from a real
  `SAOC-2027-XXXXXXXXXXXX` ref, so nobody at a door confuses a test code with a real
  attendee's.
- `showId` (WRONGSHOW only): `door-qr-check-wrong-show` — obviously not
  `NATIONAL_SHOW_ID` and obviously not a real show id either.

## Why teardown does NOT reuse `sweepSentinels()` / a domain-wide sweep

`contracts/checks/ticketing-hardening/_shared.mjs`'s `sweepSentinels()` deletes every
doc whose `attendeeEmail` ends `@harden-check.invalid` — correct for that suite because
its fixtures are transient (created and destroyed within one process's lifetime,
`finally`-guaranteed). This tool's fixtures are the opposite: they are meant to
**outlive the seeding process** across however many scans Brad performs, so nothing
should ever auto-sweep them. Teardown here is therefore an explicit, human-invoked
command that deletes an exact, closed set of three known `bookingRef` values — not a
"delete anything matching this marker" sweep. This also means a second, unrelated
concurrent process (e.g. a `ticketing-hardening` gate run, or `d6-door-checkin`'s own
suite) can run at the same time without racing this tool's fixtures, and vice versa.

## Required change to `scripts/scan-firestore-residue.ts`

**Problem:** the scanner's `MARKER_PATTERNS` / `KNOWN_RESIDUE_*` model has exactly one
classification today — "matched a marker ⇒ alarm, non-zero exit." That is correct for
accidental leftovers (the 22-doc P1 leak this scanner exists to catch) but wrong for
*this* tool's fixtures while they are deliberately, temporarily live between `seed` and
`teardown`. A scan run mid-test must not report them as a leak.

**Required design — additive only, do not touch `MARKER_PATTERNS`, `KNOWN_RESIDUE_BOOKING_REFS`,
`KNOWN_RESIDUE_DOC_IDS`, or the exit-code logic for anything already matched by those:**

1. Add a new literal set, alongside the existing `KNOWN_RESIDUE_*` consts:

   ```ts
   // Deliberately-live fixtures written by scripts/seed-door-test-tickets.ts (F6 door-
   // scanner QR seeder). Unlike KNOWN_RESIDUE_*, these are NOT accidental leftovers —
   // they persist on purpose until `pnpm door:teardown` runs, so finding them mid-test
   // is correct, not a leak. Reported as INFO, never counted toward the exit code.
   // Exact match only (not a prefix/regex) so a mistyped future 'DOOR-QR-*' value from
   // an unrelated bug is still caught as a real alarm. Keep in sync by hand with
   // contracts/golden/door-test-qr-seeder/fixtures.golden.json — do not derive
   // programmatically from it (this file must have zero import-time dependency on
   // application code, per its own file-header "read-only scanner" contract).
   const EXPECTED_LIVE_DOOR_QR_FIXTURES: ReadonlySet<string> = new Set([
     'DOOR-QR-ADMIT-01',
     'DOOR-QR-UNPAID-01',
     'DOOR-QR-WRONGSHOW-01',
     'fixture@door-qr-check.invalid',
     'Door QR Fixture',
     'door-qr-check-wrong-show',
   ]);
   ```

2. `Hit` gets one new field: `readonly expected: boolean`.

3. `matchesAnyPattern` gains one more OR clause:
   `|| EXPECTED_LIVE_DOOR_QR_FIXTURES.has(value)` (this is what makes these values
   detectable at all — required by the task's "registered so the scanner can see them").

4. Wherever `walk()` pushes a `Hit` today (both the `string` and `number` branches),
   compute `expected: EXPECTED_LIVE_DOOR_QR_FIXTURES.has(<the tested string>)` and carry
   it onto the pushed hit.

5. `report()`: split `allHits` into `alarmHits = allHits.filter(h => !h.expected)` and
   `infoHits = allHits.filter(h => h.expected)`. Print `infoHits` first, each line
   prefixed `INFO (expected live door-test fixture, not residue): ` followed by the
   existing `formatHitLine()` format. Print `alarmHits` exactly as all hits are printed
   today. **The exit code and the "FAIL: found N residue hit(s)" / "ALL CLEAR" message
   are computed from `alarmHits.length` only** — `infoHits` never affects the exit code.
   When `alarmHits.length === 0` but `infoHits.length > 0`, the summary line must still
   say `ALL CLEAR` (so a normal accidental-residue check of the gate is unaffected) and
   may additionally note the informational count, e.g. `ALL CLEAR — scanned N
   document(s), no residue found (M expected live test fixture leaf/leaves ignored).`

This is a narrow, additive change: nothing about the existing five marker families or
the two `KNOWN_RESIDUE_*` allowlists changes behaviour. `contracts/checks/firestore-
residue-guard/*` (the sibling contract's own checks) do not inspect `MARKER_PATTERNS`'
internals or hit count assumptions beyond their own fixtures (verified — none of that
suite's three check scripts reference `MARKER_PATTERNS`, `Hit`, or an exit-code
assumption that would be broken by an additive OR-clause and an additive `expected`
field), so this is safe to make without touching that mission's files.

## QR sheet format — and why

**Chosen: one self-contained HTML file, four inline base64 PNG `<img>` QR codes, one
per fixture, laid out as a print-friendly grid.** Reasons:

- **No network round trip to view or print.** A `data:image/png;base64,...` `<img>` src
  needs no server; opening the file in any browser (the desktop Brad is testing from)
  renders it immediately, and `Cmd/Ctrl+P` produces a physical sheet with no extra step.
- **One page, all four codes, each labelled with its expected outcome AND exact
  expected message** — exactly what the task brief asks for, and what makes the sheet
  self-explanatory at a device with nobody else around to narrate it.
- Terminal QR (ASCII-art) was considered and rejected: illegible at typical terminal
  font sizes for a phone camera at arm's length, and useless for printing.
- Individual PNG files were considered and rejected: more files to keep track of
  during teardown, no labelling, and worse for "one page, side by side" than a single
  HTML sheet.

### Required HTML structure (exact enough that a grep-based check can verify it — do
not restructure without updating the assertions below)

For each of the 4 fixtures in `fixtures.golden.json`, in the same order as that file,
render one `<section>` (or `<article>`/`<div>` — tag choice is free) containing, as
plain visible text (not only in `alt=`/`title=` attributes — the checks assert against
rendered text content):

1. The fixture's `label` (`ADMIT`, `UNPAID`, `WRONGSHOW`, `MISSING`).
2. The exact `bookingRef` string, e.g. `DOOR-QR-ADMIT-01`.
3. An `<img>` whose `src` is a `data:image/png;base64,...` URI encoding a QR of **the
   bookingRef string alone** — no JSON wrapper, no trimming/casing change (matches
   `app/admin/door/page.tsx:80`'s `decodedText` passed directly as `bookingRef`).
4. The first scan's exact expected outcome: `expect.code` (or `"admit"` for the one
   `ok: true` case) and `expect.httpStatus`.
5. The first scan's exact expected `expect.error` string verbatim (for the `ok: true`
   case, print the three success fields instead:
   `Door QR Fixture` / `exhibitor` / the bookingRef — see
   `components/admin/DoorResultBanner.tsx`'s success rendering, which this text should
   describe so Brad recognises a correct screen).
6. For `ADMIT` only, also render its `scans[1]` (the second-scan / anti-passback) block
   with the same five fields, clearly marked as "scan again for this outcome".

### `manifest.json` (machine-readable, generated alongside the HTML)

A JSON array, one entry per fixture, each with at minimum:
`{ "label": string, "bookingRef": string, "scans": [ { "ordinal": number, "expect": {...} } ] }`
— structurally identical to `fixtures.golden.json`'s `fixtures[].scans` — so a check
can assert the generated manifest matches the golden table exactly (`JSON.stringify`
deep-equal on the `label`/`bookingRef`/`scans[].expect` fields) without re-deriving the
table from HTML text.

## Hard constraints (repeated from the task brief — do not relax any of these)

- Never delete a Firestore document this tool did not itself create. Teardown matches
  an exact, closed `bookingRef` set — never a prefix scan, never a marker-domain sweep,
  never `.get()` + filter across the whole `tickets` collection followed by delete.
- Never touch `SAOC-2027-ZNYT37Z88MSH` or any of the `KNOWN_RESIDUE_*` literals in
  `scripts/scan-firestore-residue.ts` — this tool's fixtures are a disjoint set.
- Never touch `app/api/tickets/itn/route.ts` (sha256-pinned).
- `scripts/seed-door-test-tickets.ts` must refuse to run (throw, non-zero exit) if
  `attendeeEmail`/`attendeeName` fields it is about to write do not match the marker
  exactly — mirrors `createTicketDoc()`'s own `isSentinelEmail` guard in
  `contracts/checks/ticketing-hardening/_shared.mjs`, so a future edit cannot silently
  drop the marker and write an unmarked-looking fixture.

## Assertion design notes (for the check scripts @dev writes under `contracts/checks/door-test-qr-seeder/`)

- All behavioural checks call `checkInByBookingRef` from `lib/checkin.ts` **directly**
  (same pattern as `contracts/checks/d6-door-checkin/check-admin-succeeds.mjs`) — no
  Next.js dev server needed for A2–A4. A5/A6 (the residue scanner) run
  `scripts/scan-firestore-residue.ts` as a child process/import, also serverless.
- Every check needing Firestore reuses the `.env.local` credential pattern from
  `contracts/checks/ticketing-hardening/_shared.mjs`'s `admin()`/`db()` (or the
  `readEnvLocal()` parser in `scripts/scan-firestore-residue.ts` — either is
  acceptable, do not introduce a third parsing implementation).
- A4 (teardown scoping) must prove a NEGATIVE: create one control doc with its own
  distinct, one-off marker (e.g. `attendeeEmail:
  'control@door-qr-check-teardown-control.invalid'`, clearly NOT one of the three
  fixture bookingRefs or the fixture email), run teardown, assert the fixture docs are
  gone AND the control doc still exists, then delete the control doc itself in the
  check's own `finally`.
- A6 (residue scanner still alarms on unrelated markers) must NOT touch live Firestore
  — reuse `contracts/golden/firestore-residue-guard/fixture-dirty-nested.json` in
  `--fixture` mode, read-only, from the sibling contract's own goldens.
- A7's QR-decode check needs only `jsqr` + `pngjs`, both pure-JS/no native deps —
  decode the base64 PNG for `DOOR-QR-ADMIT-01`'s `<img>` back to bytes and assert the
  decoded QR payload equals the string `DOOR-QR-ADMIT-01` exactly (no leading/trailing
  whitespace, no JSON wrapper). One fixture is a representative sample of the single
  shared encode path (`qrcode.toDataURL(bookingRef, ...)`); decoding all four would not
  test anything the first one doesn't already prove about the encoding pipeline.
- Set explicit `timeout_seconds` on every assertion in the contract — `execution/
  contract.py`'s 60s default is a known live bug (do not rely on it).
