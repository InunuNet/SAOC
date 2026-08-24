# ozow-sandbox-toggle F1 — decision record

Mission: `.agent/memory/project/missions/2026-08-24-ozow-sandbox-toggle.md`, feature F1, tier
apex. Replaces the manual-Sanity-price-edit workaround used during ozow-payment-provider F3/F4
(Brad hand-editing live ticket prices to R0.01 before a council demo, then reverting) with a
safe, reversible, admin-controlled flag.

## 1. Storage mechanism chosen: Firestore doc, not env var

**Decision:** a single Firestore document at `adminSettings/ozowSandboxTestMode`, shape:

```
{ enabled: boolean, updatedAt: Timestamp, updatedByEmail: string }
```

**Why not an env var:** Firebase App Hosting env vars require a redeploy to change. Brad's
stated need is flipping this live, mid-demo, in front of the council — a redeploy is not "live."
Every other piece of admin-mutable runtime state in this project (order status, vendor
submission review state, check-in records) already lives in Firestore, written through an
`/api/admin/*` route gated by `lib/admin-auth.ts`. A Firestore doc is the only mechanism
consistent with that existing pattern and the only one that is toggleable without a deploy.

**Why a single doc, not a field on an existing collection:** this flag is a piece of global
payment configuration, not a property of any one order, ticket type, or show. It doesn't belong
on `orders`, `tickets`, or `nationalShows` docs. A new small `adminSettings` collection (one doc
per named setting, this feature adds exactly one: `ozowSandboxTestMode`) keeps it addressable on
its own and leaves room for future settings without overloading an unrelated collection.

**Exact field:** `enabled` (boolean). Read with **strict** `=== true` — no truthy-string
shortcut, no `Boolean(value)` coercion. Every other value (missing doc, missing field, `'true'`
as a string, `1`, `null`, anything except the literal boolean `true`) reads as **not enabled**.
This project has hit exactly this defect class before (mapStatus, confirmNotification's IsTest
param) — strict equality against a fixed literal is the established house style for any
flag/enum read off external or admin-mutable state.

## 2. Fail-closed contract

`isOzowSandboxTestModeEnabled()` (new file `lib/ozow-sandbox-test-mode.ts`) returns `false` on
every one of: doc does not exist, `enabled` field absent, `enabled` is not the literal boolean
`true`, the Firestore read throws (network error, permission error, malformed data), or any other
unexpected shape. There is no code path in this helper that returns `true` except the doc
existing with `enabled === true` read successfully. This is what "OFF by default" and "must fail
closed" (mission brief) mean operationalised: the function has exactly one way to say yes and
every other outcome — including every error — says no.

## 3. Where the override is applied: initiate() input only, nothing upstream or downstream

**Decision:** a second pure function, `resolveOzowInitiateAmount(providerId, realAmountFormatted,
testModeEnabled)`, lives in the same file. It is a pure function (no I/O) that returns:

- `realAmountFormatted` unchanged, byte-identical, when `providerId !== 'ozow'` (any value,
  including `'payfast'`) — regardless of `testModeEnabled`.
- `realAmountFormatted` unchanged, byte-identical, when `providerId === 'ozow'` and
  `testModeEnabled === false`.
- the fixed string `'0.01'` when `providerId === 'ozow'` and `testModeEnabled === true` —
  regardless of what `realAmountFormatted` was.

`app/api/tickets/checkout/route.ts` calls this immediately before its existing
`paymentProvider.initiate({...})` call (around line 751) and passes the **result** as
`amountFormatted` into `initiate()` only. Every other use of the route's own `amountFormatted`
local — the value passed into `reserveTicket()`'s transaction (which is what actually becomes
`order.amount` in Firestore), and the value echoed back in the JSON response's own top-level
`amount` field (line ~797, "the same `amountFormatted` string already passed into
paymentProvider.initiate() above, not re-derived") — **must keep referencing the original,
un-overridden `amountFormatted`**, not the resolved/overridden value. This is why the override
is a separate variable (e.g. `initiateAmountFormatted`), not a reassignment of `amountFormatted`
itself: reassigning it would leak the override into the order record and the response echo,
exactly the "reconciliation/refunds must still reference the true amount" failure the mission
brief rules out.

**Exact variable name mandated (not a stylistic suggestion):** the resolved value MUST be bound
to a new local named `initiateAmountFormatted`, and `paymentProvider.initiate({...})`'s
`amountFormatted:` field MUST be `initiateAmountFormatted`, never the bare `amountFormatted`
identifier. `reserveTicket(...)`'s input and the JSON response's own `amount:` field MUST keep
using the original `amountFormatted` identifier. This is checked by source position/identifier,
not by behaviour alone — see A3 in the contract — because a black-box test of the route would
need a live Firestore transaction to observe `order.amount`, which this project's checks avoid
(README §7).

This keeps the entire feature inside one already-tested seam: `InitiateInput.amountFormatted` is
documented as "the caller owns formatting" (`lib/payments/types.ts`), and neither
`lib/payments/ozow.ts` nor `lib/payments/payfast.ts` needs to change at all — they already just
forward whatever `amountFormatted` they're given. PayFast's call site is untouched entirely
(`resolveOzowInitiateAmount` returns its input unchanged for any non-`'ozow'` providerId), which
is what makes the PayFast/OFF byte-identical invariant provable as a property of one pure
function rather than a promise about a large route file.

## 4. Admin surface: new capability, owner-only

**Decision:** add `'manage-payment-settings'` to `lib/admin-roles.ts`'s `CAPABILITIES` array.
Per that file's own documented pattern, `owner`'s capability set is *derived*
(`new Set(CAPABILITIES)`), so owner gains this automatically with no hand-edit; `manager`'s set
is deliberately *hand-listed* (the file's own comment explains why: "A derived manager would
silently gain any capability added to CAPABILITIES in future"). This feature does **not** add
`'manage-payment-settings'` to manager's hand-listed set — toggling a flag that changes what a
real payment gateway charges is owner-tier, not day-of-show-desk-staff tier, same risk class as
`issue-refund`.

`app/api/admin/settings/ozow-sandbox-test-mode/route.ts` (new): `GET` and `PUT`, both gated
`getAdminSession()` → `hasCapability(decodedToken, ..., 'manage-payment-settings', ...)`, same
call shape as `app/api/admin/vendors/route.ts`. `PUT` body must be exactly `{ enabled: boolean }`
— anything else (missing field, non-boolean, extra fields tolerated) is a 400, never coerced.

`app/api/tickets/ozow-sandbox-test-mode/route.ts` (new, **not** admin-gated): a public `GET`
returning `{ enabled: boolean }`, used by the checkout page to decide whether to render the
banner. This is deliberately public and unauthenticated — the flag's *state* is not a secret (any
buyer is about to see the banner itself if it's on), only the ability to *change* it is
privileged. It reuses `isOzowSandboxTestModeEnabled()` and never returns a non-200 — a Firestore
read failure here must fail closed to `{ enabled: false }`, not surface an error to a buyer
mid-checkout.

## 5. Banner text is a shared constant, not a UI-local string literal

`OZOW_SANDBOX_TEST_MODE_BANNER_TEXT` is exported from `lib/ozow-sandbox-test-mode.ts`:

```
TEST MODE — Ozow charges R0.01 instead of the displayed price
```

The checkout UI component (file left to @dev — likely `components/tickets/` or
`app/(marketing)/tickets/`) imports this constant rather than hardcoding the string, so the
banner copy and the module that decides when to show it can never drift apart.

## 3b. Amount-match on notification — REVISED 2026-08-24 (Codex GPT-5.5 cross-model review)

**The gap §6 originally waved off as "out of scope" is actually feature-breaking and is now
in scope.** Codex's mandatory review (`.claude/rules/workflow.md`) of the first implementation
found: `paymentProvider.initiate()` is correctly sent `'0.01'` in test mode (§3 above), but
`lib/tickets-notification.ts`'s shared amount-match step (`AMOUNT_MATCH_TOLERANCE_CENTS`, ~line
148-175) compares the gateway's reported `grossAmountCents` against
`Math.round(order.amount * 100)` — and `order.amount` is, correctly per §3, still the REAL
ticket price. So a test-mode buyer pays R0.01 at Ozow, Ozow's notification reports
`grossAmount = 0.01`, the amount-match guard sees `0.01` vs the real price, rejects the
notification, and the order never reaches `paid`. This defeats the entire point of the
feature — Brad could not complete a demo purchase in test mode. §6's old bullet ("existing
amount-reconciliation behaviour ... is out of scope for F1") is **wrong and superseded by this
section.**

**Decision: a new order-only field, `expectedGatewayAmount: number | null`, records what we
actually told the gateway to expect — separately from `amount`, which keeps recording the real
price unconditionally, exactly as §3 already mandates.**

- `null` (the default, and the ONLY value for PayFast and for Ozow with the flag off) means
  "compare the notification against `order.amount`, unchanged" — byte-identical to pre-F1
  behaviour whenever this feature isn't actively overriding anything.
- A non-null value (currently only ever `0.01`, for an Ozow order created while the flag was
  on) means "compare the notification against THIS number instead of `order.amount`."

This is deliberately NOT a weakening of the amount-match guard's fraud-prevention purpose: it
still rejects any notification whose reported amount doesn't match what we actually told the
gateway to expect. It only changes *what number* that comparison is made against, for the one
narrow case where we ourselves told the gateway to expect something other than the real price.

**New pure function**, same file, same testable-with-zero-I/O style as `resolveOzowInitiateAmount`:

```ts
export function resolveExpectedGatewayAmount(
  providerId: string,
  testModeEnabled: boolean,
): number | null {
  if (providerId === 'ozow' && testModeEnabled) return Number(OZOW_SANDBOX_TEST_AMOUNT);
  return null;
}
```

Mirrors `resolveOzowInitiateAmount`'s branching exactly (same two inputs that matter, same
`'ozow' && testModeEnabled` condition) so the two functions can never disagree about *when* the
override applies — only about *what value* each one returns for the overridden case (the wire
string `'0.01'` for `initiate()`, the number `0.01` for the stored expectation). `realAmount`
is deliberately NOT a parameter — the override is the fixed constant regardless of the real
price, same invariant §3/A2 already established for `resolveOzowInitiateAmount`, and taking it
as an unused parameter would let a future edit accidentally wire in `realAmount` and reintroduce
this feature's own gap.

**Checkout route ordering (revised):** `isOzowSandboxTestModeEnabled()` is now read ONCE,
**before** `reserveTicket()` is called (moved up from its current position, which is after
`outcome` is already known). The single resulting boolean feeds BOTH
`resolveExpectedGatewayAmount(providerId, ozowSandboxTestModeEnabled)` — passed into
`reserveTicket()`'s input as a new `expectedGatewayAmount` field, written onto the order
document inside the SAME transaction as the rest of the reservation (same category as
`gateway`: threaded through `ReservationInput` → `buildMultiReservationDocs` →
`writeMultiReservationPair`, order-only, not duplicated onto the position) — AND
`resolveOzowInitiateAmount(providerId, amountFormatted, ozowSandboxTestModeEnabled)` for the
`initiate()` call, exactly as §3 already specified. One read, one boolean, two pure functions,
both consulted — this is what guarantees the order's stored expectation and what we actually
sent the gateway can never disagree, instead of relying on two independent Firestore reads of a
flag that could theoretically change between them.

**`findReservedOrderByPaymentId`** (`lib/orders.ts`) gains `expectedGatewayAmount: number | null`
on its `'reserved'` result variant, read straight off the order doc's own field (defaulting to
`null` for any order written before this field existed, or any non-Ozow/flag-off order — same
"missing means real behaviour" posture as every other fail-closed flag in this project).

**`lib/tickets-notification.ts` step 7 (amount match)** changes from comparing against
`lookup.amount` unconditionally to comparing against `lookup.expectedGatewayAmount ??
lookup.amount`. Every existing case (PayFast, Ozow flag off, any order written before this
field existed) has `expectedGatewayAmount === null` and falls through to `lookup.amount`
unchanged — byte-identical to today's rejection/acceptance behaviour. Only a test-mode Ozow
order, whose stored `expectedGatewayAmount` is `0.01`, now correctly accepts the gateway's
`0.01` notification.

This comparison is extracted into a new **exported** pure function in the same file:

```ts
export function notificationAmountMatches(
  lookup: { amount: number; expectedGatewayAmount?: number | null },
  grossAmountCents: number | null,
): boolean {
  const expectedAmount = lookup.expectedGatewayAmount ?? lookup.amount;
  const expectedAmountCents = Number.isNaN(expectedAmount) ? null : Math.round(expectedAmount * 100);
  if (grossAmountCents === null || expectedAmountCents === null) return false;
  return Math.abs(grossAmountCents - expectedAmountCents) < AMOUNT_MATCH_TOLERANCE_CENTS;
}
```

Step 7 in `POST()` becomes a thin call to this function (`if (!notificationAmountMatches(lookup,
grossAmountCents)) { ...reject... }`); the tolerance constant and the null/NaN guards move inside
it unchanged, not duplicated. Extracting it is what lets A9 test the actual comparison logic
offline, against a plain constructed object, without needing a live Firestore transaction or the
rest of the eleven-step handler.

## 3c. Replay uses the order's OWN stored expectation, never a fresh flag re-read — REVISED 2026-08-24 (Codex GPT-5.5 second cross-model review)

**The gap:** §3b fixed the amount-match rejection for a genuinely NEW reservation, but the
checkout route's handoff code (`isOzowSandboxTestModeEnabled()` at what was line ~696,
`resolveOzowInitiateAmount`/the amount sent to `paymentProvider.initiate()` at what was line
~770) re-reads the flag's CURRENT state regardless of whether `outcome.kind` is `'created'` or
`'replayed'`. A replay (idempotency-key retry — browser back-button, network retry, or the flag
being flipped mid-demo between the original request and a retried one) re-derives the initiate()
amount from *today's* flag state, not from what was actually stored on the order at creation
time. If the flag changed in between, the amount handed to `paymentProvider.initiate()` can
disagree with the order's own stored `expectedGatewayAmount` — and
`notificationAmountMatches()` (§3b) then compares the gateway's real notification against the
WRONG expectation, either wrongly rejecting a legitimate payment or wrongly accepting a
mismatched one.

**Decision: `resolveOzowInitiateAmount` stops taking `(providerId, testModeEnabled)` and instead
takes the ALREADY-RESOLVED `expectedGatewayAmount` directly — the same value that is, or will
be, stored on the order. There is now exactly one call in the whole request that ever asks "is
the flag on" —** `resolveExpectedGatewayAmount(providerId, ozowSandboxTestModeEnabled)`, called
once, before `reserveTicket()`, feeding ONLY the order write for a brand-new reservation. Every
other consumer of "what amount does the gateway expect" — for both a new reservation AND a
replay — reads it back off the `ReservationOutcome`, never re-derives it.

**Revised signature** (same file, `lib/ozow-sandbox-test-mode.ts`):

```ts
export function resolveOzowInitiateAmount(
  expectedGatewayAmount: number | null,
  realAmountFormatted: string,
): string {
  if (expectedGatewayAmount === null) return realAmountFormatted;
  return OZOW_SANDBOX_TEST_AMOUNT;
}
```

`providerId` and `testModeEnabled` are removed as parameters. The "PayFast is never affected"
and "Ozow with the flag off is never affected" invariants are now proven one level up, by
`resolveExpectedGatewayAmount` always returning `null` for those cases — this function only ever
has to answer "override or not" given a value that already encodes that decision, and it can
never independently disagree with what got stored on the order, because for a new reservation
both come from the exact same `resolveExpectedGatewayAmount(...)` call, and for a replay both
come from the exact same stored field.

**`ReservationOutcome`** (`app/api/tickets/checkout/route.ts`) gains `expectedGatewayAmount:
number | null` on BOTH the `'created'` and `'replayed'` variants:

- `'created'`: sourced from `input.expectedGatewayAmount` — the SAME value already written onto
  the order in this same transaction (previously threaded through to
  `buildMultiReservationDocs` but never also returned in the outcome object itself). No new
  computation; this is purely surfacing a value the transaction already had.
- `'replayed'`: sourced from the EXISTING order's own stored field —
  `(orderData['expectedGatewayAmount'] as number | null | undefined) ?? null` — read off the
  same `orderData` already fetched earlier in the replay branch for the status/expiry/gateway
  checks (§ "Rule 2"/"Rule 3" in `reserveTicket()`). This is the order created by the ORIGINAL
  request, at whatever flag state was true THEN — never re-derived from the flag's state now.

**Checkout route handoff (revised):** the `isOzowSandboxTestModeEnabled()` read stays exactly
where it is (before `reserveTicket()`, feeding `resolveExpectedGatewayAmount` for the
`reserveTicket()` input) — but it is now used for THAT ONE PURPOSE ONLY. The initiate() amount
is computed after `outcome` is known, as:

```ts
const { reference, amount, positions, expectedGatewayAmount } = outcome;
const amountFormatted = amount.toFixed(2);
// ...
const initiateAmountFormatted = resolveOzowInitiateAmount(expectedGatewayAmount, amountFormatted);
```

`ozowSandboxTestModeEnabled` (the fresh-read local) must not appear anywhere in or after the
`paymentProvider.initiate(...)` call construction — its only remaining use is the
`resolveExpectedGatewayAmount(...)` call that feeds `reserveTicket()`'s input, textually before
the reservation transaction. This is what guarantees a replay can never see a different amount
than the one already committed to its order: there is no second flag read for it to disagree
with.

**Everything already fixed by §3b stays true:** `order.amount` is still always the real price
unconditionally; PayFast is still fully unaffected (its orders' `expectedGatewayAmount` is
always `null`, both freshly and when replayed); OFF-by-default/fail-closed is unchanged;
`notificationAmountMatches()` is unchanged by this revision — it already reads whatever is
stored on the order, and this fix is entirely about making sure the INITIATE call and the
STORED value can never disagree in the replay case, upstream of that comparison.

## 3d. Client/server module split — REVISED 2026-08-24 (Codex GPT-5.5 third cross-model review)

The original `lib/ozow-sandbox-test-mode.ts` mixed pure, zero-dependency constants/functions
(`OZOW_SANDBOX_TEST_MODE_BANNER_TEXT`, `resolveOzowInitiateAmount`,
`resolveExpectedGatewayAmount`, the collection/doc-id constants) with `isOzowSandboxTestModeEnabled()`,
which has a top-level `import { getFirestore } from 'firebase-admin/firestore'`. Codex's third
review found that `components/tickets/OzowSandboxTestModeBanner.tsx` — a `'use client'` component
— imports `OZOW_SANDBOX_TEST_MODE_BANNER_TEXT` from that same module, so Next's client bundler
pulls the server-only Firebase Admin SDK into the browser bundle. This breaks the production
build; Firebase Admin is not meant to run in the browser.

**Fix: split into two files.**

- **NEW `lib/ozow-sandbox-test-mode-shared.ts`** — client-safe, zero server-only imports. Exports:
  `OZOW_SANDBOX_TEST_MODE_COLLECTION`, `OZOW_SANDBOX_TEST_MODE_DOC_ID`,
  `OZOW_SANDBOX_TEST_MODE_BANNER_TEXT`, `resolveOzowInitiateAmount`, `resolveExpectedGatewayAmount`.
  The `OZOW_SANDBOX_TEST_AMOUNT` constant these last two close over moves here too (stays
  unexported — internal to the module, same as before).
- **`lib/ozow-sandbox-test-mode.ts`** — keeps only `isOzowSandboxTestModeEnabled()`, the one
  function that actually touches Firestore. Imports `OZOW_SANDBOX_TEST_MODE_COLLECTION` /
  `OZOW_SANDBOX_TEST_MODE_DOC_ID` from the shared module, and re-exports the full shared module's
  surface (`export * from './ozow-sandbox-test-mode-shared'`) so every existing SERVER-SIDE
  importer (`app/api/tickets/checkout/route.ts`, `app/api/admin/settings/ozow-sandbox-test-mode/route.ts`,
  `app/api/tickets/ozow-sandbox-test-mode/route.ts`) keeps importing everything — both the pure
  functions and `isOzowSandboxTestModeEnabled` — from `@/lib/ozow-sandbox-test-mode` unchanged.
  Only client components are required to import from the `-shared` module directly.
- **`components/tickets/OzowSandboxTestModeBanner.tsx`** — imports `OZOW_SANDBOX_TEST_MODE_BANNER_TEXT`
  from `@/lib/ozow-sandbox-test-mode-shared`, never from `@/lib/ozow-sandbox-test-mode`. This is
  the actual fix: the client bundle now only ever reaches the shared module, which has no
  server-only import for webpack to follow.

This is a pure file split with a re-export shim — no behavioural change to any function. A2 and
A8 (which test the two pure functions directly) now import from the `-shared` module rather than
through the re-export, so they exercise the functions at their real, post-split location. A1
(which tests `isOzowSandboxTestModeEnabled`) is unaffected — that function did not move. A7's
banner-usage grep is widened to also match an importer of the `-shared` module. A new assertion,
A11, statically proves the `-shared` module never regains a server-only import.

## 3e. `Order.expectedGatewayAmount` must be optional, not required — REVISED 2026-08-24 (Codex GPT-5.5 fourth cross-model review)

**The bug:** `types/index.ts:227` originally added `expectedGatewayAmount: number | null` (no
`?`) as a REQUIRED field on `Order`. This breaks every pre-existing typed `Order` literal from
OTHER, already-shipped missions that construct an `Order` object without this field —
concretely, `contracts/checks/ticketing-f5-buyers/fixtures/buyers-typecheck.ts`'s `legacyOrder`
literal (lines 45-59), whose own comment explains it exists specifically to prove a
pre-F5-shaped `Order` still compiles without the newer optional field. `claimedOrder` and
`unclaimedOrder` in the same file spread from `legacyOrder` and fail for the same underlying
reason. A required field on a shared type is a breaking change to every earlier feature that
typed an `Order` literal, not just this one's own code.

**Fix: follow the `buyerUid?:` precedent already on the same type.** `Order.buyerUid` (added by
ticketing-f5-buyers) is deliberately optional — see the comment at
`contracts/checks/ticketing-f5-buyers/fixtures/buyers-typecheck.ts:43-44` — for exactly this
reason: older typed fixtures must keep compiling without being edited every time a later mission
adds a field to `Order`. `expectedGatewayAmount` follows the identical pattern:

```ts
expectedGatewayAmount?: number | null;
```

**Why this is safe against every site that actually reads the field:** widening a field from
required to optional never breaks a *reader* that already handles absence — and every read site
in this feature's own code already does:

- `lib/orders.ts`'s `findReservedOrderByPaymentId` reads the Firestore doc as `Partial<Order>`
  and returns `order?.expectedGatewayAmount ?? null` (lib/orders.ts:249) — already
  nullish-coalesced, unaffected by widening.
- `lib/tickets-notification.ts`'s `notificationAmountMatches` takes
  `lookup: { amount: number; expectedGatewayAmount?: number | null }` — already typed optional at
  its own call boundary, independent of `Order`'s declaration.
- `lib/checkout-reservation.ts` (`buildMultiReservationDocs`, lib/checkout-reservation.ts:281) and
  `lib/orders.ts`'s F8 order-creation primitive (lib/orders.ts:139) both always WRITE the field
  explicitly (`input.expectedGatewayAmount` / `null`), so their output objects satisfy the field
  regardless of whether the type marks it required or optional — `orderBody: Omit<Order, 'id'> =
  docs.order` in `contracts/checks/ticketing-multi-line-item-cart/fixtures/multi-line-item-typecheck.ts`
  is unaffected because `docs.order` genuinely carries the field, not because of this type change.

**Blast radius checked:** every `: Order =` literal in the repo (`grep -rn "Order = {" --include
"*.ts" --include "*.tsx"`, excluding `node_modules` and stray worktree copies) was enumerated.
Only `buyers-typecheck.ts`'s three related consts (`legacyOrder`, `claimedOrder`,
`unclaimedOrder`) construct a genuinely field-omitting `Order` literal; no other typecheck
fixture in `contracts/checks/*/fixtures/` does. `fictional-test-show-typecheck.ts` uses an
unrelated `RecoverableOrder` type (from `lib/fictional-test-show-recoverability.ts`), not
`types/index.ts`'s `Order` — not affected either way.

A new assertion, A12, statically proves `expectedGatewayAmount` stays declared with `?` in
`types/index.ts`, mirroring A11's static-grep technique for §3d.

## 6. What this feature does NOT touch

- `lib/payments/ozow.ts` and `lib/payments/payfast.ts` — zero changes. Both adapters already
  just forward `amountFormatted` verbatim.
- `lib/payments/types.ts` — the `PaymentProvider`/`InitiateInput` interface is unchanged.
- `order.amount` — still always the real price, unconditionally, for every gateway and every
  flag state. Reconciliation/refunds keep reading it exactly as before.
- `verifyNotification()` / `confirmNotification()` — untouched; only the amount-match comparison
  target inside the shared notification handler changes, per §3b above, and only because §3b
  found the original "out of scope" call was wrong, not because the scope grew for its own sake.
- `docs/payment-seam.md` — flagged for @docs to update once this ships, replacing the
  manual-Sanity-price-edit description of the ozow-payment-provider F3/F4 workaround, and now
  also documenting `expectedGatewayAmount`.

## 7. Assertion strategy

All three pure/near-pure functions (`isOzowSandboxTestModeEnabled`, `resolveOzowInitiateAmount`,
`resolveExpectedGatewayAmount`) are designed to be testable with **zero live network or live
Firestore calls** — the same
deps-injection pattern this project already uses for `createOzowProvider()`
(`contracts/checks/ozow-m1-f4/check-confirm-notification-istest-param.mjs`). The checkout-route
wiring and the admin-route auth gate are proven by source-position checks (grep/regex over the
committed file), the same technique
`contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh` already uses in
this repo to prove a guard exists before a write, without needing a live Firestore transaction in
the test harness.
