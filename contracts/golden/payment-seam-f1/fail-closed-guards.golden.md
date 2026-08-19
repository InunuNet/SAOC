# Fail-closed guards — exact status codes and refusal shapes, as they are TODAY

Captured 2026-08-19 from `app/api/tickets/checkout/route.ts` and `app/api/tickets/itn/route.ts`
before any code moved. F1 does not change any of these — this file exists so that (a) the adapter's
`reason` codes map onto them unambiguously, and (b) F2's rewiring has something byte-exact to be
held to when the refusals start being produced from a provider result instead of an inline `if`.

---

## Checkout — missing merchant credentials

Source: `checkout/route.ts:307-320`.

```
const merchantId  = process.env.PAYFAST_SANDBOX_MERCHANT_ID;
const merchantKey = process.env.PAYFAST_SANDBOX_MERCHANT_KEY;
if (!merchantId || !merchantKey) { ...console.error...; return 500 }
```

| Property | Exact value |
|---|---|
| HTTP status | `500` |
| Body | `{"error":"Payment gateway is not configured. Please try again later."}` |
| Log line | `[tickets/checkout] Missing PAYFAST_SANDBOX_MERCHANT_ID or PAYFAST_SANDBOX_MERCHANT_KEY env var.` |
| Falsiness | `!merchantId` — empty string counts as missing, same as unset |
| Position | **Before** `reserveTicket()`, i.e. before any Firestore write |

Adapter mapping: `initiate()` → `{ ok: false, reason: 'not-configured' }`.

**Post-F2 this guard is `readiness('initiate')`, called before `reserveTicket()`.** The position
above is the load-bearing half of the guard and survived a challenge: F2's first form moved the
refusal after the reservation write, because `initiate()` cannot be called before the booking
reference exists. That was rejected — see `interface.golden.md`, "`readiness` — the sixth member".
The `initiate()` refusal remains as defence in depth, since config is read per call and can change
between the two.

**500 and not 4xx is deliberate** and must survive F2: the request was well-formed; the
misconfiguration is ours. A 4xx would tell the buyer to fix something they cannot see. Same
reasoning as the ticket-type capacity/price guards immediately above it.

## Checkout — missing `RECOVERY_TOKEN_SECRET`

Source: `checkout/route.ts:324-333`.

| Property | Exact value |
|---|---|
| HTTP status | `500` |
| Body | `{"error":"Ticket recovery is not configured. Please try again later."}` |
| Log line | `[tickets/checkout] Missing RECOVERY_TOKEN_SECRET env var.` |
| Position | **Before** `reserveTicket()` — an unset secret must refuse before any Firestore write, never mint a never-verifiable-again recovery token |

**This guard is NOT a payment-provider concern and must not move into `lib/payments/`** (A9). It is
also load-bearing by *source position*: `contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh`
proves it by textual position relative to the reservation write. Moving it would break another
contract's already-green gate.

## Checkout — success shape

| Property | Exact value |
|---|---|
| HTTP status | `201` on a fresh reservation, `200` on an idempotent replay |
| Body | `{ bookingRef, processUrl, fields: { ...signedFields, signature } }` |
| `processUrl` | `https://sandbox.payfast.co.za/eng/process` |
| `fields` key order | `merchant_id, merchant_key, return_url, cancel_url, notify_url, m_payment_id, amount, item_name, signature` |

A replay is **re-signed from the stored, server-derived amount** — never from a stored signature and
never from the request body.

---

## ITN — missing passphrase

Source: `itn/route.ts:121-128`.

| Property | Exact value |
|---|---|
| HTTP status | `200` (always — PayFast must stop retrying; a 200 here never implies acceptance) |
| Body | `{"received":true}` |
| Log line | `[tickets/itn] Missing PAYFAST_SANDBOX_PASSPHRASE env var — rejecting ITN` |
| Effect on order | **None.** No status change. |
| Position | Before any digest is computed |

Adapter mapping: `verifyNotification()` → `{ verified: false, reason: 'not-configured', ... }`.

Why it fails closed rather than verifying without a passphrase: `generateNotifySignature` folds the
passphrase in only when truthy, so an unset passphrase silently degrades verification to a plain
MD5 over fields (`m_payment_id`, `amount_gross`, `merchant_id`, …) that are all visible to whoever
started the checkout. Anyone could then compute a "valid" signature and POST straight to the route
to mark their own unpaid order paid. Since the source-IP check became log-only on 2026-08-18, this
guard and the server-confirm round-trip are the entire security boundary.

## ITN — the full validation sequence, in order

Every step returns HTTP 200 `{"received":true}` on failure and leaves the order untouched.

| # | Step | Adapter member (F2 will call it) |
|---|---|---|
| 1 | Passphrase present | `verifyNotification` → `not-configured` |
| 2 | Signature recomputed over posted fields in posted order, inbound algorithm | `verifyNotification` → `missing-signature` / `signature-mismatch` |
| 3 | Source IP resolved and compared to PayFast's hosts — **LOGGED, NOT ENFORCED** (2026-08-18) | `notification.sourceIpTrusted` |
| 4 | `m_payment_id` present | `verifyNotification` → `missing-reference` |
| 5 | Order lookup by `m_payment_id` (non-transactional) | **ours, stays in the route** |
| 6 | Already-settled short-circuit; non-`paid` settled states logged loudly | **ours** |
| 7 | `amount_gross` matches the reserved order's amount within `AMOUNT_MATCH_TOLERANCE = 0.01` | **ours** — provider parses the gateway's own decimal format into `grossAmountCents` (a format translation, added F2 window 2026-08-20, see `interface.golden.md` "`grossAmountCents` — the seventh field, and why"); the route still owns the comparison, the tolerance, and the accept/reject judgement |
| 8 | Server-confirm POST to `/eng/query/validate`, body must be exactly `VALID` after `.trim()` | `confirmNotification` |
| 9 | `payment_status === 'COMPLETE'` (strict, case-sensitive) | `mapStatus` → `'paid'` |
| 10 | Atomic order+position transactional write | **ours** |
| 11 | Post-commit, failure-isolated confirmation email | **ours** |

**Step 3 must stay after step 2**, and steps 8 and 9 must stay in that order and after step 7. The
seam's six members exist in the shape they do precisely so this sequence can be reproduced
unchanged in F2 — that is the whole reason `confirmNotification` is a separate member rather than
part of `verifyNotification`.

---

## Pre-existing defect found while writing this contract — FLAGGED, NOT FIXED

`app/api/tickets/itn/route.ts` currently hashes to
`a71f9505a21775425c9952dccf3e02abbe06fef0e2b58a1529cb3a2408f395d1`, but **all four** contracts that
pin it are stale:

| Golden | Pinned value | Matches file? |
|---|---|---|
| `contracts/golden/ticketing-f1-show-collision/itn-route.golden.sha256` | `253c15c4…` | no |
| `contracts/golden/ticketing-m1-m2/itn-route.golden.sha256` | `253c15c4…` | no |
| `contracts/golden/ticketing-f10-itn-repin/itn-route.golden.sha256` | `553f67d8…` | no |
| `contracts/golden/ticketing-hardening/itn-route.golden.sha256` | `553f67d8…` | no |

The drift is almost certainly the 2026-08-18 source-IP "logged, not enforced" change, which the
route's own comment documents but which was evidently never re-pinned. This is out of F1's scope and
must not be silently corrected here — a re-pin is a ceremony with an architect-authored expected
file, not an in-passing edit. **It does, however, block F2**: F2 rewires that pinned file, so the
re-pin ceremony must be planned as part of F2's contract, and whoever writes it must decide whether
the current file content is the intended baseline or whether the drift itself is an unreviewed
change. F1's A10 pins the *current* value only as a "F1 did not touch this" boundary — it is
deliberately not an endorsement of that content.
