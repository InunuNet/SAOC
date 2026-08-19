# `PaymentProvider` — the exact surface @dev implements in F1

Mission `payment-provider-seam`, F1. This file is the **normative** interface. The contract's
type-check fixture (`contracts/checks/payment-seam-f1/fixtures/payment-seam-typecheck.ts`)
compiles against these declarations, so a divergence in name, arity, or arm shape is a red gate,
not a review comment.

---

## File layout under `lib/payments/`

| File | Contents | Constraint |
|------|----------|-----------|
| `lib/payments/types.ts` | Every type below. **Nothing else.** | **Zero PayFast identifiers** — asserted by A8. No `payfast`, `m_payment_id`, `pf_payment_id`, `amount_gross`, `merchant_id`, `merchant_key`, `passphrase`, `signature`, `md5`, `sandbox`, `eng/process`, `PAYFAST_*`. |
| `lib/payments/payfast.ts` | `createPayfastProvider(deps?)` and the default instance `payfastProvider`. Composes the existing primitives in `lib/payfast.ts`. | The **only** file in `lib/payments/` allowed to name PayFast. |
| `lib/payments/index.ts` | `export const paymentProvider: PaymentProvider = payfastProvider;` plus `export type` re-exports from `./types`. | **This is the single config point.** No registry, no map, no dynamic import, no `PAYMENT_PROVIDER` env switch in F1. |

`lib/payfast.ts` is **not moved and not modified** — it is sha256-pinned by A10. It already holds
the extracted primitives (`buildPayfastParamString`, `generateSignature`,
`buildPayfastNotifyParamString`, `generateNotifySignature`, `getClientIp`, the host and URL
constants) and four other contracts' check scripts import it by that path. The adapter *composes*
those primitives; relocating them would churn three green gates for no gain in F1.

---

## `lib/payments/types.ts`

```ts
/** Provider-neutral settled state. Deliberately NOT the gateway's own vocabulary. */
export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'cancelled' | 'unknown';

export interface InitiateInput {
  /** Our own order reference. Every target gateway has a caller-supplied field for this; the
   *  adapter maps it to whatever that gateway calls it. Deliberately NOT illustrated with the
   *  three vendors' field names — this file is subject to A8's vocabulary ban, and an example
   *  that names them would fail the very check the file exists to satisfy. */
  readonly reference: string;
  /** Money as an already-formatted 2dp decimal string. The caller owns formatting —
   *  today's route does `amount.toFixed(2)` and that must not move or change. */
  readonly amountFormatted: string;
  readonly itemName: string;
  readonly returnUrl: string;
  readonly cancelUrl: string;
  readonly notifyUrl: string;
}

export type InitiateResult =
  | {
      readonly ok: true;
      /** Hosted page the browser is handed off to. */
      readonly processUrl: string;
      readonly method: 'POST';
      /** Signed form fields IN SIGNATURE ORDER. Insertion order is load-bearing. */
      readonly fields: Readonly<Record<string, string>>;
    }
  | { readonly ok: false; readonly reason: 'not-configured' };

/** Structural, so the route can pass a NextRequest without lib/payments importing next. */
export interface NotificationRequestLike {
  readonly rawBody: string;
  readonly headers: { get(name: string): string | null };
}

export interface ProviderNotification {
  readonly reference: string;
  readonly rawStatus: string | null;
  /** Gross amount exactly as the gateway sent it — an unparsed string, kept for logging only
   *  (see `grossAmountCents` for the value the route may actually reason about). */
  readonly grossAmount: string | null;
  /** Gross amount as an integer number of ZAR cents — a gateway-neutral representation, not a
   *  judgement. Amended into F1 in the F2 window (2026-08-20); see "`grossAmountCents` — the
   *  seventh field, and why" below. Null means the adapter could not parse the gateway's own
   *  wire format into cents; the caller treats null exactly like a missing amount and fails
   *  closed. The caller still does the numeric COMPARISON against its own stored amount and the
   *  ACCEPT/REJECT judgement; the provider never decides whether an amount is acceptable — it
   *  only translates the gateway's number format into ours, the same job `mapStatus` already
   *  does for the gateway's status vocabulary. */
  readonly grossAmountCents: number | null;
  readonly gatewayPaymentId: string | null;
  readonly sourceIp: string | null;
  /** null = could not be determined (no client IP, or resolution failed). This is
   *  advisory only — today's route LOGS it and never rejects on it. */
  readonly sourceIpTrusted: boolean | null;
  /** Every posted field, in posted order, excluding the signature field. */
  readonly raw: Readonly<Record<string, string>>;
}

export type VerifyFailureReason =
  | 'not-configured'
  | 'missing-signature'
  | 'signature-mismatch'
  | 'missing-reference';

export type VerifyNotificationResult =
  | { readonly verified: false; readonly reason: VerifyFailureReason; readonly reference: string | null }
  | { readonly verified: true; readonly notification: ProviderNotification };

export type ConfirmResult =
  | { readonly confirmed: true }
  | { readonly confirmed: false; readonly reason: 'not-valid' | 'request-failed' | 'not-configured' };

export interface RefundInput {
  readonly reference: string;
  readonly gatewayPaymentId: string | null;
  readonly amountFormatted: string;
}

export type RefundResult =
  | { readonly ok: true; readonly providerRefundId: string }
  | { readonly ok: false; readonly reason: 'not-supported' | 'not-configured' | 'request-failed' };

/** The operations a caller can ask a provider whether it is configured to perform.
 *  Deliberately NOT a single global "is this provider configured?": PayFast needs merchant
 *  credentials to initiate and a passphrase to verify a notification, and those sets differ.
 *  Ozow (site code / keys) and Peach (entity id / bearer token) split the same way. `refund` is
 *  absent because refund itself is a declared-unsupported stub — inventing readiness semantics for
 *  an unimplemented operation would be guessing. */
export type ProviderOperation = 'initiate' | 'verify-notification';

export type ProviderReadiness =
  | { readonly ready: true }
  | {
      readonly ready: false;
      readonly reason: 'not-configured';
      /** Names the absent configuration keys, so an operator can act on the log line without a
       *  debugger. A bare boolean here would be a worse answer to the same question. */
      readonly missing: readonly string[];
    };

export interface PaymentProvider {
  readonly id: string;
  /** Can this provider perform `operation` right now? SYNCHRONOUS and OFFLINE by contract: it sits
   *  in front of every checkout, so it must not cost a network round trip, and it must not be a
   *  promise a caller could forget to await (a forgotten await is always truthy — it fails open). */
  readiness(operation: ProviderOperation): ProviderReadiness;
  initiate(input: InitiateInput): Promise<InitiateResult>;
  verifyNotification(request: NotificationRequestLike): Promise<VerifyNotificationResult>;
  /** Server-side re-confirmation of a notification, out of band from the webhook body. */
  confirmNotification(notification: ProviderNotification): Promise<ConfirmResult>;
  mapStatus(rawStatus: string | null): PaymentStatus;
  refund(input: RefundInput): Promise<RefundResult>;
}
```

---

### `readiness` — the sixth member, and why the route needs it

F2's first form introduced a defect F1 had explicitly pinned against: with gateway credentials
unset, checkout wrote a reservation and *then* refused. `initiate()` needs the booking reference and
the server-derived amount, and both only exist after `reserveTicket()`, so the refusal could not
precede the write — while `fail-closed-guards.golden.md` pins that guard as **"Before
`reserveTicket()`, i.e. before any Firestore write."**

The consequence is not abstract. This seam exists to make gateway swaps cheap; SAOC will swap — to
Ozow or Peach — under deadline, against a live show, with credentials that have never been exercised
in production. A misconfigured gateway is therefore the *most likely* failure mode of the thing the
seam is for, and it arrives while tickets are selling. Turning a clean 500 into orphaned reservations
that hold capacity until a TTL expires is the wrong trade at exactly the moment the seam pays off.

`readiness(operation)` lets the route refuse before reserving without reading gateway env itself, so
A4's ownership boundary holds too.

**Per-operation, not global.** PayFast needs merchant credentials to initiate but a passphrase to
verify a notification — the asymmetry F1 documented and F2 must preserve. A global
`isConfigured()` would either demand a passphrase at checkout, refusing purchases that succeed today
(a behaviour change under cover of a fix), or omit it and let the ITN path claim readiness it does
not have. Ozow and Peach split the same way, so the operation parameter is interface design rather
than a PayFast accommodation.

**`readiness` does not replace the post-`initiate` refusal.** Config is read per call by design, so
it can genuinely change between the probe and the initiate. The later refusal stays as defence in
depth; removing it would trade one hole for another.

---

### `grossAmountCents` — the seventh field, and why

Codex GPT-5.5 cross-model review (2026-08-20) found the pre-existing amount check compared a
`Number(amount_gross)` float against the stored order amount with a fixed `0.01` tolerance;
`Math.abs(Number('0.02') - 0.03)` is `0.009999999999999998` — just under tolerance — so a
one-cent underpayment on a cent-priced order passed as paid in full. The fix (`parseAmountToCents`,
a string-manipulation parser, never a `Number(x) * 100` float round-trip) landed correctly, but it
landed **inside `app/api/tickets/itn/route.ts`**, and its own doc comment said why it was safe:
*"PayFast always sends `amount_gross` in that exact shape [at most two fraction digits]."* A1
(payment-seam-f2) caught this: a route that must remain gateway-neutral was carrying a documented
assumption about one specific gateway's wire format, baked into a parser only that gateway's shape
is known to satisfy.

**The two acts this untangles.** Converting the gateway's own decimal-string convention into an
integer count of cents is a *format translation* — the same category of work `mapStatus` already
does for the gateway's status vocabulary, and PayFast, Ozow and Peach are free to disagree about it
(2dp string, integer-cents field, comma decimal — nothing here assumes they match). Deciding
whether the resulting number is *close enough* to what we expect — the `AMOUNT_MATCH_TOLERANCE_CENTS`
comparison, and the refusal it drives — is a business judgement about our own money, and stays in
the route exactly as F1 always intended (see `grossAmount`'s original doc comment above, which this
does not weaken: the provider still never decides whether an amount is acceptable, it now merely
also hands over a number instead of only a string).

**Why not just document the 2dp assumption as an interface-wide guarantee instead of moving code?**
That was considered and rejected: it would assert, unconfirmed, that Ozow and Peach share PayFast's
exact wire format before either adapter is written — the same shape of mistake that put the CTICC
venue and the 18–21 September dates into this project's history as an invented value nobody flagged.
`grossAmountCents: number | null` makes no claim about any gateway's string shape; each adapter is
free to parse its own gateway's convention however that gateway actually works, and the interface
only promises a cents integer or null on the far side of it.

**Fail-closed is unchanged.** `parseAmountToCents` moves to `lib/payments/payfast.ts` verbatim —
same regex, same rejection of anything that is not a plain non-negative decimal with at most two
fraction digits, same `null` on no match. The route's rejection branch is unchanged in shape: it
already treated a null parse as unparseable and refused; it now reads `grossAmountCents` off the
notification instead of calling a local parser. The one-cent-underpayment regression and the
`'0.0099'` sub-cent case must both still reject — see A15 (payment-seam-f2).

## Why six members and not the four in the brief

The brief names `initiate`, `verifyNotification`, `mapStatus`, `refund`. `confirmNotification` is
added deliberately, and here is the single reason: **today's ITN route performs PayFast's
server-confirm round-trip *after* the amount check and *after* the already-settled short-circuit,
not as part of signature verification.** Folding it into `verifyNotification` would move a network
call earlier in a security sequence and would fire it on notifications the current code never
confirms at all. F1 forbids behaviour change, so the seam must be able to express that ordering.

It is not a PayFast leak: all three target gateways have an out-of-band confirmation step — PayFast's
`/eng/query/validate` postback, Ozow's transaction-status query, Peach's `resourcePath` GET. Peach's
in particular is the *primary* status source, so a provider without one is not a case worth
designing around. It is a required member; an adapter with no such step returns
`{ confirmed: true }` explicitly and says so in a comment, rather than the interface making
fail-open the default.

---

## `createPayfastProvider` — factory and injectable deps

```ts
export interface PayfastProviderDeps {
  /** Defaults to process.env. Read PER CALL, never captured at module load — Firebase
   *  App Hosting supplies these with RUNTIME availability only (same reason
   *  app/api/tickets/checkout/route.ts reads SITE_URL inside resolveSiteUrl()). A5 case 5
   *  proves the per-call read. */
  readonly env?: Record<string, string | undefined>;
  /** Defaults to globalThis.fetch. Injected so A6/A7 can run offline. */
  readonly fetch?: typeof fetch;
  /** Defaults to the DNS resolution of PAYFAST_ITN_HOSTS. Injected so A2 runs offline. */
  readonly resolveTrustedIps?: () => Promise<Set<string>>;
}

export function createPayfastProvider(deps?: PayfastProviderDeps): PaymentProvider;
export const payfastProvider: PaymentProvider; // = createPayfastProvider()
```

`id` is `'payfast'`.

---

## Method-by-method behaviour, pinned to today's code

### `initiate`

1. Read `PAYFAST_SANDBOX_MERCHANT_ID` and `PAYFAST_SANDBOX_MERCHANT_KEY` from env **at call
   time**. If either is missing or empty → `{ ok: false, reason: 'not-configured' }`. **No
   fields, no signature, no partial result.** (Today: `checkout/route.ts:311`.)
2. Read `PAYFAST_SANDBOX_PASSPHRASE`. Absent is **legal** here — today's checkout passes a
   possibly-`undefined` passphrase straight into `generateSignature`, which folds it in only when
   truthy. Do not add a guard the current code does not have; the ITN side has one, checkout does
   not.
3. Build `fields` in **exactly this insertion order** — it *is* the signature base-string order
   (PayFast uses attribute order, not alphabetical):
   `merchant_id, merchant_key, return_url, cancel_url, notify_url, m_payment_id, amount, item_name`
   mapped from `merchantId, merchantKey, input.returnUrl, input.cancelUrl, input.notifyUrl,
   input.reference, input.amountFormatted, input.itemName`.
4. `signature = generateSignature(fields, passphrase)` — computed **last**, over the other eight.
5. Return `{ ok: true, processUrl: PAYFAST_SANDBOX_PROCESS_URL, method: 'POST',
   fields: { ...fields, signature } }` — signature appended last, so the returned object's key
   order is the nine-key order the route already spreads into its JSON response.

### `verifyNotification`

Order is load-bearing. Today: `itn/route.ts:99-166`.

1. Parse the raw body with `URLSearchParams`, preserving posted order, **stopping (`break`) at the
   `signature` key** — not skipping it and continuing. Fields after `signature` are excluded.
2. Passphrase absent/empty → `{ verified: false, reason: 'not-configured', reference }` **before
   any digest is computed**. An unset passphrase must never downgrade verification to a plain MD5
   over publicly-known fields.
3. `generateNotifySignature(fields, passphrase)` — the **inbound** algorithm (posted order, no
   trim, no blank-skip). Missing/empty posted signature → `missing-signature`; mismatch →
   `signature-mismatch`.
4. **Only now** resolve the source IP (`getClientIp` + `resolveTrustedIps`) and record
   `sourceIp` / `sourceIpTrusted`. A failing signature must not trigger DNS. `sourceIpTrusted`
   is advisory: it can never make `verified` false.
5. Missing/empty `m_payment_id` → `{ verified: false, reason: 'missing-reference', reference: null }`.
6. Otherwise `{ verified: true, notification }` with `reference = m_payment_id`,
   `rawStatus = payment_status ?? null`, `grossAmount = amount_gross ?? null`,
   `grossAmountCents = parseAmountToCents(amount_gross)` if `amount_gross` is present, else
   `null` (`parseAmountToCents` moved here verbatim from the route — see "`grossAmountCents` —
   the seventh field, and why" above; same regex, same null-on-no-match, no `Number(x) * 100`
   float round-trip), `gatewayPaymentId = pf_payment_id ?? null`, `raw` = the parsed fields in
   posted order.

### `confirmNotification`

POST `buildPayfastNotifyParamString(notification.raw)` — the **inbound** builder, the same string
the digest was computed over — to `PAYFAST_SANDBOX_VALIDATE_URL`, content-type
`application/x-www-form-urlencoded`.

The `fetch` call must be shaped exactly as today's route shapes it, because A6 case 2 inspects the
init object directly: `fetch(PAYFAST_SANDBOX_VALIDATE_URL, { method: 'POST', headers: {
'Content-Type': 'application/x-www-form-urlencoded' }, body: <the inbound param string> })`.
`headers` is a **plain object literal**, not a `Headers` instance, and `body` is a **string**, not a
`URLSearchParams` — both because that is what the route does today and this is a pure move. Response body, `.trim()`-ed, must equal exactly `VALID` →
`{ confirmed: true }`. Anything else → `{ confirmed: false, reason: 'not-valid' }`. A thrown or
rejected fetch → `{ confirmed: false, reason: 'request-failed' }` — never rethrow.

### `mapStatus`

`'COMPLETE' → 'paid'`, `'FAILED' → 'failed'`, `'PENDING' → 'pending'`, `'CANCELLED' → 'cancelled'`,
everything else including `null` → `'unknown'`. **Strict, case-sensitive, no trimming.** Today's
route compares `fields['payment_status'] !== 'COMPLETE'` exactly; a `.toUpperCase()` or `.trim()`
"improvement" is a behaviour change and A5 fails on it.

### `refund`

**There is no refund code in this repository today** — verified by grep across `app/` and `lib/`
on 2026-08-19: zero hits outside the `/refunds` marketing page copy. A pure move cannot move what
does not exist. So F1 ships the *signature only*: `refund()` returns
`{ ok: false, reason: 'not-supported' }` and **makes no network call**. Do not invent a PayFast
refund API integration — it would be unverifiable behaviour that no route calls, and A7 fails if
a `fetch` is attempted.

---

## Explicitly OUT of scope for F1

- **Rewiring either route.** `app/api/tickets/checkout/route.ts` and `app/api/tickets/itn/route.ts`
  stay byte-identical — A10 pins both. The adapter is unreferenced production code at the end of
  F1, and that is correct: F2 owns the rewiring, so that a regression in F3's live purchase has one
  candidate cause, not two.
- **`RECOVERY_TOKEN_SECRET`.** It is ours, not the gateway's — it mints our recovery token and has
  nothing to do with any payment provider. It must not appear anywhere under `lib/payments/`, and
  its fail-closed guard stays in the checkout route. A9 asserts both halves.
- **The order/position Firestore writes, the amount comparison, the idempotency short-circuit, the
  confirmation email.** All ours. The provider returns facts; the route makes decisions.
- **A provider registry, a workspace package, host adapters, or a `PAYMENT_PROVIDER` env switch.**
  Packaging is deferred (Brad, 2026-08-19). `lib/payments/index.ts` exporting one const is the
  whole selection mechanism.
- **Any change to `lib/payfast.ts`.** Pinned by A10.
