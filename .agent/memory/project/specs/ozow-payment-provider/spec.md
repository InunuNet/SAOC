# Spec: Ozow as a second PaymentProvider

Mission: `ozow-payment-provider`. This is sandbox/test-mode engineering only — no live credentials,
no going live, PayFast's existing behaviour must not change. Written by @architect, 2026-08-21.

## 0. What was verified, and how

Alembic pulled Ozow's own public integration docs (`ozow.com/integrations`, corroborated by
`oldhub.ozow.com/docs/refunds-integration` and `api.i-pay.co.za/guide/*` search snippets — Ozow
runs two doc portals, old and new, both describing the same mechanism). One finding **corrects**
`docs/payment-gateway-research-2026-08.md`:

**Ozow's redirect/notify signing is plain SHA512, not HMAC-SHA512.** The mechanism:
1. Concatenate the post variables (a FIXED, DOCUMENTED ORDER — SiteCode, CountryCode,
   CurrencyCode, Amount, TransactionReference, BankReference, Optional1-5, Customer, CancelUrl,
   ErrorUrl, SuccessUrl, NotifyUrl, IsTest — excluding HashCheck itself), in that order.
2. Append the site's private key to the end of the concatenated string.
3. Lowercase the whole string.
4. SHA512 it.

This is the same *shape* as PayFast's scheme (concatenate ordered fields, append a shared secret,
hash) but a different digest (SHA512 vs MD5) and a different secret-placement convention (appended
at the end vs folded in as `&passphrase=...`). It is close enough to mirror `payfast.ts`'s
structure, far enough that copying its literal implementation would be wrong — confirms the
mission brief's instruction not to copy PayFast's scheme, but for a different reason than assumed
(not HMAC vs MD5 — plain-hash vs plain-hash, but different digest and concatenation convention).

**The notify/redirect response carries the same hash mechanism in reverse** (Ozow signs the
response back to us over: SiteCode, TransactionId, TransactionReference, Amount, Status,
Optional1-5, CurrencyCode, IsTest, StatusMessage — again a fixed documented order, private key
appended, lowercased, SHA512'd) — this is `verifyNotification`'s job, structurally identical to
`generateNotifySignature` in `lib/payfast.ts` but over Ozow's own field set and digest.

**Status vocabulary is a 3-value enum: `Complete` / `Cancelled` / `Error`.** There is no separate
Ozow-side "Pending" or "Failed" distinct from `Error` in the redirect/notify response — this maps
onto `PaymentStatus` as `Complete → paid`, `Cancelled → cancelled`, `Error → failed`, anything else
→ `unknown`, mirroring PayFast's `mapStatus` strict-switch shape exactly.

**Separate auth for the REST API (status polling, refunds): an `ApiKey` HTTP header**, distinct
from the SiteCode+PrivateKey hash scheme used for the redirect/notify flow. This is *why* three
sandbox credentials are staged (`OZOW_SANDBOX_SITE_CODE`, `OZOW_SANDBOX_PRIVATE_KEY`,
`OZOW_SANDBOX_API_KEY`) where PayFast only ever needed two-plus-a-passphrase: Ozow splits "prove
you're the merchant on a redirect" from "prove you're allowed to call the REST API" into two
different credential pairs, not one.

**Refunds are a real, documented API** (`oldhub.ozow.com/docs/refunds-integration`,
`api.i-pay.co.za/guide/refund`) — funded from a pre-loaded float, confirming the research doc's
float-risk finding independently. This is NOT a stub-and-refuse the way PayFast's `refund()` is
today; Ozow's refund endpoint is real and callable in sandbox. Whether to *implement* it now is
still a milestone decision below — see M1 scope.

**Not independently verified even with Alembic** (defer, do not block this mission on them):
- The exact JSON/form shape of the refund request/response body and the status-poll endpoint URL
  and response schema — search snippets describe the *existence and auth* of these endpoints, not
  their full field-level contracts. M1 must pull these from a live sandbox call (self-verifying,
  since credentials exist), not from more Alembic reading.
- Settlement timing (still three conflicting public figures, as the research doc found).
- Whether Ozow's headline percentage rates are VAT-inclusive or exclusive.
- Ozow's merchant agreement / reserve-hold clause (not published anywhere Alembic could reach).
These four are commercial/compliance questions, not engineering blockers for sandbox adapter work,
and are already tracked in `docs/payment-gateway-research-2026-08.md` §10-11 and the backlog. This
mission does not need answers to them to build and prove a sandbox adapter.

## 1. Does `PaymentProvider` (lib/payments/types.ts) hold unchanged for Ozow?

**Yes, unchanged, for every method except a documentation-only note on `refund`.** Walked through
method by method against what's now verified:

- `readiness(operation)` — holds. Ozow splits credentials by operation exactly like PayFast:
  `initiate` needs `SITE_CODE` + `PRIVATE_KEY` (used to build the outbound hash); a hypothetical
  future `verify-notification` needs the same `PRIVATE_KEY` for the inbound hash (Ozow reuses one
  secret for both directions, unlike PayFast's separate passphrase — but that's an adapter-internal
  detail, not an interface problem: `requiredKeysFor()` can still return two different key lists,
  they just happen to overlap by one name). `refund`/status-poll need `API_KEY` additionally, but
  `ProviderOperation` deliberately excludes `refund` from readiness already (see types.ts:98) —
  holds without change.
- `initiate(input)` — holds. `InitiateInput`'s five fields (`reference`, `amountFormatted`,
  `itemName`, `returnUrl`, `cancelUrl`, `notifyUrl`) map cleanly: `reference→TransactionReference`,
  `amountFormatted→Amount`, `itemName` has no direct Ozow field (Ozow has no line-item-name concept
  in the post — it's fine, PayFast's `item_name` was always ours to choose what to send, and Ozow
  simply doesn't consume an equivalent; the adapter drops it, which is a legitimate no-op, not a
  missing field). `cancelUrl→CancelUrl`, `notifyUrl→NotifyUrl`. Ozow additionally *requires*
  `SuccessUrl`, which `InitiateInput` doesn't carry — but `returnUrl` (PayFast's field name) is
  exactly that "come back here on success" URL; the adapter maps `input.returnUrl→SuccessUrl`. No
  interface change: this is the adapter choosing which Ozow field its generic input feeds, same
  as PayFast choosing `return_url`.
  One real gap: Ozow's outbound POST needs `CountryCode` (`ZA`) and `CurrencyCode` (`ZAR`) —
  constants, not caller input, same category as PayFast's `PAYFAST_SANDBOX_PROCESS_URL`. These
  belong in `lib/ozow.ts` (mirroring `lib/payfast.ts`) as adapter-owned constants, not new
  `InitiateInput` fields.
  `InitiateResult.fields` stays `Record<string,string>` in signature order — Ozow's hash order is
  just a different fixed order than PayFast's, which the interface already treats as opaque.
- `verifyNotification(request)` — holds. `ProviderNotification`'s shape fits: `reference` from
  `TransactionReference`, `rawStatus` from `Status`, `grossAmount`/`grossAmountCents` from `Amount`
  (Ozow's `Amount` is already `Decimal(9,2)` textual form — the same `parseAmountToCents`-shaped
  string-to-cents translation PayFast needed applies verbatim, new implementation, same category),
  `gatewayPaymentId` from `TransactionId`. `sourceIp`/`sourceIpTrusted` — Ozow's docs don't publish
  a fixed notification-source IP/host list the way PayFast does (`PAYFAST_ITN_HOSTS`); the adapter
  returns `sourceIp` from the request and `sourceIpTrusted: null` always (interface already allows
  `null` = "could not be determined", and the ITN route already treats `null` as advisory-only —
  zero route changes needed for a provider that can never populate this field).
- `confirmNotification(notification)` — holds, but the interface's own doc comment ("out of band
  from the webhook body") describes PayFast's server-confirm semantics loosely enough to cover
  Ozow's actual mechanism too: Ozow's own docs recommend calling the REST status-check endpoint
  (`ApiKey`-authed) after receiving a notification, to re-confirm server-side rather than trust the
  posted body alone — same purpose, different transport (REST GET/POST with a header vs form POST
  to a validate URL), same `ConfirmResult` shape (`confirmed: true` / `not-valid` / `request-failed`
  / `not-configured`). No interface change.
- `mapStatus(rawStatus)` — holds. Three raw values in, four `PaymentStatus` values out, same
  strict-switch shape as PayFast (`Complete→paid`, `Cancelled→cancelled`, `Error→failed`, default
  `unknown`). Note Ozow has no raw status that maps to `'pending'` in the redirect/notify payload —
  that's fine, `PaymentStatus` already treats `'pending'` as one of several possible outcomes, not
  a required one; PayFast populates it, Ozow's adapter simply never returns it. No interface change.
- `refund(input)` — **holds as a type, but semantically this is where a second implementation
  first exercises a method PayFast's adapter only stubs.** `RefundInput`'s three fields
  (`reference`, `gatewayPaymentId`, `amountFormatted`) are exactly what Ozow's refund API is
  documented to need (a transaction identifier plus an amount for partial refunds). `RefundResult`
  already has `'not-supported'` for a provider that doesn't do refunds and `ok:true` with
  `providerRefundId` for one that does — Ozow can honestly return the latter. **No interface
  change required.** The one open question is *scope*, not shape: whether this mission's milestones
  actually implement Ozow's refund call now, or declare it `not-supported` in M1/M2 the same as
  PayFast and defer real refund wiring to a later mission once the float/fee facts in the research
  doc's open questions are settled. Recommendation below (§3, M1) is to defer — implementing a real
  money-moving refund path against unconfirmed float/fee mechanics inside a "sandbox prep, don't
  touch anything live" mission is scope creep the mission brief didn't ask for, and every fact
  needed to do it correctly (float top-up workflow, whether the R3 fee is separate or float-
  deducted) is still an open vendor question per `docs/payment-gateway-research-2026-08.md` §11.

**Verdict: the interface claim in `lib/payments/types.ts`'s header comment holds.** Zero changes
to `PaymentProvider`, zero changes to any of its associated types. Ozow's adapter fits inside the
same seam PayFast already occupies, with one caveat worth writing into the golden doc rather than
the interface itself: `confirmNotification`'s doc comment should note it may be REST-header-authed
rather than form-POSTed, since that's now a fact about a real second gateway, not a hypothetical.

## 2. Concurrent-provider selection design

### The problem `lib/payments/index.ts` doesn't yet solve

Today: `export const paymentProvider: PaymentProvider = payfastProvider;` — one const, chosen at
module load, with no notion of "which provider for this particular checkout." Making Ozow a SECOND
option (not a swap) means three things need an answer that don't exist today:
1. How does the buyer indicate PayFast vs Ozow before/during checkout?
2. How does `POST /api/tickets/checkout` resolve which `PaymentProvider` to call?
3. How does the ITN-equivalent route know which provider's notification it's looking at, given
   PayFast posts to `/api/tickets/itn` and Ozow's `NotifyUrl` will be a *different* path (Ozow's
   own docs don't require the URL to be `/api/tickets/itn` — it's just whatever URL the outbound
   `initiate()` call sets as `NotifyUrl`, entirely under this app's control)?

### Recommendation: a provider REGISTRY keyed by a provider id, selected by the buyer at checkout,
### threaded through as an explicit `providerId` field on the order, with ONE NEW notification
### route per provider rather than one shared route branching internally.

**1. Buyer selection (UI):** add a provider-choice control to the ticket checkout UI (radio/segmented
control, "Pay with Ozow" / "Pay with PayFast" — Ozow first, since Brad's direction is that Ozow is
now the client's actually-preferred option, not merely equal). This is UI scope, not this
architect-only spec's job to lay out pixel-for-pixel, but it must exist somewhere before
`checkout/route.ts` before the POST is issued — the client picks, the server enforces (see below,
this is a security boundary exactly like `salesOpen`/`amount`, never trust the client's choice
blindly, only accept a value from an enumerated allow-list).

**2. Registry, not a second const:** replace `lib/payments/index.ts`'s single export with a small
keyed map:
```ts
export const paymentProviders: Readonly<Record<string, PaymentProvider>> = {
  payfast: payfastProvider,
  ozow: ozowProvider,
};
export function resolveProvider(id: string): PaymentProvider | null {
  return Object.prototype.hasOwnProperty.call(paymentProviders, id) ? paymentProviders[id] : null;
}
```
This is the smallest structural change that satisfies "two providers can both be live at once."
Rejected alternative: keep the single `paymentProvider` const and add an `if/else` inside
`checkout/route.ts` — rejected because it pushes provider-selection logic into route code, which
is exactly the inversion F2 (payment-provider-seam) fixed for the single-provider case; a second
`if (providerId === 'ozow')` in the route would be the seam's own regression.
Rejected alternative: a dynamic-import-by-string registry (env-driven plugin loading) — rejected as
over-engineering for exactly two known providers; `lib/payments/index.ts`'s own header comment
already rejected this shape for one provider on timeline grounds, and two hardcoded map entries is
barely more than one const.

**3. `checkout/route.ts` resolves the provider from the request body**, validated against the
same enumerated allow-list as `isValidShowId` — `providerId` must be exactly `'payfast'` or
`'ozow'`, anything else is a 400, mirroring the existing "request body is never the authority"
posture already documented at `isValidShowId`'s own comment. The resolved provider is what
`readiness('initiate')` and `.initiate(...)` are called on, replacing the current hardcoded
`paymentProvider` import. The chosen `providerId` is stored on the order document (new field,
additive, not a schema break) so the ITN-equivalent route knows which provider to ask.

**4. Notification routing: one route per provider, not one shared route.** Ozow's `NotifyUrl` is
set by us at `initiate()` time — nothing forces it to be `/api/tickets/itn`. Two real options:

  - **(a) One shared route, provider resolved from a query param or path segment**
    (`/api/tickets/itn?provider=ozow`, or `/api/tickets/itn/[provider]`), which looks up the order
    by reference first and trusts the *order's own* stored `providerId` rather than the URL — since
    the URL segment is attacker-controllable and the order's stored provider is not.
  - **(b) Two separate routes**, `/api/tickets/itn` (unchanged, PayFast) and
    `/api/tickets/ozow-itn` (new), each hardcoded to its own provider, sharing the actual
    verification/write logic via one extracted helper function both routes call.

**Recommendation: (b), two separate routes calling one shared helper.** Reasons: `itn/route.ts`'s
own header comment states its 11-step ordering is "load-bearing" and pinned by golden files scoped
to PayFast's exact behaviour (`contracts/golden/payment-seam-f2/`); a shared route with an
internal branch risks silently coupling the two providers' step orders together, so a future
PayFast-only golden-file change could accidentally alter Ozow's behaviour (or vice versa) through
shared code that wasn't meant to be shared at that granularity. Two thin route files, each a
pass-through to one shared `handleProviderNotification(provider, request)` helper in
`lib/tickets-notification.ts`, keeps the *routing* trivially separate (Ozow's URL truly can't
collide with PayFast's) while still sharing the actual 11-step logic body as one function —
avoiding a copy-pasted duplicate of `itn/route.ts`'s 200+ lines, which is the real risk (b) invites
if done carelessly. This is a refactor of `itn/route.ts` into (helper + two thin callers), not a
rewrite of its logic.

Rejected: (a) query-param routing — rejected because trusting a URL segment as a routing hint,
even when the actual security decision re-derives it from the stored order, still means a
malformed/missing param has to be handled as a THIRD state ("provider unknown") that (b) makes
structurally impossible — each route only ever means one thing.

### What does NOT need to change
- `checkout-reservation.ts`, the reservation transaction, capacity/pool logic, order/position
  writes — the `paymentProvider` swap is a leaf dependency of `checkout/route.ts`'s tail (from
  "gateway readiness guard" onward), not of the reservation transaction itself. Store `providerId`
  on the order as one more field alongside the reference/amount already written there.
- PayFast's adapter, `lib/payfast.ts`, `/api/tickets/itn` — untouched in behaviour, only extracted
  into (shared helper + thin route) form. The golden files scoped to PayFast's byte-for-byte
  behaviour must still pass unmodified after the extraction — that's the regression gate for this
  refactor, same posture as F1/F2's "pure move" discipline in the seam mission.

## 3. Milestone / feature breakdown recommendation

Small, independently gate-able, sandbox-only throughout. No live credentials touched at any stage.

**M1 — Ozow adapter skeleton, proven in isolation, no checkout wiring.**
- F1: `lib/ozow.ts` (mirrors `lib/payfast.ts`) — SHA512 hash builder (outbound field order) and
  inbound-hash verifier (response field order), both pinned by golden files built from a REAL
  sandbox `initiate()` call and a REAL sandbox notification captured end-to-end (same "prove it
  against the real gateway before pinning" discipline the PayFast goldens used).
- F2: `lib/payments/ozow.ts` — `createOzowProvider()` implementing `PaymentProvider` per §1 above.
  `refund()` returns `{ ok: false, reason: 'not-supported' }` in this milestone — deferred, not
  because the API doesn't exist, but because its field-level contract and float/fee mechanics are
  still open vendor questions (§0), and this mission's brief scopes to sandbox prep, not a
  money-moving feature nobody asked for yet.
  `confirmNotification()` calls Ozow's REST status-check endpoint with the `ApiKey` header — this
  is the one sub-feature genuinely dependent on the field-level API contract not yet in hand
  (§0's "not independently verified" list); F2 must pull that shape from a live sandbox call as
  its first step, mirroring how F1 pins hash order from a real captured payload rather than from
  secondhand docs.
- Gate: unit-level, offline (injected fetch/env, same `PayfastProviderDeps` pattern as
  `payfast.ts`) plus one real sandbox round-trip proving `initiate()` produces a hosted page Ozow
  actually accepts and `verifyNotification()` correctly authenticates a real captured notification.
  Nothing in `app/api/tickets/` is touched yet — this milestone is entirely additive, unreferenced
  code, same posture as F1 of the seam mission.

**M2 — Provider-selection design wired in.**
- F3: `lib/payments/index.ts` becomes the registry (§2.2). `checkout/route.ts` accepts and
  validates `providerId`, resolves via the registry, stores it on the order. PayFast's default
  behaviour (what happens if `providerId` is omitted — recommend: 400, not a silent PayFast
  default, since silent defaulting is exactly the "request body is never fully trusted, but also
  never silently substituted" posture this codebase already holds elsewhere) is an explicit
  @architect decision to confirm with a contract, not left to @dev's judgement.
- F4: `itn/route.ts` extracted into shared helper + PayFast's thin route (behaviour-identical,
  golden-file-verified) + new `ozow-itn/route.ts` thin route wired to the real adapter.
- Gate: PayFast's existing golden files pass unmodified (regression proof the extraction changed
  nothing observable); new Ozow-scoped assertions cover the registry's allow-list enforcement and
  the two-separate-routes-not-one-shared-branch property directly (this project's dominant defect
  class is an assertion satisfiable by something that isn't the real property — the registry
  contract must positively prove `providerId: 'nonsense'` is rejected, not merely that valid ids
  work).

**M3 — Full sandbox purchase proof, docs, Codex pass.**
- F5: a real, live sandbox purchase through Ozow end-to-end (browse → choose Ozow → checkout →
  Ozow sandbox payment → notification → order+position both `paid` → confirmation page), same
  regression-gate discipline the seam mission's F3 used for PayFast, run via BrowserAgent against
  the deployed dev site, cross-checked against Firestore/Cloud Logging directly (not just a green
  contract gate — this subsystem's standing rule, per the seam mission's own F3 brief).
- F6: Codex GPT-5.5 cross-model pass (mandatory, no exceptions) + `docs/payment-seam.md` updated
  (not a new doc — it already exists from the seam mission and describes "what a second gateway
  would have to do"; this closes that loop) + a note in
  `docs/payment-gateway-research-2026-08.md`'s open-questions section recording that the
  HMAC-SHA512 claim was wrong (plain SHA512) and that the refund API's exact field-level contract
  is still unconfirmed pending a live sandbox call this mission's F2 will have already made — link
  forward from the research doc rather than duplicating the correction in two places.

## 4. Explicitly deferred, not blocking this mission

- Real Ozow refund implementation (float top-up workflow, R3-fee-deducted-or-separate mechanics
  unconfirmed) — backlog, pending vendor answers already queued in the research doc §11.
- Settlement-timing confirmation, VAT-inclusive/exclusive confirmation, merchant-agreement reserve
  clause — commercial/compliance, not engineering; already tracked, not this mission's job.
- Non-profit-entity onboarding path / FICA docs for a real (non-sandbox) Ozow merchant account —
  irrelevant until go-live is authorised; INU-INU-002 is already Active for sandbox purposes.
- UI visual design for the provider-choice control — this spec states it must exist and where it
  slots into the flow (§2, point 1) but the actual component/copy is a design-handoff matter per
  this project's CLAUDE.md ("no invented brand assets... wait for Claude Design handoffs"), not
  something to freehand inside this mission.
