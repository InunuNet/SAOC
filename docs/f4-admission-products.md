# F4: Admission Products — The Five Ticket Types

**Feature:** F4 of mission `multi-line-item-cart` (milestone M2). The five real Orchid Exhibition Visitor ticket products, each with provisional pricing/capacity, an early-bird window, a released-quantity lever, and per-product schema requirements (day selection, attendee names).

**Contract:** `contracts/golden/ticketing-f4-admission-products/README.md` — the full design record; do not duplicate it, read it first. **This doc is the guide; that is the specification.**

**Status:** Gated 11/11, QA-passed, Codex cross-model-passed.

---

## The Five Products

| Slug | Name | Price | Regular Price | Capacity | Released | Early-Bird Cutoff | Day Select | Attendee Names |
|---|---|---|---|---|---|---|---|---|
| `early-bird` | Early-Bird Exhibition Ticket | R130 | — | 400 | 400 | 2027-07-31 | ✗ | ✗ |
| `day-visitor` | Day Visitor Ticket | R150 | — | 800 | ∅ | ∅ | ✓ | ✗ |
| `weekend-pass` | Weekend Pass | R380 | R400 | 300 | ∅ | 2027-07-31 | ✗ | ✗ |
| `vip` | VIP Ticket | R480 | — | 120 | ∅ | ∅ | ✗ | ✓ |

All figures are transcribed verbatim from `.agent/memory/project/provisional-figures.md` — see the "Replacement procedure" section below. The VIP ticket (R480) is the top tier, priced above the Weekend Pass (R380 early-bird, R400 regular) to reflect its reception access. The Weekend Pass is now one product that changes price at the cutoff; the separate early-bird-weekend-pass document is retired (F1, see below). VIP is Thursday-only (17:00–18:30 reception); Day Visitor is a per-day admission, not concurrent occupancy (see "Known scope gap" below).

---

## Single Source of Truth: `lib/provisional-figures.ts`

Every price, capacity, `releasedQuantity`, and `earlyBirdCutoff` value lives in exactly one place: the `ADMISSION_PRODUCTS: ProvisionalAdmissionProduct[]` export.

```ts
export interface ProvisionalAdmissionProduct {
  slug: string;
  name: string;
  price: number;
  capacity: number;
  releasedQuantity: number | null; // 400/150 for early-bird types; null for others
  earlyBirdCutoff: string | null;  // '2027-07-31' for early-bird; null otherwise
  requiresDaySelection: boolean;
  requiresAttendeeNames: boolean;
  provisional: true; // machine-readable, not per-value yet per-file (see "The provisional flag" below)
  description: string;
}

export const EARLY_BIRD_CUTOFF = '2027-07-31';
export const ADMISSION_PRODUCTS: ProvisionalAdmissionProduct[];
```

**Why this matters:** This project has twice had a single estimate spread across multiple places, then edited independently, creating silent conflicts (CTICC venue, 18–21 September 2027 show dates — see `.agent/memory/project/provisional-figures.md`'s "Why this file exists at all"). A single `lib/provisional-figures.ts` source is enforcement. `scripts/seed-ticketing.ts` imports this array; no second copy exists anywhere in the codebase.

---

## Sanity Schema: `sanity/schemas/documents/ticketType.ts`

Six new fields, all additive (no removals, no renames):

| Field | Type | Required | Purpose |
|---|---|---|---|
| `provisional` | boolean | No (default `true`) | Machine-readable flag, gated in UI to show "Provisional pricing — subject to change" badge |
| `earlyBirdCutoff` | datetime | No | ISO 8601 date (e.g. `'2027-07-31'`). `null` = no early-bird window for this product |
| `releasedQuantity` | number | No (allows 0) | How many seats are *currently on sale*. Independent from physical `capacity` for future staged-release features. Early-bird types: equals `capacity` today. Others: `null` |
| `requiresDaySelection` | boolean | No (default `false`) | Day Visitor only; checkout must prompt for chosen day (F5 enforces this, F4 only sets the flag) |
| `requiresAttendeeNames` | boolean | No (default `false`) | VIP only; checkout must collect attendee names (F5 enforces this, F4 only sets the flag) |
| `regularPrice` | number | No | **(F1)** Price after `earlyBirdCutoff` passes. `null` (default) = sale closes at cutoff. When set, the product stays purchasable at this higher price after early-bird window ends. See [F1: Ticketing Pricing Migration](f1-ticketing-pricing-migration.md) for decision record. |

Every pre-existing field (`name`, `slug`, `price`, `description`, `capacity`, `active`, `order`, `show`, `demo`) is unchanged.

---

## Checkout Enforcement

Two new pure functions in `lib/checkout-reservation.ts` (additive; existing functions unchanged):

```ts
// Never exceeds capacity regardless of releasedQuantity. 0 is a valid released value.
export function effectiveCapacity(
  capacity: number,
  releasedQuantity: number | null | undefined
): number;

// Checks if now is within the cutoff date (inclusive: end of cutoff date = still eligible).
export function isWithinEarlyBirdWindow(
  now: Date,
  cutoffIso: string | null | undefined
): boolean;
```

**Integration:** `app/api/tickets/checkout/route.ts`'s per-distinct-ticketType loop already validates capacity/price/show. F4 adds:

1. `capacityByType[slug]` is computed as `effectiveCapacity(capacity, releasedQuantity)` instead of bare `capacity` — flows into the existing atomic `planCapacity()`/`aggregateRequestedQuantities()` validation, no new code path.
2. If `earlyBirdCutoff` is set and `!isWithinEarlyBirdWindow(new Date(), cutoff)`, refuse the whole request with a **409** (business state, not misconfiguration) and a distinct message (e.g. "Early-bird pricing for this ticket type has closed.").

This is real enforcement: server-side, ahead of any write, same fail-closed posture as existing precondition checks. No cart can proceed if any product has failed its early-bird window check.

---

## UI: Provisional Badge

`app/(marketing)/tickets/page.tsx` and `components/tickets/TicketTypeCard.tsx`:

- `TicketTypeCard` receives `provisional: boolean` prop.
- If `provisional === true`, renders visible text (e.g. `<span>Provisional pricing — subject to change</span>`), not CSS-only styling — survives `renderToStaticMarkup()` with no browser.
- If `provisional === false` or missing, badge does NOT render.

This satisfies: not "the number is right" but "the UI is provably gated on the flag" — a badge present only when the flag is true (A9 in the contract proves this with two fixtures, one of each).

---

## Provisioning: `scripts/seed-ticketing.ts`

F4 rewrites the seed script to:

1. Import `ADMISSION_PRODUCTS` from `lib/provisional-figures.ts` (sole source of truth).
2. Set the five old placeholder `ticketType` documents (`adult`/`pensioner`/`child`/`saoc-member`/`exhibitor`) to `active: false` (never delete — pre-production dataset, legacy demo/QA may reference them by slug).
3. `createIfNotExists` the five new real products from `ADMISSION_PRODUCTS`, matching the `ProvisionalAdmissionProduct` shape exactly.

The script resolves the `show` reference dynamically by querying for the active show via GROQ. **Known limitation** (from QA): if multiple shows are marked active, the query picks `[0]` (database order, not deterministic). This does not fail the contract (query succeeds, assignment is defined); it's a noted gap for whoever builds a multi-show scenario. For today's single-active-show model, it is unambiguous.

---

## Replacement Procedure: When Lee-Ann's Real Numbers Land

From `.agent/memory/project/provisional-figures.md`, the official replacement steps:

1. Read her questionnaire answers off the artifact with WebFetch.
2. Replace the values in `lib/provisional-figures.ts` — the single source of truth. Do not edit them at multiple call sites.
3. Set `provisional: false` on each `ticketType` Sanity document per value as it is confirmed (or keep `true` for values still pending — the flag is per-document, not per-file).
4. Re-run the contract gate: `bash contracts/checks/admin-auth-hardening/server-ctl.sh start && contract.py && ... stop`. Any assertion that only passes because a value is provisional must be observed failing against a confirmed value.
5. Update `.agent/memory/project/provisional-figures.md` to record what she actually said and what we estimated wrongly. That delta tells us how far off our estimates run.

**Before updating, verify the change**: in the artifact or in Sanity, confirm the confirmed vs. provisional status is accurately set. A number never confirmed but marked `provisional: false` will mislead future readers.

---

## What F4 Does NOT Do

- **Per-day capacity for Day Visitor:** Capacity counts across the whole show, not per day. The Day Visitor product carries `capacity: 800` (the per-day figure from `provisional-figures.md`), but `lib/data/tickets.ts`'s `getSoldCountsByTicketType` counts sold positions per `ticketType` document, not per `ticketType + day`. This is **F5's scope** — positions will carry a chosen day and check-in will validate it.
- **Child ticket:** Deliberately excluded. Five products only (per the mission's "Known blockers" section, which is unambiguous: "do not invent a sixth"). When Lee-Ann's questionnaire resolves whether a child ticket exists, it becomes its own follow-up feature, not a retrofit.
- **Auto-settle stranded orders or per-day capacity enforcement:** Both deferred features, not this one.

---

## Known Open Items

**Seed-script ambiguity:** If multiple `nationalShows` are marked `active: true`, the seed script's `findActiveShow()` query picks `[0]` (database order). For a single-show model, this is unambiguous. For multi-show scenarios, this becomes a real gap and the seed script should fail closed instead. Recorded for the next multi-show feature.

---

## Files Changed

- `lib/provisional-figures.ts` (new) — sole source of truth for all five admission products
- `sanity/schemas/documents/ticketType.ts` — five additive fields
- `sanity/queries.ts` — extended `activeTicketTypesQuery` to select `provisional`, `releasedQuantity`, `earlyBirdCutoff`
- `lib/checkout-reservation.ts` — `effectiveCapacity()`, `isWithinEarlyBirdWindow()` (new exports)
- `app/api/tickets/checkout/route.ts` — per-ticketType loop now computes effective capacity and checks early-bird window
- `app/(marketing)/tickets/page.tsx` — passes `provisional` to `TicketTypeCard`
- `components/tickets/TicketTypeCard.tsx` — renders provisional badge when flag is true
- `scripts/seed-ticketing.ts` — rewritten to import from `ADMISSION_PRODUCTS`, set old types `active: false`, create new five

---

## Sources

- `.agent/memory/project/provisional-figures.md` — data, replacement procedure, why this file exists, how to avoid spread-and-diverge incidents
- `contracts/golden/ticketing-f4-admission-products/README.md` — design record, why each field exists, provisioning strategy, why child ticket is out of scope
- All three are load-bearing; this doc is the guide, those are the specifications.
