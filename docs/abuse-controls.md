# Abuse controls (SEC-02, SEC-15, SEC-17, SEC-18)

Mission `nos-security-tiered-access`, M1/F3. Spec, decisions and hand-offs live in
`.agent/memory/project/specs/sec-abuse-controls/spec.md`; this page is the operating summary.

## What exists

| Piece | File | Behaviour |
|-------|------|-----------|
| Durable limiter | `lib/abuse-limiter.ts` | Sliding log in Firestore `abuseLimits/{scope}:{hmac}`; one transaction per call; a denied call writes nothing. **Fails closed** (`AbuseLimiterUnavailableError`). Key and stamps are HMACs derived from `RECOVERY_TOKEN_SECRET`; no raw IP or email is stored. |
| Actor identity | `clientActorKey()` | Trusted forwarded hop only (second-to-last, `lib/client-ip.ts`); IPv6 grouped by /64; `unknown` is one shared bucket. |
| Checkout limits | `lib/checkout-holds.ts`, `app/api/tickets/checkout/route.ts` | 12 requests / 15 min per actor, 6 / hour per buyer email, both before any Sanity read. Held-seat budget 40 per actor, per product, and per buyer, counted inside the reservation transaction after the idempotent-replay branch. Refusals are `429` with the existing sentence and `Retry-After`. |
| Seat-hold expiry | `lib/seat-holds.ts` | One pure rule shared by the capacity ledger and the budget. Expiry is read-time; a stranded `reserved` order past `expiresAt` holds nothing, with or without the reconcile job. |
| Webhook body cap | `lib/webhook-body.ts` | 16 KiB, enforced before buffering on both payment notification handlers; over the cap is `413`. |
| App Check | `lib/app-check.ts`, `lib/app-check-client.ts` | Checkout POST only. Off unless `APP_CHECK_ENFORCE_CHECKOUT` is set to a non-off value; the client SDK is only in the bundle when `NEXT_PUBLIC_APP_CHECK_RECAPTCHA_SITE_KEY` is set at build time. |

## Collections

- `abuseLimits`: limiter state. Fields `scope`, `entries[{t,w}]`, `expireAt`, `updatedAt`. Cleaned by a
  Firestore TTL policy on `expireAt` (declared in `firestore.indexes.json`; deploying it is an operator
  step, hand-off H3).
- `orders` / `tickets`: new optional `clientKey` and `buyerKey` (opaque keyed hashes) stamped at
  reservation. Older documents have none and never count against a budget. Retention is an input to SEC-19.

## App Check rollout order

1. POPIA processor disclosure for Google reCAPTCHA is live (H11).
2. reCAPTCHA Enterprise key and App Check app registered (H9).
3. Set the build variable and deploy: the client now sends tokens, the server flag is still off.
4. Prove a sandbox purchase passes with the flag set on a non-public backend, a tokenless request is
   refused, then enable on production. Rollback: unset `APP_CHECK_ENFORCE_CHECKOUT`.

Setting the flag without the build variable refuses every buyer by design (fail closed).

## Not covered here

Moving the SAOC-lane routes onto `consumeAbuseLimit` (H1), the scheduler for `reconcile-orders` (H7),
and the committee copy for refusal messages (H11) are hand-offs. The in-memory limiter files stay
until those callers move.
