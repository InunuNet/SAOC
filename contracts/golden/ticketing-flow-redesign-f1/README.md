# ticketing-flow-redesign F1 — decision record

Mission: `.agent/memory/project/missions/2026-08-24-ticketing-flow-redesign.md`, feature F1,
milestone M1.

## 0. Scope

The pricing-and-data-model half of Brad's approved redesign, done first because the UI features
(F2, F3) both need to read/display a correct price and a correct product list. Purely non-visual
— every assertion below is automatable (grep/tsc/node), no `agent_review`.

Covers mission items (3) merge early-bird/regular into one product, and (6) the VIP price fix.
Does NOT cover the vertical-card UI (F2) or the Day Visitor per-day picker (F3).

## 1. What exists today (baseline)

`sanity/schemas/documents/ticketType.ts` has NO field pairing an early-bird price with a
post-cutoff price. "Merging" today is done entirely by convention — two independent documents
happen to share a naming pattern:

- `early-bird` (Early-Bird Exhibition Ticket, R130, `earlyBirdCutoff: 2027-07-31`) — has **no**
  regular-price counterpart at all. After the cutoff, `app/api/tickets/checkout/route.ts` refuses
  the whole cart with a 409 (`lib/checkout-reservation.ts`'s `isWithinEarlyBirdWindow()` returns
  false, route.ts line ~571). There is no product a buyer can purchase in its place.
- `early-bird-weekend-pass` (R380, capacity 150, `earlyBirdCutoff: 2027-07-31`) and `weekend-pass`
  (R400, capacity 300, no cutoff) are TWO SEPARATE `ticketType` Sanity documents, TWO separate
  entries in `lib/provisional-figures.ts`'s `ADMISSION_PRODUCTS`, with no structural link between
  them — the checkout route's 409 refusal on `early-bird-weekend-pass` after the cutoff does
  nothing to `weekend-pass`, which was independently on-sale for its own fixed R400 the whole time.
- `vip` is priced at R300 (`lib/provisional-figures.ts` line ~106) — cheaper than `weekend-pass`'s
  R400, despite being described as the top tier ("Reception access plus full-weekend admission").
  This is a data bug, not a design choice — see mission item (6).

`price` (required, `Rule.required().min(0)`), `earlyBirdCutoff` (optional datetime) already exist
on the schema — see `docs/f4-admission-products.md`.

## 2. Decision: one additive `regularPrice` field, not a second ticket-type document

**Decision:** `sanity/schemas/documents/ticketType.ts` gains one new optional field:

```ts
regularPrice: number | null   // Rule.min(0), no .required()
```

Semantics, enforced identically in `lib/checkout-reservation.ts`'s new `resolveEffectivePrice()`
and nowhere else (single source of price-selection logic, same posture as `effectiveCapacity()`/
`isWithinEarlyBirdWindow()` already established by F4):

- `earlyBirdCutoff` unset → `regularPrice` is ignored; effective price is always `price`. Covers
  every non-early-bird product (`day-visitor`, `vip`) unchanged.
- `earlyBirdCutoff` set, now is within the window → effective price is `price` (the early-bird
  rate), unchanged from today.
- `earlyBirdCutoff` set, now is past the window, `regularPrice` IS set → effective price is
  `regularPrice`. **This is the new behavior** — the product stays purchasable, at the higher
  price, instead of refusing.
- `earlyBirdCutoff` set, now is past the window, `regularPrice` is NOT set → effective price
  resolves to `null`; the caller refuses the same way it does today (409, "Early-bird pricing for
  this ticket type has closed."). **Byte-identical to current behavior for any product that keeps
  `regularPrice` unset** — this is what makes the change additive rather than a rewrite.

**Why one field on the existing document, not a second linked document:** a second document (e.g.
a `regularPriceOf` reference) would recreate exactly the two-documents-drift problem this feature
exists to remove — two CMS entries an editor can update independently and let go out of sync.
One document, one price that changes over time, is the literal shape of "one ticket product whose
price changes at a cutoff date" Brad asked for.

## 3. Open item, not blocking: the Exhibition ticket has no regular counterpart to merge with

`early-bird` (Early-Bird Exhibition Ticket) is a single-day admission product with **no existing
"regular Exhibition" price anywhere** — not in `provisional-figures.md`, not as a fifth/sixth
Sanity document, not in the mission brief (which names exactly the current 5 products, one of
which already only has an early-bird form). Brad's instructions describe merging pairs that
exist today; this one has no pair.

**Decision:** leave `early-bird` structurally as-is — `regularPrice` unset, current
close-at-cutoff behavior preserved exactly. This is flagged in `.agent/memory/project/goals.md`
follow-ups (not this contract) as an open question for Brad/Lee-Ann: does the Exhibition ticket
need a post-cutoff regular price at all, or is early-bird-only its intended design (seed early
sales, then funnel remaining buyers to Day Visitor/Weekend Pass)? Nothing in this feature commits
to either answer — the schema change supports adding one later with zero migration.

## 4. Data change: merge `early-bird-weekend-pass` into `weekend-pass`

**Decision:** `weekend-pass` (Sanity `_id: ticketType-weekend-pass`) becomes the ONE surviving
document for the Weekend Pass product:

| Field | Before (`weekend-pass`) | After (merged) |
|---|---|---|
| `price` | 400 | **380** (early-bird rate) |
| `regularPrice` | (didn't exist) | **400** |
| `earlyBirdCutoff` | unset | **2027-07-31** |
| `capacity` | 300 | 300 (unchanged — see rationale below) |
| `releasedQuantity` | unset | unset (unchanged) |

`early-bird-weekend-pass` (`_id: ticketType-early-bird-weekend-pass`) is set `active: false` —
**never deleted**, same "retire, don't delete" convention `scripts/seed-ticketing.ts` already
uses for the 5 pre-F4 placeholder types (`docs/f4-admission-products.md` §"Provisioning"). A
pre-production dataset with legacy demo/QA references by slug must not lose the document.

**Why `capacity: 300`, not `150` or `450`:** these were never two separate physical capacity
pools — a Weekend Pass buyer occupies a Weekend Pass seat regardless of which price they paid.
`early-bird-weekend-pass`'s `capacity: 150`/`releasedQuantity: 150` was a STAGED-RELEASE lever
("release the first 150 seats cheap to seed early sales" — `provisional-figures.md` line 45),
not a smaller true ceiling. Now that early-bird and regular are one priced window over one
inventory, the true ceiling is `weekend-pass`'s pre-merge capacity (300, the number that
represented "how many Weekend Pass seats actually exist"). `releasedQuantity` is left unset
(no staged-release restriction) because that concept (F4's "how many are on sale right now,
independent of price") is orthogonal to the price cutoff this feature adds — conflating them
would make the early-bird price open only to some fraction of the true inventory, which nothing
in the mission asked for.

`lib/provisional-figures.ts`'s `ADMISSION_PRODUCTS` array loses its separate
`early-bird-weekend-pass` entry entirely (source of truth reflects the go-forward model, not the
retired one) — the retirement of the LIVE Sanity document is a one-off patch script's job (§6),
matching this project's established split between "source of truth for new seeds" and "patch for
already-existing production documents" (`scripts/fix-visitor-info-dates-confirmed.ts`'s own
opening comment makes the same distinction).

## 5. VIP price fix: R300 → R480

**Decision:** `lib/provisional-figures.ts`'s `vip` entry: `price: 300` → `price: 480`. No other
VIP field changes (`capacity: 120`, `requiresAttendeeNames: true`, `regularPrice` stays unset —
VIP has no `earlyBirdCutoff`, so `regularPrice` is moot for it, same reasoning as §3).

**Why exactly R480, asserted as an exact value, not merely `vip.price > weekendPass.price`:**
this project's own incident history (see project memory `project_secret_corruption_class` and this
mission's own framing) is that a bug fix asserted only by inequality is satisfiable by any
"technically greater" number that is still wrong (e.g. R401) — an exact-value assertion is the
only one that actually proves R480, not just "more than R400", was written.

## 6. Live-dataset patch script: `scripts/fix-vip-and-weekend-pass-pricing.ts`

**Decision:** one new one-off patch script, following the SAME `--dry-run`/`--verify` pattern as
`scripts/fix-visitor-info-dates-confirmed.ts` (read `.env.local` directly, `@sanity/client`,
idempotent `.set()`/`.unset()` calls, never a raw ad-hoc mutation) — per this project's
`.claude/rules/coding.md`/mission-brief instruction to use that established pattern for any
Sanity price fix. Patches, in one script (all three edits are one atomic release of this feature,
not staged separately):

```
ticketType-vip:                 .set({ price: 480 })
ticketType-weekend-pass:        .set({ price: 380, regularPrice: 400, earlyBirdCutoff: EARLY_BIRD_CUTOFF })
                                 .unset(['releasedQuantity'])
ticketType-early-bird-weekend-pass: .set({ active: false })
```

`--verify` re-fetches all three documents and asserts every field above holds the corrected
value, printing PASS/FAIL per field (byte-identical reporting shape to
`fix-visitor-info-dates-confirmed.ts`'s `runVerify()`). Idempotent: a second run against
already-corrected documents is a no-op patch, not an error.

`EARLY_BIRD_CUTOFF` is imported from `lib/provisional-figures.ts` (the sole source of truth) —
never re-typed as a literal in the script.

## 7. Checkout route wiring

**Decision:** `app/api/tickets/checkout/route.ts`'s per-distinct-ticketType loop (~line 508-577):

- `SanityTicketType` interface gains `regularPrice: unknown;`.
- New validator `isUsableRegularPrice(value: unknown): value is number | null` (null OR a
  non-negative number — mirrors `isUsableEarlyBirdCutoff`'s null-or-valid shape, not
  `isUsableAmount`'s required-number shape, since `regularPrice` is optional).
- `unusableTicketType()`'s `field` union gains `'regularPrice'`.
- The existing line `amountByType[slug] = price;` (line ~550) and the existing early-bird 409
  refusal block (lines ~567-576) are REPLACED by one call to the new pure
  `resolveEffectivePrice()` (lib/checkout-reservation.ts, §2 above):

  ```ts
  const effectivePrice = resolveEffectivePrice({ price, regularPrice, earlyBirdCutoff, now: new Date() });
  if (effectivePrice === null) {
    return NextResponse.json(
      { error: 'Early-bird pricing for this ticket type has closed.' },
      { status: 409 }
    );
  }
  amountByType[slug] = effectivePrice;
  ```

  Same textual position, same 409 status/message on the refusal path — a product that never sets
  `regularPrice` behaves byte-identically to today. `resolveEffectivePrice` takes `now: Date`
  (not `Timestamp`) — same convention `isWithinEarlyBirdWindow` already uses.

## 8. Sanity queries and reads

**Decision:** `sanity/queries.ts`'s `activeTicketTypesQuery`, `activeTicketTypesByCategoryQuery`,
and `ticketTypeBySlugQuery` each add `regularPrice` to their GROQ projection, right next to the
existing `price` field they already select. `ticketTypesByPoolQuery` is unchanged (it never
selected `price` either). `components/tickets/CategoryTicketsPage.tsx`'s `SanityTicketType`
local interface and its `cardData` mapping also gain `regularPrice` — F2 (not this feature)
is what actually displays it; F1 only wires the read path so F2 has data to consume.

## 9. Explicitly out of scope

- Vertical card layout, per-type dedicated buy screens, real orchid photos — F2.
- Day Visitor per-day quantity picker — F3.
- Any change to `capacity`, `requiresDaySelection`, `requiresAttendeeNames`, `capacityPool`,
  `headcountPerUnit` on any product.
- Conference/workshop-field-trip products (`CONFERENCE_PRODUCTS`, `WORKSHOP_FIELD_TRIP_PRODUCTS`)
  — `regularPrice` is added to the shared `ProvisionalAdmissionProduct` interface as OPTIONAL
  (`regularPrice?: number | null`) specifically so none of their existing entries need editing.
- `scripts/seed-ticketing.ts` — unchanged; `createIfNotExists` already means it will never
  re-create/overwrite the two already-published documents this feature patches live via §6's
  script. Its `buildTicketTypeDoc()` passing through `product.regularPrice` for FUTURE re-seeds
  from a fresh dataset is covered by the interface change in §8, not a script edit.
