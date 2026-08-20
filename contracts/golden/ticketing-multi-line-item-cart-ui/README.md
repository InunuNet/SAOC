# Multi-line-item cart UI — decision record

Mission `multi-line-item-cart`, F3 ("Cart UI — select multiple ticket types and quantities, then
check out"). Builds the buyer-facing surface for the API `contract-ticketing-multi-line-item-cart`
already pinned (`{ showId, lineItems: [...] }`), and closes the two gaps that contract's own README
named but deliberately did not fix: the confirmation page and email showing only the first ticket
of a multi-item order.

---

## Sequencing risk — READ BEFORE DISPATCHING @dev

**F3 and F4 below both edit files `contract-ticketing-multi-line-item-cart`'s @dev is already
mid-editing: `lib/orders.ts` (F3 here is a NEW, additive function — `getConfirmedOrderForDisplay`
— but it lives in the same file as the `markOrderAndPositionPaidByPaymentId` fix that contract's
own F3 is implementing) and `app/api/tickets/itn/route.ts` (F4 here is a one-line change to the
SAME `sendConfirmationEmail(...)` call site that contract's own F3 touches, since it also edits
that function's return shape).** This is flagged, not silently risked: recommend the orchestrator
either (a) hand F3/F4 of THIS contract to the SAME @dev session, as a direct continuation once the
prior contract's F1/F2/F3 land, or (b) sequence this contract's dev dispatch strictly after the
prior one merges. Do NOT run two concurrent @dev dispatches against `lib/orders.ts` and
`app/api/tickets/itn/route.ts` at the same time — this is exactly the kind of collision the
orchestrator's own "do not touch anything @dev is implementing" rule exists to prevent, and I am
naming the risk explicitly rather than writing around it silently. F1 and F2 below (`lib/cart.ts`,
the `components/tickets/*` UI) touch NO file the prior contract's @dev is editing and can proceed
in parallel with no risk.

---

## F1 — `lib/cart.ts` (new file, pure, no Firestore/Sanity import — client-bundle-safe, same
convention as `lib/tickets-constants.ts`)

```ts
export interface CartTicketTypeInfo {
  slug: string;
  /** Server-resolved (Sanity, via the page's own server-side fetch) — this is the ONLY
   *  price source these functions ever read. */
  price: number;
  soldOut: boolean;
}

export interface CartAttendee {
  attendeeName: string;
  attendeeEmail: string;
}

/** Pure. Sums quantities[slug] * that slug's price, reading ONLY from the `types` array —
 *  no second, hardcoded price table anywhere in this function. A slug present in
 *  `quantities` but absent from `types` (a stale/removed ticket type) is EXCLUDED from
 *  the total, not priced at 0-and-silently-kept, not thrown. */
export function computeCartTotal(quantities: Record<string, number>, types: CartTicketTypeInfo[]): number;

/** Pure. Sum of every quantity in the cart, ignoring slugs whose quantity is <= 0. */
export function cartItemCount(quantities: Record<string, number>): number;

/** Pure. Expands { slug: quantity } into a flat, ORDERED array of CheckoutLineItemInput
 *  (the shape pinned by app/api/tickets/checkout/route.ts's own export, per
 *  contract-ticketing-multi-line-item-cart) — pairing each unit of a type, IN ORDER,
 *  with the attendee row assigned to it in `attendeesByType[slug]`. `typesOrder` fixes
 *  the between-type ordering (must be the SAME array the page rendered the type cards
 *  in), so a submitted cart's line-item order is deterministic and reproducible — load-
 *  bearing for idempotency-key replay (contract-ticketing-multi-line-item-cart's A4
 *  proves the SERVER'S replay comparison is order-independent, but a deterministic
 *  CLIENT order means a genuine retry submits byte-identical JSON, not just an
 *  equivalent multiset, which is the simpler and more robust property to aim for).
 *  THROWS if `attendeesByType[slug]?.length !== quantities[slug]` for any selected type
 *  — a mismatched row count is a UI bug and must fail loudly before a POST is ever sent,
 *  never silently pad or truncate the cart. */
export function buildLineItemsFromCart(
  quantities: Record<string, number>,
  attendeesByType: Record<string, CartAttendee[]>,
  typesOrder: string[]
): CheckoutLineItemInput[]; // CheckoutLineItemInput imported from '@/app/api/tickets/checkout/route'
```

## F2 — `components/tickets/*` (edited/new — UI wiring, no files the prior contract touches)

- **`TicketTypeCard`** (`components/tickets/TicketTypeCard.tsx`): the radio input becomes a
  quantity stepper (0 by default; disabled/pinned to 0 when `soldOut`). `TicketTypeCardData` gains
  no new required field — `soldOut` already exists and is what disables further increments; real
  capacity enforcement stays entirely server-side (this contract's own A1/A2 in the sibling
  `ticketing-multi-line-item-cart` contract), the client-side disable is UX only, matching the
  existing `soldOut` disable-radio convention this component already has.
- **`TicketPurchaseForm`** (`components/tickets/TicketPurchaseForm.tsx`): cart state becomes
  `Record<slug, number>` (replacing the single `selectedType` string). A running total renders
  continuously via `computeCartTotal(quantities, ticketTypes)` (the SAME `ticketTypes` prop the
  Server Component already passes down from `activeTicketTypesQuery` — no new fetch, no new price
  source), labelled as an estimate (e.g. "Estimated total: R{total}") — see "Why the running total
  is explicitly an estimate" below for why it is never presented as the final charged amount.
  Below the type list: one attendee-name/email field pair PER UNIT in the cart, grouped by type
  (e.g. "Attendee 1 — Early-Bird", "Attendee 2 — Early-Bird", "Attendee 1 — VIP"), reusing the
  existing `TicketFormField` component and validation pattern (non-empty name, `EMAIL_PATTERN`
  email) — the SAME per-position requirement the backend already enforces uniformly across every
  ticket type today (Stage 3/mission-F5's per-type "requires attendee names" flag is explicitly
  NOT implemented here — every position already needs a name/email regardless of type, unchanged).
  On submit: `buildLineItemsFromCart(quantities, attendeesByType, typesOrder)` (throws ->
  surface as a field-level error, not a network error), reject client-side if `cartItemCount(...)
  === 0` ("select at least one ticket") or `> MAX_LINE_ITEMS` (imported from
  `@/app/api/tickets/checkout/route`, the SAME constant the server enforces — UX-only pre-check,
  the server's own A5 in the sibling contract remains the real boundary), then POST `{ showId:
  NATIONAL_SHOW_ID, lineItems }` with the SAME one-key-per-form-instance Idempotency-Key
  convention, UNCHANGED.
- **Pre-redirect amount display**: before rendering `PayfastRedirectForm`, the UI must display the
  amount from the CHECKOUT RESPONSE'S `fields.amount` (the PayFast hidden field the server's
  `paymentProvider.initiate(...)` call already produces, carrying the real, server-derived total) —
  e.g. "You're about to pay R{fields.amount} via PayFast" — NEVER the pre-submit
  `computeCartTotal(...)` estimate. See "Why the running total is explicitly an estimate" below.

### Why the running total is explicitly an estimate

**The defect to design against, per the architect brief: a displayed total that disagrees with the
charged total.** The pre-submit running total is computed from `price` values the Server Component
fetched at PAGE LOAD time; the amount actually charged is derived fresh, server-side, from Sanity
at CHECKOUT time (unchanged, existing posture — "prices come from the server, never the request").
Between those two moments a price can genuinely change. Rather than trust the pre-submit estimate
silently carries forward as fact, the UI re-displays the AUTHORITATIVE value from the checkout
response immediately before the buyer is sent to PayFast — the one moment the real, server-derived
total is available client-side. This is the reconciliation point: if the two numbers ever disagree
(stale estimate vs. fresh server total), the buyer sees the REAL number before paying, not the
possibly-stale one. A2 proves the estimate's arithmetic is correct against whatever `types` array
it's given (no hidden second price source); whether the pre-redirect step genuinely reads
`fields.amount` and not its own stale state is a wiring claim only rendering can prove — see the
BrowserAgent checklist below.

## F3 — `lib/orders.ts` (additive — see "Sequencing risk" above)

```ts
export interface ConfirmedOrderDisplay {
  reference: string;
  /** Every PAID (or checked-in) position belonging to the order, reusing the existing
   *  per-position ConfirmedTicketDisplay shape unchanged. */
  positions: ConfirmedTicketDisplay[];
}

/**
 * Order-aware replacement call site for the confirmation page. Resolves the order via
 * `orders.where('m_payment_id', '==', reference).limit(1)` (same query shape
 * findReservedOrderByPaymentId already uses), fails closed to null unless
 * `order.status === 'paid'`; then resolves EVERY position via `tickets.where('orderId',
 * '==', order.id).get()` (NO `.limit(1)` — same reasoning as the sibling contract's F3
 * fix to markOrderAndPositionPaidByPaymentId), filtered to CONFIRMED_TICKET_STATUSES
 * ('paid'/'checked-in', the existing set), generating one QR per position via the SAME
 * generateBookingRefQrDataUri. Fails closed to null if, after filtering, zero positions
 * qualify (should not happen once the sibling contract's F3 ships, but this function
 * does not assume that — it re-derives fail-closed on its own data, never on a promise
 * made elsewhere).
 *
 * `getConfirmedTicketForDisplay` (existing, single-position) is left UNCHANGED — still
 * the subject of execution/checks/verify_confirmation_page.ts's status-gate check, which
 * stays valid and green. This is a NEW, additive sibling, same "don't touch a function
 * three other things already assert against" reasoning the sibling contract's own README
 * already established for lib/checkout-reservation.ts.
 */
export async function getConfirmedOrderForDisplay(
  reference: string,
  deps?: { db?: OrdersFirestoreRwLike; generateQrDataUri?: (bookingRef: string) => Promise<string> }
): Promise<ConfirmedOrderDisplay | null>;
```

`app/(marketing)/tickets/confirmation/page.tsx` switches its call from
`getConfirmedTicketForDisplay(bookingRef)` to `getConfirmedOrderForDisplay(bookingRef)` (the
`?ref=` param IS the order-level reference per the sibling contract's own decision) and renders a
LIST: one card per position (attendee name, ticket type, amount, that position's own QR, that
position's own booking ref, that position's own `DownloadTicketButton`, reusing the existing
component unchanged, keyed by `bookingRef`), plus an order-level heading total (sum of
`positions[].amount`) above the list. `ConfirmationPoller`'s polling/pending/not-found states are
UNCHANGED — it still polls `/api/tickets/status?ref=` (order-level reference resolves there too,
unaffected by this contract) and still calls `router.refresh()` on confirmation.

## F4 — `app/api/tickets/itn/route.ts` (one line — see "Sequencing risk" above)

The confirmation-email call site already accepts a `positions` ARRAY
(`lib/confirmation-email.ts`'s `sendConfirmationEmail`/`OrderConfirmation` email template are
ALREADY forward-compatible with multiple positions — this was found already built, not something
this contract adds) — today's route wraps the SINGLE position it gets in an array:
`positions: [outcome.position]`. Once the sibling contract's F3 changes
`MarkOrderPaidOutcome.committed:true`'s shape from `position: {...}` to `positions: {...}[]`, this
becomes: `positions: outcome.positions` — literally removing the `[` `]` wrapper, nothing else.
**This closes the confirmation-EMAIL gap for free** — the email template already loops over
`positions` and generates one QR per position; it was simply never handed more than one. No change
to `lib/confirmation-email.ts` or `emails/OrderConfirmation.tsx` is needed or in scope.

---

## What this contract does NOT assert — and why (per the architect brief's explicit instruction:
## "a grep for a Tailwind class is not evidence a page renders")

Every assertion in `contracts/contract-ticketing-multi-line-item-cart-ui.yaml` is a behavioural
test of a PURE function or a fake-store-backed data function — never a source grep, never a
rendered-output string match. The following properties are genuinely visual/interactive and are
**deliberately left unasserted here**, named instead as a manual/BrowserAgent verification
checklist for @qa, per this project's own standing rule (BrowserAgent at 1440/375/320 — contract
greps cannot see a rendered page, and this project has shipped a green gate over invisible input
fields before):

1. **The quantity steppers render, are keyboard-operable, and visibly disable at `soldOut`** —
   at all three breakpoints (1440/375/320).
2. **The running total visibly updates as quantities change**, and the attendee-field rows
   appear/disappear to match the cart's current item count (add a second Early-Bird ticket ->
   a second Early-Bird attendee row appears; remove it -> the row disappears without losing the
   OTHER rows' already-entered data).
3. **The pre-redirect amount display genuinely reads the checkout response's `fields.amount`**,
   not a stale client estimate — best proven by comparing the number shown on this page against
   the amount PayFast's own hosted sandbox page shows immediately after redirect, for a cart whose
   estimate and server total happen to differ (achievable by editing a ticket type's Sanity price
   between page load and submit in a manual test).
4. **The confirmation page renders one card per position**, each with its own correct QR
   (visually distinct, scannable) and its own working download button, for a real multi-item
   order — end-to-end through a real (sandbox) PayFast payment, not just the data layer A5 proves.
5. **Mobile-first layout from 320px** — every interactive element (steppers, attendee fields,
   submit button, download buttons) has a visible label, a role, and a keyboard handler, per this
   project's coding standard.

---

## Assertion inventory and defeating mutations

| ID | Proves | Kind | Negative control |
|----|--------|------|-------------------|
| A1 | Whole project type-checks after all changes | `pnpm type-check` | N/A — build-level gate |
| A2 | `computeCartTotal`/`cartItemCount` price ONLY from the `types` array handed to them, no hidden second price source; free/zero-qty/unknown-slug edge cases | behavioural, pure fn | case (2): changing a price in `types` must change the total — the harness's core proof that no second price table exists |
| A3 | `buildLineItemsFromCart` expands deterministically, pairs each unit with its own attendee row, throws loudly on a row-count mismatch | behavioural, pure fn | case (9): mismatched row count must throw — proves the harness can detect a real defect, not just echo valid input |
| A4 | `getConfirmedOrderForDisplay` returns EVERY paid position of a multi-position order, fails closed on an unpaid order | behavioural, fake Firestore-shaped store | case: an unpaid ('reserved') order must resolve to null — proves the status gate still holds, same posture as the existing single-position function |
| A5 | `pnpm lint` passes with zero errors | lint | N/A — build-level gate |

## Red evidence — observed 2026-08-20, against the unmodified tree

- **A2/A3** (`check-cart-total-and-expansion.mjs`): `npx tsx
  contracts/checks/ticketing-multi-line-item-cart-ui/check-cart-total-and-expansion.mjs`, **exit
  1** — `ERR_MODULE_NOT_FOUND` for `lib/cart.ts` (does not exist on the current tree). Expected
  form of red for a file that does not exist yet.
- **A4** (`check-confirmation-shows-all-positions.mjs`): `npx tsx
  contracts/checks/ticketing-multi-line-item-cart-ui/check-confirmation-shows-all-positions.mjs`,
  **exit 1** — module-resolution error, `getConfirmedOrderForDisplay` does not exist on the
  current `lib/orders.ts`. Same expected form of red.
- **A1**/**A5**: no new baseline captured beyond the sibling contract's own (unmodified tree,
  `pnpm type-check` exit 0, `pnpm lint` exit 0 with 0 errors) — this contract adds no build-level
  regression risk of its own until @dev's edits land.

All red evidence was produced with `npx tsx` only, against fake in-memory stores or pure
functions — **no live Firestore, no Sanity, no network call, no browser was used in the production
of any assertion in this contract.** Items 1-5 above are named exactly because they need one, and
are left to @qa/BrowserAgent rather than faked here.

## Mutation-discrimination pass — 2026-08-20, against @dev's real implementation

The above (`MODULE_NOT_FOUND`) proves each check RUNS; it does not prove either check
DISCRIMINATES a real property violation. Once the cart UI implementation landed, every claimed
property was broken one at a time in the real `lib/cart.ts`/`lib/orders.ts`, confirmed red for the
correct reason, reverted, and reconfirmed green — `diff` against a pre-mutation backup after every
revert to prove zero residue. Two mutations survived unnoticed on the FIRST attempt; both are real
gaps, both are now closed (the fixes are already reflected in the check-script bodies above, not a
separate patch).

**Confirmed-discriminating (no check-script change needed):**

- `computeCartTotal`'s "no hidden price source" claim: inserted a hardcoded `'early-bird': 130`
  fallback into the price map → red (`(2) CORE PROOF FAILED`). Reverted → green.
- `buildLineItemsFromCart`'s "throws on a mismatched attendee-row count" claim: replaced the throw
  with silent padding → red (`(9) ... must throw`). Reverted → green.
- `getConfirmedOrderForDisplay`'s "returns EVERY position" claim: reintroduced `.limit(1)` on the
  position query → red (only 1 of 3 positions returned). Reverted → green.
- `getConfirmedOrderForDisplay`'s "each position carries its OWN QR" claim: passed the shared
  `reference` instead of each position's own `bookingRef` to `generateQrDataUri` → red (2 of 3
  positions flagged with a shared QR). Reverted → green.

**Gap 1 — found and closed: `cartItemCount`'s zero/negative-quantity filter was unverified.**
Removing the `quantity > 0` guard entirely (summing every quantity unconditionally) did NOT turn
the check red — every existing test case used only non-negative quantities, so filtering and not
filtering produced identical sums. Closed by adding case (6c): a cart containing a genuinely
negative quantity (`vip: -2`, defensively — a UI state that should be unreachable, e.g. a stepper
decremented past zero by a race), asserting it does not subtract from the count. Re-ran the same
mutation afterward: now red (`expected 3, got 1`). Reverted the mutation → green.

**Gap 2 — found and closed: the fail-closed control did not isolate the ORDER-level status gate
from the POSITION-level status filter.** The original control used an order with `status:
'reserved'` whose one position ALSO carried `status: 'reserved'`. Deleting the order-level
`order?.status !== 'paid'` guard entirely still returned `null` — via the unrelated "zero
confirmed positions after filtering" branch, since the position's own status independently failed
the position-level filter. The check passed even with the order-level gate completely removed: a
neighbouring guard produced the same visible outcome, masking the deleted one — the exact "checks
the wrong branch" shape this project's own `learned.md` already warns about. Closed by adding an
isolation case: an order with `status: 'reserved'` whose position carries `status: 'paid'` (a
data-inconsistency scenario that should not occur in practice, but is what's needed to separate
the two guards) — if the order-level gate is present, this must still resolve to `null`; if it is
missing, the paid position leaks through. Re-ran the deletion mutation afterward: now red. Reverted
the mutation → green.

All mutations were applied directly to the real `lib/cart.ts`/`lib/orders.ts` (not a stub), one at
a time, and every revert was verified with `diff` against a pre-mutation backup copy showing zero
residue — confirmed identical output both times. `pnpm type-check` stayed green throughout (no
mutation left a type error masking a runtime one). `git status --short` after the full pass shows
no file changed by this exercise other than the two check scripts under `contracts/checks/` — see
their own headers for the added cases.
