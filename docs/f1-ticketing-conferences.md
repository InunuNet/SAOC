# F1: Conferences — The Six Ticket Types

**Feature:** F1 of mission `ticketing-conferences-and-events` (milestone M1). The six Conferences category products (SAOC Symposium, WOSA Conference, and their Joint bundle), each with Early-Bird and Normal pricing, all provisional estimates pending Lee-Ann's specification questionnaire.

**Contract:** `contracts/golden/ticketing-conferences-f1/README.md` — the full design record; do not duplicate it, read it first. **This doc is the guide; that is the specification.**

**Status:** Gated ✓, QA-passed, Codex cross-model-passed.

---

## The Six Products

| Slug | Name | Price | Capacity | Released | Early-Bird Cutoff | Day Select | Attendee Names |
|---|---|---|---|---|---|---|---|
| `saoc-symposium-early-bird` | SAOC Symposium (Early-Bird) | R450 | 150 | 150 | 2027-07-31 | ✗ | ✓ |
| `saoc-symposium` | SAOC Symposium | R550 | 150 | ∅ | ∅ | ✗ | ✓ |
| `wosa-conference-early-bird` | WOSA Conference (Early-Bird) | R450 | 150 | 150 | 2027-07-31 | ✗ | ✓ |
| `wosa-conference` | WOSA Conference | R550 | 150 | ∅ | ∅ | ✗ | ✓ |
| `saoc-wosa-joint-early-bird` | SAOC/WOSA Joint (Early-Bird) | R750 | 80 | 80 | 2027-07-31 | ✗ | ✓ |
| `saoc-wosa-joint` | SAOC/WOSA Joint | R900 | 80 | ∅ | ∅ | ✗ | ✓ |

All figures are Athanor's own estimates, explicitly flagged `provisional: true`. There is no client-supplied source to transcribe — Lee-Ann's spec questionnaire section C (Conferences) remains empty. Per Brad's standing instruction (estimate now, correct later, do not block on the council), these values are estimated conservatively using the venue (The Hangar) and show structure as anchors, and marked trivial to replace wholesale per `lib/provisional-figures.ts`'s own discipline.

**Key insight:** Joint is priced as a genuine bundle discount (~17–18% cheaper than buying both single-track tickets separately), never as a free upgrade or a sum. The contract's A1 checker enforces this structurally.

---

## Single Source of Truth: `lib/provisional-figures.ts`

Every price, capacity, `releasedQuantity`, and `earlyBirdCutoff` value lives in exactly one place: the `CONFERENCE_PRODUCTS: ProvisionalAdmissionProduct[]` export.

```ts
export const CONFERENCE_PRODUCTS: ProvisionalAdmissionProduct[] = [
  {
    slug: 'saoc-symposium-early-bird',
    name: 'SAOC Symposium (Early-Bird)',
    description: 'Full registration for the SAOC Symposium track during the early-bird window.',
    price: 450,
    capacity: 150,
    releasedQuantity: 150,
    earlyBirdCutoff: '2027-07-31',
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
  },
  // ... four more products follow same structure
];
```

**Why reuse `ProvisionalAdmissionProduct` instead of a second interface?** The interface name is a minor mismatch (`Admission` no longer describes every row), but renaming it would touch every existing F4 import for a cosmetic gain — not worth the blast radius. The shape is identical and intentionally generic.

**Why this matters:** This project has twice had estimates spread across multiple files, then edited independently, creating silent conflicts (show dates 18–21 vs. 16–19 Sept 2027 — see `.agent/memory/project/provisional-figures.md`). A single source of truth is enforcement. `scripts/seed-ticketing.ts` imports this array; no second copy exists anywhere in the codebase.

---

## Sanity Schema: No Changes Required

The five new fields F4 added to `sanity/schemas/documents/ticketType.ts` are already fully generic:

| Field | Already in F4 | Reused Here |
|---|---|---|
| `provisional` | ✓ | ✓ Flag is true for all six; replaced when Lee-Ann's answers land |
| `earlyBirdCutoff` | ✓ | ✓ Set to `'2027-07-31'` for all early-bird products; `null` for normal |
| `releasedQuantity` | ✓ | ✓ Early-bird types: equals capacity; normal types: `null` |
| `requiresDaySelection` | ✓ | ✗ False for all six (Symposium/Conference/Joint is multi-day, not per-day choice) |
| `requiresAttendeeNames` | ✓ | ✓ True for all six (conference registration requires badges/sign-in) |

The six Conference products are plain `ticketType` documents using the existing fields. No new Sanity schema changes. The A3 contract assertion proves no conference-named or parallel schema was added.

---

## Checkout Enforcement

No code changes. The existing functions `lib/checkout-reservation.ts` — `effectiveCapacity()` and `isWithinEarlyBirdWindow()` — work generically on any `ticketType` document's `capacity`, `releasedQuantity`, and `earlyBirdCutoff`. The six Conference products flow through the same existing validation pipeline with zero new code.

**Existing validation in `app/api/tickets/checkout/route.ts`:**

1. For each distinct ticket type in the cart, compute effective capacity: `effectiveCapacity(capacity, releasedQuantity)` — never exceeds capacity regardless of released quantity.
2. If `earlyBirdCutoff` is set and we're past that date, refuse with a **409** (business state) and a message like "Early-bird pricing for this ticket type has closed."
3. Validate total quantities against aggregated capacity — same fail-closed posture as all precondition checks.

This validation is real, server-side, and enforced before any write. No cart can proceed if any product (admission or conference) fails its early-bird window or capacity check.

---

## UI: Provisional Badge

`components/tickets/TicketTypeCard.tsx` already renders the provisional badge when the `provisional` boolean prop is `true`. The six Conference products carry `provisional: true`, so the badge will render for all of them on the `/tickets` page with the text "Provisional pricing — subject to change."

The badge is the sole place where provisional status is communicated to the buyer. Descriptions carry only permanent, factual copy (what the ticket covers), never pricing or status messaging.

---

## Provisioning: `scripts/seed-ticketing.ts`

The seed script was updated to:

1. Import `CONFERENCE_PRODUCTS` alongside `ADMISSION_PRODUCTS` from `lib/provisional-figures.ts`.
2. Combine both arrays: `const allProducts = [...ADMISSION_PRODUCTS, ...CONFERENCE_PRODUCTS]`.
3. Seed all 11 products (five admission + six conference) as `ticketType` documents using `createIfNotExists`, keyed on `ticketType-${product.slug}`.
4. Retire the five old placeholder categories (adult/pensioner/child/saoc-member/exhibitor) by setting `active: false` — never deleted, as pre-production demos may still reference them.

The script resolves the `show` reference dynamically by querying for the active show. **Known limitation** (same as F4): if multiple shows are marked active, the query picks `[0]` (database order). For today's single-active-show model, this is unambiguous.

---

## Replacement Procedure: When Lee-Ann's Real Numbers Land

Identical to F4's existing procedure — when real figures arrive:

1. Read her questionnaire answers (the `reference_leeann_pricing_artifact` memory carries the URL; WebFetch the page to extract section C).
2. Replace the values in `lib/provisional-figures.ts` — the single source of truth. Do not edit them at multiple call sites.
3. Set `provisional: false` on each Sanity `ticketType` document as it is confirmed. Or keep `true` for values still pending — the flag is per-document, not per-file.
4. Re-run the contract gate to verify no assertion that only passes because a value is provisional breaks against confirmed figures.
5. Update `.agent/memory/project/provisional-figures.md` to record what the council actually said and what Athanor estimated wrongly. That delta trains better estimates next time.

**Before updating, verify the change:** confirm the provisional vs. confirmed status is accurately set in Sanity. A number never confirmed but marked `provisional: false` will mislead future readers.

---

## What F1 Does NOT Do

- **Nav wiring** — adding these six products to the National Show mega-menu's Tickets column is **F3's scope** (`components/chrome/nav-config.ts` — already a plain data array per Mission One, ready for exactly this kind of append). Not touched here.
- **Checkout enforcement changes** — existing functions already work for any ticket type. Confirming checkout works end-to-end for these new products is **F4's scope** — that feature owns verifying the schema's fields are sufficient (or flagging any missing properties like per-session workshop capacity). Not changed here.
- **A dedicated ticket-type page or cart-UI copy for Conferences** — out of scope; presentation and checkout wiring belong to F3/F4.
- **Seeding into Sanity at runtime or via a live deployment** — this is offline seeding against `.env.local` credentials. A real Sanity round-trip is deferred to whoever runs the seed script locally or deploys it.

---

## Known Open Items

**F2 (Workshops/Field Trips/Cocktails) will define the remaining category** — this feature covers only the Conferences category. The Workshops category carries its own challenges (per-session capacity, which sessions exist, cocktail attendee age restriction) flagged in F2's own scope.

**Nav messaging must avoid bare "Events"** — Mission One's `ticketing-nav-restructure` flagged that Workshops/Field Trips might collide with the existing `/events` nav item if mislabeled. Conferences has no such collision risk, but the naming rule applies site-wide for consistency. This feature's copy never uses bare "Events" (A4 proves this by negative assertion — if a future edit introduces it, the test fails).

**Seed-script ambiguity on multi-show:** If multiple `nationalShows` are marked `active: true`, the seed script's `findActiveShow()` query picks `[0]` (database order). For a single-show model, this is unambiguous. For multi-show scenarios, this becomes a real gap and should fail closed instead — recorded for the next multi-show feature.

---

## Files Changed

- `lib/provisional-figures.ts` — new `CONFERENCE_PRODUCTS` array (six entries); new constants for prices and capacity
- `scripts/seed-ticketing.ts` — imports `CONFERENCE_PRODUCTS`, combines it with `ADMISSION_PRODUCTS`, seeds all 11 products

No changes to:
- `sanity/schemas/documents/ticketType.ts` (schema is already generic)
- `sanity/queries.ts` (existing query already selects all needed fields)
- `lib/checkout-reservation.ts` (existing functions work generically)
- `app/api/tickets/checkout/route.ts` (existing validation works generically)
- `app/(marketing)/tickets/page.tsx` (already passes provisional flag)
- `components/tickets/TicketTypeCard.tsx` (already renders provisional badge)

---

## Sources

- `.agent/memory/project/missions/2026-08-21-ticketing-conferences-and-events.md` — F1 scope and rationale
- `contracts/golden/ticketing-conferences-f1/README.md` — design decisions: why these six products, why these prices, why no schema changes, why reuse `ProvisionalAdmissionProduct`, bundle pricing formula
- `lib/provisional-figures.ts` — source of truth for all figures (no copy anywhere else)
- `.agent/memory/project/provisional-figures.md` — replacement procedure and why this file exists
