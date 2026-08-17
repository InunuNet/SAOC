# F1 (ticketing-foundation): show collision — decision record

## The sizing question, answered with evidence

Live dataset read (2026-08-17, read-only, `SANITY_API_READ_TOKEN`):

```
show docs (published): 6
  show-14-2012  status=past      year=2012
  show-15-2015  status=past      year=2015
  show-16-2018  status=past      year=2018
  show-17-2021  status=past      year=2021
  show-18-2024  status=past      year=2024
  show-19-2027  status=upcoming  year=2027

nationalShow singleton (_type: "nationalShow", _id: "nationalShow"): 1 doc
  edition=19  salesOpen=true

ticketType docs: 5 (ticketType-adult, ticketType-child, ticketType-exhibitor,
  ticketType-pensioner, ticketType-saoc-member) — none currently reference a show.

Firestore `tickets` collection: 15 documents total. showId values in use: 14 docs carry
  'nationalShow' (real/fixture bookings), 1 doc (76TA7iyOn8o0FCeNlNIr) carries
  'door-qr-check-wrong-show' (a deliberate negative-control fixture from door-checkin
  QA — not a nationalShow booking; do not fold it into the 'nationalShow' count).
```

**Decision: Option A (recommended in the brief) — extend the existing `show` archive
type.** 6 published docs, all optional-or-defaulted new fields, zero invalidation risk.
This part of the brief's sizing call is confirmed correct by the evidence.

## The brief's plan is wrong about *which* document becomes "the first show" — corrected here

The brief assumed `nationalShow` (the singleton `_id`) already *was* a `show`-typed
Sanity document, and that F1 just needed to teach `NATIONAL_SHOW_ID` to resolve
dynamically with `'nationalShow'` as a seeded default. **That assumption is false.**
`nationalShow` is a wholly separate, heavily-used Sanity **schema type** (a singleton
document, `_type: "nationalShow"`, `_id: "nationalShow"`) that already carries `edition`,
`venue` (via the shared `showVenue` object type), `salesOpen`, `showDate`/`showEndDate`
— the exact fields §4.1 wanted added to a "first `show` document." It is read by 3 GROQ
queries (`nationalShowQuery`, `nationalShowVenueQuery`, `nationalShowSalesQuery` in
`sanity/queries.ts:29,46,101`) and rendered by at least 8 marketing pages/components
(`app/(marketing)/{layout,page,tickets/page,contact/page,national-show/*}.tsx`,
`components/home/{Hero,ShowBand,NavCards}.tsx`, `components/show/{ShowCountdown,
VenueCard}.tsx`, `components/chrome/UtilityBar.tsx`).

Two consequences that make the brief's literal instruction impossible, not just
imprecise:

1. **Sanity `_id` is unique per dataset regardless of `_type`.** A `show`-typed document
   cannot also be assigned `_id: "nationalShow"` — that `_id` is permanently owned by
   the `nationalShow` singleton. "The `nationalShow` singleton becomes the first `show`
   document, its `_id` stays `nationalShow`" cannot be executed as written without either
   deleting/retyping the singleton (forbidden — never delete a document, and retyping
   breaks all 3 queries + 8 consuming surfaces above, which is not "additive" and is
   wildly out of F1's size) or creating an `_id` collision (rejected by Sanity itself).
2. **`NATIONAL_SHOW_ID` was never a Sanity document lookup key.** Read
   `app/api/tickets/checkout/route.ts:116-122`: `body.showId === NATIONAL_SHOW_ID` is a
   pure Firestore-scoping equality check. It is never used to fetch a Sanity document by
   `_id` anywhere in the codebase (confirmed by grep — the only Sanity fetches involving
   "the current show" go through `_type == "nationalShow"`, never `_id ==
   "nationalShow"`). It exists purely to tag Firestore `tickets`/(future) `orders`
   documents, and 14 real Firestore documents already carry `showId: 'nationalShow'`
   today (a 15th `tickets` doc, `76TA7iyOn8o0FCeNlNIr`, deliberately carries
   `showId: 'door-qr-check-wrong-show'` — a QA negative-control fixture, not a
   nationalShow booking). This is the actual backward-compatibility constraint — and it
   has nothing to do with which Sanity `show` document is "active."

**Corrected design: decouple the two identifier spaces entirely, rather than forcing
them to share a string.**

- `lib/tickets-constants.ts`'s `NATIONAL_SHOW_ID` constant is **untouched** — it stays
  the literal string `'nationalShow'`, used exactly as today, purely as the Firestore
  `showId` scoping value. F1 does not add any dynamic resolution to it. (This directly
  supersedes the brief's "resolve `NATIONAL_SHOW_ID` by querying `show` where
  `active === true`" instruction — that instruction is not implemented, because doing so
  would either require the impossible `_id` collision above, or silently repoint 14 real
  Firestore documents' scoping value, which is the exact kind of live-data migration this
  project's incident history says not to do casually.)
- A **new, separate** concept — "which Sanity `show` document is currently sellable" —
  is introduced via the `show.active` boolean (new field, this contract) and resolved by
  a new pure function, `resolveActiveShow()` (`lib/show-resolution.ts`, new file). This
  answers "which show's `ticketType.show` reference should checkout accept," which is a
  genuinely new question F1 is right to answer — it is just a different question from
  "what Firestore showId does a ticket carry," and the brief conflated the two.
- The already-existing `show-19-2027` document (status `upcoming`, year 2027 — the same
  year/edition the `nationalShow` singleton already describes) becomes the "first
  sales-capable show document." It is patched (not created) with the new fields
  (`edition: 19`, `salesOpen`, `active: true`, `venue`, `startDate`, `endDate`) by a
  one-time, idempotent migration script (`scripts/migrate-show-sales-fields.ts`, @dev's
  deliverable, following the existing `scripts/seed-ticketing.ts` pattern already in this
  repo — this is real, deliberate, reviewed content seeding, not a contract-check
  mutation, and the dataset is pre-production per project memory). The same script
  backfills `show: {_ref: 'show-19-2027'}` onto all 5 existing `ticketType` documents.
- `show.salesOpen` is added to the schema (per the brief) but is **not** wired into
  checkout in F1 — `nationalShowSalesQuery`'s existing `salesOpen` gate on the
  `nationalShow` singleton stays exactly as it is today. Migrating the sales-open gate
  itself off `nationalShow` is out of scope for F1 (it is a second, larger migration
  touching the functional gate on every checkout request) and is not required to satisfy
  F1's "Done" criteria. Flagged for a later feature if Brad wants the singleton
  retired.

## What checkout actually gains in F1

A new, additive, non-pinned check: after fetching `ticketTypeDoc` (unchanged query),
checkout also fetches the currently active show's `_id` (new `activeShowQuery`) and
rejects with the same `unusableTicketType`-style 500 (not a new error shape) if
`ticketTypeDoc.show?._ref` does not match it. This sits next to the existing
capacity/price validity checks (`app/api/tickets/checkout/route.ts:327-329`) — same
shape, same failure mode, no change to the reservation transaction, the idempotency
logic, or anything past line 330. `app/api/tickets/itn/route.ts` is not touched (sha256
pin verified unchanged as of this contract: see `itn-route.golden.sha256`).

## Resolver contract (`lib/show-resolution.ts`, new file, @dev implements)

```ts
export interface ShowActivationFields {
  _id: string;
  active?: boolean | null;
}

/** Returns the _id of the one show document with active === true, or null if none
 *  (or more than one — malformed data must never silently pick one). Never falls back
 *  to a hardcoded id: an empty/ambiguous result is a real "no active show" state that
 *  callers must handle explicitly (checkout treats it as `unusableTicketType`). */
export function resolveActiveShow(shows: ShowActivationFields[]): string | null;
```

Fixtures for this function live in `active-show-fixtures/`:

- `positive-single-active.json` — one show with `active: true`, one without → resolves
  to the active one's `_id`.
- `negative-none-active.json` — every show has `active` undefined (the real shape of
  today's 6 published docs, pre-migration) → resolves to `null`, not a guess.
- `negative-two-active.json` — two shows both `active: true` (an editor mistake) →
  resolves to `null`, fail-closed, not "pick the first one."

## Field additions (this contract)

`sanity/schemas/documents/show.ts` — six new fields, ALL optional/defaulted (no
`Rule.required()`, matching the brief's "optional-or-defaulted" instruction so no
published archive doc is invalidated):

| Field | Type | Notes |
|---|---|---|
| `edition` | `number` | e.g. `19` |
| `startDate` | `datetime` | |
| `endDate` | `datetime` | |
| `venue` | `showVenue` (existing shared object type, `sanity/schemas/objects/showVenue.ts`) | Reuses the type already used by `nationalShow.venue` — no new object schema invented for the same shape. |
| `salesOpen` | `boolean`, `initialValue: false` | Not wired into checkout in F1 — see above. |
| `active` | `boolean`, `initialValue: false` | Consumed by `resolveActiveShow()`. |

`sanity/schemas/documents/ticketType.ts` — one new field, REQUIRED (per the brief):

| Field | Type | Notes |
|---|---|---|
| `show` | `reference` → `[{type: 'show'}]`, `Rule.required()` | New documents must set it. The 5 existing published `ticketType` docs predate this field and are silently missing it in Studio until the migration script backfills them (see above) — `Rule.required()` is a Studio-authoring guard, not a read-time guarantee, matching the existing precedent already documented in `app/api/tickets/checkout/route.ts:73-76` for `ticketType.capacity`/`price`. |

## Backward-compatibility query surfaces (enumerated, step 2 of the brief)

Every surface that fetches `_type == "show"`, found by grep across `app/`, `lib/`,
`sanity/`, `scripts/`, `components/`:

1. `sanity/queries.ts:237` — `pastShowsQuery` (`_type == "show" && status == "past"`).
   Consumed by `app/(marketing)/national-show/archive/page.tsx`,
   `app/(marketing)/national-show/archive/[year]/page.tsx`, and
   `app/(marketing)/national-show/page.tsx`, all via `lib/data/mergeShows.ts`
   (`mergeShows`/`mergePastShows`, which reads only `year/status/location/entries/
   exhibitors/awards/title` — none of F1's new fields, so this helper is provably
   unaffected by construction, not merely by inspection).
2. `scripts/refresh-llms.ts:201` — inline GROQ, same filter
   (`_type == "show" && status == "past"`), sliced `[0..4]`.

Both filters exclude `show-19-2027` (`status: "upcoming"`) — only the 5 `status:
"past"` documents are in scope for these two surfaces' backward-compatibility proof.
Expected ids: see `expected-past-show-ids.json`.

No component or lib helper fetches `_type == "show"` directly — every consumer goes
through one of the two query surfaces above.

## Hard constraints verified respected

- `app/api/tickets/itn/route.ts` untouched — sha256 pinned, verified unchanged as of
  this contract (`itn-route.golden.sha256`).
- No Firestore or Sanity document deleted anywhere in this design.
- `NATIONAL_SHOW_ID` stays `'nationalShow'`, unchanged — the 14 existing Firestore
  `tickets` documents keyed to that `showId` remain valid without any migration (a 15th
  `tickets` doc is the unrelated `door-qr-check-wrong-show` QA fixture, see above).
- The `show-19-2027` / `ticketType` patch is a one-time, idempotent, reviewed migration
  script (@dev's deliverable) — not a contract-check mutation. All contract assertions
  that touch the live dataset are reads only.

## Runner note: `node --import tsx/esm` vs. the `npx tsx` CLI (2026-08-17)

Every check in this contract runs as `node --import tsx/esm <file>.mjs` **except**
`check-checkout-active-show-gate.mjs`, which runs as `npx tsx <file>.mjs`. Reason:
that check is the first one in this repo to import a file under `app/` — `checkout/
route.ts` — that itself uses `@/` tsconfig-path aliases in ITS OWN imports (`@/lib/
booking-ref`, `@/lib/firebase-admin`, etc.). `node --import tsx/esm` resolves the
directly-imported entry file fine but does not resolve `@/` aliases nested one level
deeper — confirmed failure: `Cannot find module '@/lib/booking-ref'`, require stack
pointing at `route.ts`. The `npx tsx` CLI resolves tsconfig paths at every import
depth and needs no other change to the check. **If a future contract needs to import
anything under `app/` or `components/` (both use `@/` imports pervasively) from a
check script, use `npx tsx <file>`, not `node --import tsx/esm <file>`.**
