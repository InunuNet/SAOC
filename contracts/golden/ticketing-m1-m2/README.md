# Golden set — ticketing-m1-m2 (F1–F4)

Companion to `contracts/contract-ticketing-m1-m2.yaml`. Covers M1 (F1: CMS-controlled
pricing/capacity/sales switch, and — added after the first draft — the `ticketsPage` copy
singleton) and M2 (F2 `/tickets`, F3 `/tickets/confirmation`, F4 `/tickets/cancelled`).
F5–F7 are a later pass and are out of scope here.

**All visible copy on the three ticketing pages is Sanity-editable.** Not just prices. See
decision #7 below and `content-vs-money-boundary.golden.md` for the exact line between
"content, put it in Sanity" and "moves money, stays in code."

## Deliberate reconciliation decisions (read before implementing)

### 1. `TicketType` stops being a fixed union

`types/index.ts` currently declares `export type TicketType = 'general' | 'member' | 'vip';`
— three values that never matched the council's real five categories, and that Firestore's
existing `tickets` collection already holds documents against.

Decision: **`TicketType` becomes `string`** (a slug reference into the new `ticketType` Sanity
document), not a hand-maintained union. Sanity is now the single source of truth for which
ticket types exist — hardcoding a parallel TS union would immediately drift the moment Lee-Ann
adds or renames a category in Studio, and would relitigate this same reconciliation problem
every time. See `ticket-type-reconciliation.golden.md` for the exact type + comment.

This is a **non-migration**: existing Firestore ticket docs carrying `general`/`member`/`vip`
are left exactly as they are. They remain valid `Ticket` records (the field is just `string`
now) and are simply orphaned from the current Sanity `ticketType` catalogue — nobody can buy
a `general` ticket anymore because no active `ticketType` document has that slug. No backfill,
no dual-write, no data migration script. This is deliberate: those are pre-launch sandbox test
tickets (see mission notes — the mission itself states test tickets were cleaned up), not real
sold inventory, and forcing a migration under a same-day deadline is the wrong trade.

### 2. Seeding is additive and non-destructive, on purpose

`scripts/seed-page-singletons.ts` is known-hazardous: it uses `createOrReplace` with hardcoded
literals, so re-running it silently reverts any editor changes made in Studio. F1 must not
repeat that mistake and must not touch that script at all.

Decision: a **new, separate** script `scripts/seed-ticketing.ts` (named for the whole feature,
not just ticket types, since it now also seeds the `ticketsPage` copy singleton — see
decision #7):
- Creates each `ticketType` document with `client.createIfNotExists(...)` keyed on a
  deterministic `_id` (`ticketType-<slug>`) — never overwrites a document that already exists,
  so a second run (or an editor's changes) is safe.
- Creates the `ticketsPage` singleton the same way, keyed on the deterministic `_id`
  `ticketsPage` (matching the existing singleton convention where `_id === schema type name`).
- Patches `nationalShow` with `client.patch(nationalShowId).setIfMissing({ salesOpen: false
  }).commit()` — `setIfMissing` only writes the field when it's absent, so it can never revert
  an editor's existing `title`, `hero`, `exhibitorStages`, etc., and can never flip `salesOpen`
  back to false after someone has deliberately opened sales.

### 3. Provisional pricing stays inside the existing field set

F1's `ticketType` schema is fixed to exactly: `name`, `slug`, `price`, `description`,
`capacity`, `active`, `order`. Rather than inventing a new `provisional: boolean` field (schema
growth under time pressure, and a field the council-approved data would then need to remember to
flip), the provisional marker lives in `description`, e.g. *"Provisional price — pending council
confirmation."* See `seed-ticketing.golden.json` for the exact five seeded documents.

### 4. `/tickets/confirmation` gets a ref via a URL query param, not client memory

The buyer's browser is redirected fresh by PayFast — there is no client-side state left to read
the booking reference from. `app/api/tickets/checkout/route.ts` must therefore append the
booking reference to `return_url` and `cancel_url` before signing them:
`${siteUrl}/tickets/confirmation?ref=${bookingRef}` and
`${siteUrl}/tickets/cancelled?ref=${bookingRef}`. This changes the literal string that gets
signed, which is fine — the signature covers whatever `return_url` value is actually sent, and
PayFast never re-derives or validates that string's shape.

### 5. The status endpoint returns the absolute minimum

`GET /api/tickets/status?ref=<bookingRef>` exists purely so `/tickets/confirmation` can poll
without claiming success or failure prematurely (the ITN race). It returns **`{ "status":
"reserved" | "paid" | "cancelled" | "checked-in" }`** and nothing else — no name, no email, no
amount, no ids. A booking ref is guessable enough (`SAOC-2027-` + 6 digits) that this mission
treats "return only status" as the load-bearing mitigation; per-IP rate limiting is named in the
mission as a nice-to-have and is deferred to F6, not blocking M2.

### 6. `/tickets/cancelled` does not touch Firestore

A cancelled PayFast session leaves the ticket doc in Firestore as `status: 'reserved'` — F4 adds
no cleanup, expiry job, or write of any kind. This is documented in the page's source comment.
Expiring stale `reserved` docs is future work (candidate for F6/F7), not part of this mission.

### 7. Every visible word is Sanity content, via one new `ticketsPage` singleton — added after Brad's follow-up

Original brief: don't invent brand assets. Follow-up brief: don't hardcode the *words* either —
the secretary must be able to reword anything a visitor reads, forever, without a developer.

Decision: one new page-singleton document, `ticketsPage`, following the exact pattern of
`homePage`/`aboutPage`/`judgingPage`/`contactPage` — see `ticketsPage-schema.golden.json` for
the full 15-field list covering all three pages (buy page heading/intro/button/sold-out/sales-
closed/terms copy; confirmation pending/success/not-found copy plus "what your ticket includes";
cancellation heading/message/button). Fields are plain `string`/`text`, not `portableText` —
this is short informational copy, not long-form body content, and `portableText` would add
render complexity with no payoff under a same-day deadline.

**This does NOT expand the page count.** Still exactly `/tickets`, `/tickets/confirmation`,
`/tickets/cancelled` — the schema grew, the scope didn't.

**Every field is seeded with real wording** (`seed-ticketing.golden.json`) — never blank, per
the standing project rule that a secretary opening an empty Studio field reads it as a broken
CMS, and per the `contactPage.formRecipients` incident (a schema field with nothing consuming
it — see the next paragraph for how this contract prevents a repeat).

**Every field is asserted both queried AND actually rendered — not just mentioned.** Two
confirmed bugs on this project motivate the strength of this check: `contactPage.formRecipients`
(a field sitting in Sanity, fully editable, wired into nothing) and `aboutPage.title` (fetched
into a variable but never placed in JSX — so it silently never rendered despite the field name
appearing in the file). A48–A50 therefore require each of the 15 `ticketsPage` fields to appear
inside an actual JSX curly-brace interpolation (e.g. `{data.title}`) in the consuming
page/component, not merely anywhere in the file — a destructure, a type declaration, or a
`{/* comment */}` mentioning the field name is deliberately NOT enough to pass. A50a additionally
asserts that where a hardcoded fallback exists, the Sanity value is checked first (`data.field ??
'fallback'`, never the reverse) — a published Studio edit must never be masked by a literal.

**What stays code, not content:** see `content-vs-money-boundary.golden.md`. Short version —
`nationalShow.salesOpen` (a functional gate) and everything in `lib/payfast.ts` /
`app/api/tickets/itn/route.ts` / the checkout route's amount-derivation path are unconditionally
excluded from this pass. The *message* shown when sales are closed moved from `nationalShow`
to `ticketsPage.salesClosedMessage` (content); the *boolean deciding whether checkout accepts
requests* stayed on `nationalShow.salesOpen` (state/logic).

## What must NOT change

`app/api/tickets/itn/route.ts` is a verified security boundary. Its SHA-256 at contract-authoring
time is recorded in `itn-route.golden.sha256` — assertion `A43` fails the gate if this file is
touched at all during F1–F4 implementation.

## The ITN pin baseline was re-based on F10 (2026-08-17)

This contract's `itn-route.golden.sha256` held `6dcde6d5…`, the file as it stood at commit
`e7de1e0` (PayFast M1, 2026-07-28). It was orphaned twice over: first by `a9586d1`
(ticketing hardening) and then by `ab4237b` (F10, the sole authorised reopening of the
pinned file). The assertion had been failing against a two-generations-old baseline.

Re-based onto `253c15c4…`, the current authorised content. The assertion's meaning is
unchanged — it still proves this feature does not reopen the payment-security boundary.

**Every pin of this file must be re-based together.** There are four:
`ticketing-f1-show-collision`, `ticketing-f10-itn-repin`, `ticketing-hardening`, and
`ticketing-m1-m2`.
