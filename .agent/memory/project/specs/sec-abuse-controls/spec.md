# sec-abuse-controls (mission nos-security-tiered-access, M1/F3)

Closes SEC-02 (P1), SEC-15 (P3) and SEC-17 (P3) from `specs/nos-security-tiered-access/audit/findings.md`, and carries the code side of SEC-18 (now P1: the reconcile cron is not running; see "Expiry is self-enforcing").
Every claim below was re-checked in the code at base `ada42c41`.

## Decision

Add one durable, cross-instance limiter backed by Firestore (`lib/abuse-limiter.ts`), move the shared-lane call sites onto it, bound how many seats one actor can hold at once during checkout (a count read from the orders themselves, inside the reservation transaction), cap the webhook body before it is buffered (`lib/webhook-body.ts`), and move the seat-hold expiry rule into one pure module (`lib/seat-holds.ts`) shared by the capacity ledger and the new budget, so nothing depends on the reconcile job. No new infrastructure, no new vendor, no new secret, no change to the 30 minute hold, the 20 line item cart, the reconcile route, the order ledger or any gateway adapter.

## What the code does today (verified)

| Claim in the audit | Verified at | Result |
|---|---|---|
| Checkout has no limiter | `app/api/tickets/checkout/route.ts:437-446`: only a Content-Length check and the idempotency header check run before `request.json()`; nothing rate-limits | holds |
| Up to 20 seats per request, held 30 min | `lib/tickets-constants.ts:9,19`; the form allows a full 20 seat cart (`components/tickets/TicketPurchaseForm.tsx:311` `max={CART_MAX_LINE_ITEMS}`) | holds |
| Reserved seats count against capacity | `lib/data/tickets.ts:45-47`, `stillHoldsSeat` at `:25-37` (reserved and unexpired, or reserved with no expiry, counts) | holds |
| A "Pending" gateway report extends a hold to 72 h | `lib/payments/pending-hold.ts:7` `PENDING_PAYMENT_HOLD_MINUTES = 4320`; `lib/orders.ts` `markOrderPaymentPendingByPaymentId` | new fact, see Interactions |
| Limits are per instance | `lib/newsletter-rate-store.ts:3-4`; `apphosting.yaml:5-6` `maxInstances: 2`; 16 call sites listed under Hand-offs | holds |
| ITN routes buffer the body before verifying | `lib/tickets-notification.ts:78` and `lib/vendor-stand-payment-notification.ts:98` (`await request.text()`), both ahead of `verifyNotification`; the four routes `tickets/itn`, `tickets/ozow-itn`, `vendors/stand-payment/payfast-itn`, `vendors/stand-payment/ozow-itn` all funnel into these two functions | holds, and only two call sites need the fix |
| Availability depends on the reconcile job to release expired holds | `lib/data/tickets.ts:25-37` `stillHoldsSeat` drops a `reserved` position once `expiresAt <= now`; both ledger functions (`getSoldCountsByTicketType` `:55-80`, `getSoldCountsByTicketTypeAndDay` `:99-130`) apply it; every availability reader goes through them (`lib/data/pool-remaining.ts`, `lib/data/admission-availability.ts`, `app/(nos)/tickets/[slug]/page.tsx`, `app/(nos)/national-show/symposium/page.tsx`, the checkout transaction) | **No dependency.** Expiry is already self-enforcing at read time |
| The reconcile job releases seats | `app/api/admin/reconcile-orders/route.ts:14-25`, `lib/reconciliation.ts`: it only queries `reserved` + `expiresAt < now`, emails a human and stamps `reconciliationAlertedAt`; it never writes `status` | Alert-only. Even when running it frees nothing |
| `/api/revalidate` also buffers | `app/api/revalidate/route.ts:19` | NOT a finding: the secret is checked first (`:8-16`) |
| The proxy gate exempts the ITN paths | `proxy.ts:38-45` (exact match set) | holds; the body cap is therefore the only pre-auth control on those routes |

## Expiry is self-enforcing (live evidence 2026-10-29: 31 of 48 prod orders in `reserved`, Cloud Scheduler off)

Verified in code, not assumed:

1. A `reserved` position stops counting toward capacity the moment its `expiresAt` passes, inside the same read that computes availability. There is no scheduler, sweeper or reconcile dependency (`lib/data/tickets.ts:25-37` and the module comment at `:19-24`: "No sweeper, no cron, no status write"). So the 31 stranded orders are **not withholding inventory** as long as each has a Timestamp `expiresAt` in the past.
2. Two classes of `reserved` document do keep holding seats, both by design: (a) `expiresAt` missing or not a Timestamp (the rule fails closed on purpose so a writer that forgets the field cannot silently release seats); (b) a hold a verified gateway "Pending" report extended to 72 hours (`lib/payments/pending-hold.ts:7`). Neither can be told apart from the stranded set by code alone: **H7 below is a read-only diagnostic** the lead can run to count class (a) among the 31 without any write.
3. The expiry must never be turned into a write (flipping stale `reserved` to `cancelled`): the ledger comment records why, a payment that lands after expiry still wins its seat (`lib/orders.ts` Pending and paid transitions), and a cleanup that cancels would race it. So the fix is read-time and stays read-time.

What F3 changes (no behaviour change to the ledger, a guard against drift):
- New pure module `lib/seat-holds.ts`: `stillHoldsSeat(data, nowMs)` (the existing rule, byte-for-byte semantics, duck-typed on `toMillis()` so it needs no `firebase-admin`) and `tallySeatHolds(docs, nowMs)`. `lib/data/tickets.ts` imports it in place of its private copy; `lib/checkout-holds.ts` reuses the same predicate for the held-seat budget. The budget and the ledger therefore cannot disagree on what "held" means (A16, A17).
- Stranded documents need no handling and no manual write: they are excluded by the rule itself. Documents created before this change carry no `clientKey`/`buyerKey`, so they never count against any actor's budget either.
- Golden `seat-holds.golden.ts` fixes the scenario: 31 expired reservations hold nothing; a live cart, a 72 hour Pending hold and paid seats (including one paid after its hold lapsed) do hold; far in the future only paid seats remain; no clock, no reconcile import.

Not changed, not in scope: the reconcile route and library (A11). SEC-18 is an operations gap, not a code gap: the job needs Cloud Scheduler enabled and `RECONCILIATION_CRON_SECRET` wired in `apphosting.yaml` (production config; hand-off H7). Until H7 lands the monitoring control stays off, but nothing in the buy path relies on it.

Observation, flagged not fixed: `getSoldCountsByTicketType` counts only `reserved` and `paid`, so a position that moves to `checked-in` stops counting toward capacity (`lib/data/tickets.ts:19`). Worth a separate look before show weekend.

Ledger read cost: every availability read and every checkout scans all `reserved`/`paid` positions for the show and filters expiry in memory, and expired `reserved` documents are never deleted. They accumulate, so read cost grows with abandoned holds. Today the set is tiny. With D3/D4 one actor adds at most about 40 positions per 30 minutes, so a patient attacker still adds work over days; the limits slow it, they do not remove it. Recommended follow-up (a separate feature, because it touches `lib/orders.ts` settlement): a purge field with a Firestore TTL for positions that are expired and unpaid, cleared on payment. Not done here because a purge that can race a late payment must be designed on its own.

## Threat model

Attacker: anonymous, scripted, no account. Goal: keep a capped product (VIP 200, early-bird pool 500, per-day pools) showing sold out, or run up Firestore/Sanity cost. The audit's baseline: one request a second holds 20 seats each, so one source drains any pool in minutes.

After this change, one actor (an IPv4 address, or an IPv6 /64) can hold at most 40 seats at any moment, and one buyer email at most 40. The cost to the attacker of a full pool hold, with the 30 minute TTL and continuous re-reservation:

| Pool | Capacity (`lib/provisional-figures.ts`) | Distinct actors needed to hold it all |
|---|---|---|
| VIP | 200 | 5 |
| Early-bird pool (shared by early-bird day and weekend) | 500 | 13 |
| Day Visitor, per day | 1000 | 25 |

Before: 1 actor. **Residual risk, stated plainly:** a distributed attacker with a handful of proxy addresses can still hold VIP. No server-side count can fully close that; only a challenge on the buy path can (D8). This feature removes the single-source attack the audit demonstrated, removes the zero-cost property, and adds the signals (below) to see the distributed one. It is not claimed to eliminate it.

Not defended here, deliberately: a paying attacker (a paid seat is a sale), and per-address evasion if the forwarding header assumption in D1 were wrong. The per-buyer cap and the Firestore-backed counts are independent of the header, so the damage in that case is bounded, not unbounded.

## Decisions

Each decision states the recommendation and the alternative. Values with no source in Brad's or Lee-Ann's material are marked NAMED and need approval from the SAOC lead.

### D1. Store: Firestore transaction on a per-key document (SEC-15). Decided, not NAMED.
- Doc `abuseLimits/{scope}:{hmacSha256Hex(secret, scope + "\0" + key)}`, fields `scope`, `entries: [{t: ms, w: weight}]` (live window only, so at most `maxAttempts` entries), `expireAt: Date` (= now + windowMs), `updatedAt`. One read-modify-write transaction per call. Sliding log, identical "the Nth attempt is allowed" semantics to `lib/newsletter-rate-limit.ts`.
- A denied call writes nothing (read-only transaction). An attacker above the limit therefore costs one read per request and contends on nothing; legitimate users on the same key do not lose write throughput to the flood.
- The key is an HMAC, so Firestore never holds a raw IP or email (POPIA). The secret is derived from the existing `RECOVERY_TOKEN_SECRET` with a domain label, so no new secret is wired and `apphosting.yaml` is unchanged (A11). A missing secret fails closed.
- Cleanup: Firestore TTL policy on `abuseLimits.expireAt`, declared in `firestore.indexes.json` as a `fieldOverrides` entry (`"ttl": true`). Deploying it is an operator step (hand-off H3). Until deployed, documents persist; the set is bounded by distinct keys, one small document each.
- Cost and latency, as estimates to be measured at QA, not measured here: one same-region Firestore transaction is expected to add tens of milliseconds. Checkout adds two (per-IP, per-buyer), against a request that already makes several Sanity reads and a transaction. Volume is a few thousand requests a month; at 1 read and 1 write per limited call that is far inside Firestore's daily free quota (50k reads and 20k writes a day, per Google's pricing page; confirm at deploy).
- Rejected: Cloud Armor rate rules (audit evidence gap 10: App Hosting does not expose its load balancer, so this cannot be configured from the repo); Memorystore/Redis (new paid infrastructure plus a VPC connector for a site this size); sticky sessions or one instance (changes hosting, hurts availability).
- Fail mode: **closed.** On `AbuseLimiterUnavailableError` the route returns its own existing generic failure response (500 or 503 with the route's existing error copy). Every limited route also writes to Firestore, so a Firestore outage already fails it; failing open would only create a window where limits silently vanish. Fail-open to the old in-memory store is rejected: it is the status quo this finding is about.

### D2. Actor identity and the forwarding header. Decided.
- Header: `X-Forwarded-For`, parsed by the existing `clientIpFromForwardedFor` (`lib/client-ip.ts`): the second-to-last hop. Google's front end appends the TCP peer address it observed and then its own address, so everything the client sent sits before those two entries and is ignored. A client cannot make its own appended hop say something else. `lib/payments/ozow.ts:145` independently documents the same two-hop shape.
- `clientActorKey(header)` returns `ip4:<addr>`, `ip6:<first four hextets>` (a /64, because one subscriber holds a whole /64 and could otherwise rotate through 2^64 addresses), the IPv4 for an IPv4-mapped IPv6 address, and `unknown` for anything that is not an address. `unknown` is one shared bucket (it cannot occur behind the load balancer, so it is strict on purpose).
- Evidence gap, stated: this repo cannot prove the hop count from outside the platform. QA verifies it once on the deployed backend (H4). If the assumption is wrong, per-IP evasion becomes possible but the per-buyer limits, the per-buyer hold cap and the pool capacities still bound the damage.
- Shared addresses (a venue or office behind NAT) share one actor. D3 sizes the numbers so a normal group of buyers on one address is not blocked.

### D3. Checkout request limits. NAMED (no source; recommendation below).
| Limit | Recommended | Why | Alternative |
|---|---|---|---|
| Per actor, checkout requests | 12 per 15 min | A buyer needs 1 request, a handful with retries and edits; a NAT with several buyers still fits | 6 per 15 min (stricter, risks shared venue wifi) |
| Per buyer email (first line item), checkout requests | 6 per hour | One identity should not re-submit more than a few times | 3 per hour |
Consumed on every attempt including idempotent replays (a network retry is still a request). The per-actor call is the first thing after the body-size check, so junk requests are limited before anything is parsed or read. The per-buyer call follows `parseLineItems` and precedes every Sanity read, so a refused request costs no Sanity quota.

### D4. Concurrent held-seat budget. NAMED (derived from sourced code constants).
- Actor total 40, buyer total 40, per-product per actor 40.
- Source for 20: `CART_MAX_LINE_ITEMS`/`MAX_LINE_ITEMS = 20` (one maximal cart, and the form really lets a buyer fill it). 40 is two full carts: a buyer who abandons a cart and starts again inside the 30 minute hold is not locked out of their own purchase. Alternative: 20, which would lock that buyer out until the first hold expires unless we also add "supersede the buyer's earlier unpaid order" logic (a larger change; not recommended now).
- The count is read inside the reservation transaction (`tickets.where('clientKey','==',k).where('status','==','reserved')`, same for `buyerKey`), summarised by `summariseHeldSeats` using the same fail-closed expiry rule as `stillHoldsSeat`. It runs after the idempotent-replay branch (a replay must never be refused by seats it already holds) and before `writeMultiReservationPair`. Because it reads the orders' own positions there is no second ledger to drift, it is correct across instances by construction, and the transaction makes it race-free.
- Equality-only filters: Firestore serves them from the automatic single-field indexes, so `firestore.indexes.json` needs no composite index for this (A9 only adds the TTL override).
- Per-product cap: `actorMaxHeldPerType = 40`, equal to the total because the purchase form allows 20 of one product and two carts is the design; the knob exists so F6 can tighten it. **Lee-Ann's source says "a maximum of 5 per booking contact"** (`docs/leeann-source/ticketing-system-details_2026-09-09.md:290`; `lib/tickets-constants.ts:15-18` assigns that business rule to F6/Stage 4). It is a business rule, not an abuse control, enforcing it needs UI and copy changes, and it would break the 20 seat cart the form offers today. Recommendation: leave it to F6; do not apply it here. Alternative: apply 5 now (breaks existing legitimate carts of 6 to 20; needs committee copy).
- Existing documents have no `clientKey`/`buyerKey`; they simply do not count. All pre-deploy holds expire within 30 minutes (72 h only if a gateway reported Pending), so the gap closes itself.

### D5. Hold duration and request size. Decided: keep both.
- `RESERVATION_TTL_MINUTES = 30` stays. It is justified by real bank flows (the constant's comment: about 10x the observed sandbox round trip); shortening it raises the odds a paying buyer's notification lands after expiry, which the code accepts but treats as a refund risk (`lib/orders.ts` Pending docs). With the per-actor budget, the TTL no longer sets how much one actor can hold, so shortening it buys little. Alternative: 20 minutes. Not recommended without gateway timing data.
- `MAX_LINE_ITEMS = 20` stays: the form and `lib/cart` allow 20 and the budget, not the request size, now bounds the hold.
- `lib/tickets-constants.ts` is asserted unchanged (A11).

### D6. Webhook body cap: 16 KiB. Decided (derived from documented field maxima).
- `lib/webhook-body.ts`: `readCappedBody(request, maxBytes = 16384)` returns `{ok:true,text}` or `{ok:false}`. A declared Content-Length over the cap is refused without reading; otherwise the stream is read chunk by chunk, counted, cancelled and refused the moment it passes the cap, so a missing or lying Content-Length cannot bypass it. UTF-8 is decoded across chunk boundaries. (`isBodyWithinLimit` is not reused: it rejects a missing Content-Length, which would refuse a legitimate chunked notification.)
- Size derivation: both gateways post a form of short fields. Ozow's notify has 13 fields plus a 128 character hash (`lib/ozow.ts:53-67`; longest documented field 250, `lib/payments/gateway-field-limits.ts:6-24`), about 1 KB. PayFast's ITN free-text capacity is custom_str1-5 (255 each), item_name 100, item_description 255, m_payment_id 100, name_first/last 100 each, email_address 100, which is 2030 characters; at 3 bytes per character (every character percent-encoded) plus 30 short fields that is 7290 bytes. 16384 is 2.2x that worst case, and the golden asserts the 2x margin. The real notification we receive is far smaller (a few hundred bytes to 2 KB).
- Evidence gap, stated: the PayFast docs page fetched through Alembic returned medium confidence and the Ozow notify page returned not-found, so field lists are from the repo's own transcription of the vendor docs, not a fresh read. The 2x margin is the mitigation; if a gateway ever documents a larger payload the constant is one line.
- Response when refused: `413 {"error":"Payload too large"}` from both handlers, before `verifyNotification`, logged with provider and byte count only. Machine-facing, not customer copy. Not acknowledged with 200: a legitimate notification cannot exceed the cap, so a refusal is an attack or a bug and should stay visible to the gateway's retry/alerting.

### D7. Bot challenge on checkout (Turnstile or App Check). NAMED, deferred.
Recommendation: do not add now. It introduces a third-party script and data flow that needs privacy-policy copy (no invented copy) and a client change on the buy path. Trigger to revisit: the `abuse-limit-denied` log signal or the per-pool held ratio shows the distributed pattern described under Threat model. Alternative: add it now as the only complete answer to a distributed attacker. This is the one decision the SAOC lead must take knowingly, because it is the stated residual risk.

### D8. Refusal copy. NAMED gap, no new copy written.
A refused checkout returns `429` with the existing sentence `Too many attempts. Please try again later.` (already shipped in `app/api/contact/route.ts`) and a `Retry-After` header. A held-seat refusal reuses the same sentence. Awaiting committee copy: a message that explains that seats held in an unfinished checkout release after 30 minutes. The client already renders server `error` strings on the checkout form (no client change in this scope).

## Specification (what @dev builds)

New files
- `lib/abuse-limiter.ts` exports `consumeAbuseLimit(input, deps?)`, `clientActorKey(header)`, `hashAbuseKey(secret, scope, key)`, `AbuseLimiterUnavailableError`, `AbuseLimitDecision`. Contract is the golden `abuse-limiter.golden.ts`: `input = {scope, key, maxAttempts, windowMs, weight?=1, now?}`, `deps = {db?, secret?}` (db injectable; defaults to `getFirestore(initAdmin())` loaded with a dynamic `import()`, never a top-level `firebase-admin` import; secret defaults to a domain-separated derivation from `RECOVERY_TOKEN_SECRET`). On deny it logs one JSON line `{event:'abuse-limit-denied', scope, keyId: <first 12 hex of the hash>}` with no raw identifier, so a log-based alert can be set (H5).
- `lib/checkout-holds.ts` exports `CHECKOUT_LIMITS` (frozen, values in D3/D4), `summariseHeldSeats`, `evaluateHoldBudget` (reasons `actor-total`, `actor-type`, `buyer-total`, checked in that order, `limits` injectable). Contract is `checkout-holds.golden.ts`.
- `lib/webhook-body.ts` exports `WEBHOOK_MAX_BODY_BYTES`, `readCappedBody`. Contract is `webhook-body.golden.ts`.
- `lib/seat-holds.ts` exports `stillHoldsSeat(data, nowMs)` and `tallySeatHolds(docs, nowMs)`: pure, no `firebase-admin`, no reconciliation import. Contract is `seat-holds.golden.ts`. `summariseHeldSeats` in `lib/checkout-holds.ts` calls `stillHoldsSeat`.

Changed files (all SHARED lanes)
- `app/api/tickets/checkout/route.ts`: per-actor `consumeAbuseLimit` right after the body-size check; per-buyer after `parseLineItems`; both 429 with `Retry-After` and the D8 sentence; `AbuseLimiterUnavailableError` returns the route's existing 500 body. Pass `actor: {clientKey, buyerKey}` into `reserveTicket`; inside its transaction, after the replay branch and before the write, read the two held-seat queries and call `evaluateHoldBudget`; a refusal returns the same 429 (add an outcome kind `hold-budget-exceeded`). Stamp the keys on the new docs.
- `lib/checkout-reservation.ts`: `BuildMultiReservationDocsInput.actor?`; `clientKey`/`buyerKey` on the order and every position, `?? null` (Firestore undefined-write rule). Add the two optional fields to `Order` and `Ticket` in `types/index.ts`.
- `app/api/contact/route.ts`, `app/api/newsletter/subscribe/route.ts`, `app/api/newsletter/unsubscribe/route.ts`, `app/api/tickets/status/route.ts`, `app/api/tickets/pdf/route.ts`: replace the in-memory limiter with `consumeAbuseLimit`, keeping each route's existing key prefix, max and window, response bodies and `Retry-After`. `lib/newsletter-handler.ts`: remove the in-handler rate limit (the route now decides before the transaction), keep `NEWSLETTER_COPY.rateLimited` as the 429 body; update its tests. `lib/data/tickets.ts`: delete the private `stillHoldsSeat`, import it from `lib/seat-holds`, call sites unchanged. `lib/newsletter-rate-store.ts` and `lib/newsletter-rate-limit.ts` stay while SAOC-lane callers still import them (H1); add a one-line deprecation comment.
- `lib/tickets-notification.ts:78`, `lib/vendor-stand-payment-notification.ts:98`: `readCappedBody` before `verifyNotification`; `{ok:false}` returns 413.
- `firestore.indexes.json`: `fieldOverrides` entry `{collectionGroup:"abuseLimits", fieldPath:"expireAt", ttl:true, indexes:[]}`. If the Firebase CLI rejects the `ttl` key, stop and report (H3 fallback is a documented `gcloud firestore fields ttls update`), do not drop the assertion.
- `docs/abuse-controls.md` and the CLAUDE.md collection table: `abuseLimits`, plus the new `clientKey`/`buyerKey` fields (the retention of these keyed hashes is an input to SEC-19).

Anchors (mutation proof). Put `// anchor: <id>` on the line directly above the decision line, and keep the quoted token on that line:
`limiter-deny` ` > input.maxAttempts`; `limiter-window` `< input.windowMs`; `ipv6-prefix` `slice(0, 4)`; `limiter-hash` `createHmac('sha256', secret)`; `held-expired` `> nowMs` (in `lib/seat-holds.ts`); `budget-actor-total` `> limits.actorMaxHeldSeats`; `budget-actor-type` `> limits.actorMaxHeldPerType`; `budget-buyer-total` `> limits.buyerMaxHeldSeats`; `webhook-declared` and `webhook-stream` `> maxBytes`; `reservation-actor-stamp` `?? null` on the order's `clientKey:` line.

## How each finding closes

- **SEC-02:** per-actor and per-buyer request limits before any work; held seats per actor and per buyer bounded at 40 inside the reservation transaction; one actor can no longer drain a pool (table above). Residual distributed case is D7.
- **SEC-15:** the shared-lane callers use the Firestore limiter (A6); `golden 3` proves two callers sharing only the database share one count. Full closure of the finding needs the SAOC-lane callers moved (H1); until then those routes keep today's per-instance limit, and this spec does not claim otherwise.
- **SEC-18:** code side closed by verification and the shared rule (nothing relies on the job; A16, A17). The operations side (scheduler, secret) is H7.
- **SEC-17:** both notification handlers cap the body at 16 KiB before reading it (A3, A7).

## Interactions and how "nothing breaks" is proven

| Must not break | Why it is safe | Proof |
|---|---|---|
| A legitimate purchase | A maximal 20 seat cart from a clean actor passes; a buyer holding one full abandoned cart can still start a second; refusal needs 12 requests in 15 min or more than 40 held seats | A2 (boundary cases), A5 (order), QA deployed purchase in the Ozow sandbox (H4) |
| Idempotent replay of the same cart | Budget runs after the replay branch, so seats a replay already holds are never counted against it | A5 ordering |
| Ozow sandbox test mode (live: on, 17 sandbox-paid orders, SEC-06 is a separate feature) | F3 adds no read, write or branch on `ozowSandboxTestMode` or the gateway environment; limits and budgets treat sandbox and live traffic identically, so sandbox QA purchases are limited like any other | A18 scans every added line and new file for the sandbox tokens; A11 keeps `lib/ozow.ts`, `lib/payments/**`, `apphosting.yaml` unchanged |
| Availability for the 31 stranded reservations | Already excluded at read time; this change keeps the rule and makes it shared | A16, A17 |
| Ozow / PayFast notification path | Body cap is 2.2x the largest documented body; verification, amount match and idempotency are untouched; `lib/payments/**` unchanged | A3, A7, A11 |
| Pending hold (72 h) | Unchanged. Seats a gateway reports Pending still count against the buyer's budget, which is accurate, and they are never released early | A11 (`lib/orders.ts`, `pending-hold` unchanged) |
| Reconcile path | `app/api/admin/reconcile-orders/route.ts` and `lib/orders.ts` unchanged; it queries `orders(status, expiresAt)`; the limiter writes only `abuseLimits` | A11 |
| 30 minute hold, 20 item cart | Constants file untouched | A11 |
| Sanity request volume | No `headers()` in any not-found or catch-all; the limiter runs only in API routes; the checkout still reads Sanity live after the limits pass | A5, `docs/sanity-request-volume.md` |
| Firestore undefined writes | Builders `?? null`; limiter doc has no optional fields | A4 |

## Hand-offs (SAOC lane; not in this scope)

- **H1.** Move these onto `consumeAbuseLimit`, mechanically (same keys, maxes, windows): `app/api/vendors/apply`, `vendors/register`, `vendors/register/verify-code`, `vendors/[id]/proof-of-payment`, `vendors/[id]/marketing-asset`, `app/api/sponsors/enquire`, `app/api/events/submit` (per-uid and per-IP), and the vendor/sponsor/supporter libs `lib/vendor-registration-handler.ts`, `vendor-registration-code-verify-handler.ts`, `vendor-proof-of-payment-handler.ts`, `vendor-marketing-upload-handler.ts`, `sponsor-enquiry-handler.ts`, `supporter-registration-handler.ts`, `resend-response.ts`/`vendor-register-response.ts` callers. Until then SEC-15 stays open for those routes, and the per-code-guess limiter on vendor verify-code keeps its per-application lockout as its real control.
- **H2.** After H1, delete `lib/newsletter-rate-store.ts`, `lib/vendor-*-rate-limit.ts` in-memory stores and the `public-form-rate-limit.ts` comment about per-instance counts.
- **H3. Ops (operator step):** deploy the TTL policy (`firebase deploy --only firestore:indexes`, or `gcloud firestore fields ttls update expireAt --collection-group=abuseLimits --enable-ttl`). Production config; ask Brad's lead before running.
- **H4. QA on the deployed backend:** (a) confirm the `X-Forwarded-For` hop assumption from a request with a forged leading hop; (b) one full Ozow sandbox purchase from a clean address; (c) time the added limiter latency; (d) 13th request in 15 minutes returns 429 with `Retry-After`.
- **H7. Ops (production config, SAOC/operator; not in this scope):** enable Cloud Scheduler, add `RECONCILIATION_CRON_SECRET` to `apphosting.yaml` secrets and create the job that POSTs `/api/admin/reconcile-orders` with the bearer token (see `docs/order-reconciliation.md`); prove one authenticated run. Expect the first run to email one batch alert covering every stranded order (about 31 today, mostly abandoned carts and sandbox tests). Also run the read-only diagnostic: for the `reserved` orders, count those whose positions lack a Timestamp `expiresAt` (they still hold seats by design) and those whose `expiresAt` is more than 30 minutes ahead (Pending holds).
- **H8. Data (SAOC lane, only if H7's diagnostic finds class (a) documents):** a one-off correction of those documents by the SAOC lane or an admin tool. NOS Site writes no production data and F3 does not.
- **H5. Ops:** a Cloud Logging alert on `abuse-limit-denied` volume per scope.
- **H6.** Privacy page copy for IP-derived keys held on orders: awaiting committee copy (no wording invented here).

## Risks

- Contention on a hot key under a flood: denied calls are read-only, so only an actor inside its allowance writes. Worst case a shared `unknown` bucket aborts transactions and fails closed.
- Fail-closed means a Firestore outage refuses limited routes; each already depends on Firestore, so this adds no new outage mode.
- Rotating `RECOVERY_TOKEN_SECRET` resets all limiter state and invalidates held-seat stamps for older orders (they stop counting). Acceptable; recovery tokens break on rotation anyway.
- The distributed attacker (D7) is the one named residual risk.
