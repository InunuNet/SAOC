# sec-stand-orders (mission nos-security-tiered-access, F5)

Closes the vendor-stand half of SEC-06 (sandbox-paid stand orders read as paid) and SEC-22 (stand-payment links are non-revocable 30-day bearer tokens; a leaked link can supersede the vendor's in-flight payment), both from `specs/nos-security-tiered-access/audit/findings.md`. Base `98aa1da1` (F4/#69 merged). Every claim below was re-read in the code at that base.

## Decision

1. **SEC-06.** Stamp every new `vendorStandOrders` document with `issuedInTestMode` at initiate, from the same `isIssuanceTestMode()` F4 built for tickets. A stand order **counts as paid** only when `status === 'paid'` and, once the launch constant is live, `issuedInTestMode === false` (literal). Untagged means test. One pure module, `lib/vendor-stand-order-paid.ts`, owns the rule, and every reader that today compares a stand order to `'paid'` goes through it. Test mode (today) is unchanged: every paid order counts.
2. **SEC-22.** Each payment link is recorded on the submission (`standPaymentLink: { nonce, ... }`). Resend and approval write a new record, which supersedes every earlier link. A new admin-gated route revokes. Initiate refuses a stale link, refuses a re-initiate while a non-expired attempt exists (30 minutes), and is rate-limited by F3's durable limiter. The token TTL is capped.
3. **No prod writes, no backfill.** The 2 prod stand orders have no stamp. Reads classify them as test once live, so they need no write. The vendors behind them simply pay again for real (see Hand-offs).

## What the code does today (verified at 98aa1da1)

| Claim | Verified at | Result |
|---|---|---|
| Stand orders carry no sandbox marker | `app/api/vendors/stand-payment/initiate/route.ts:242-258` writes `id, vendorSubmissionId, businessName, contactEmail, boothSize, amount, expectedGatewayAmount, tier, status, gateway, gatewayPaymentId, standOrderRef, attemptId, createdAt, paidAt, failedAt`. No test marker | holds |
| Initiate already reads the Ozow toggle once | `initiate/route.ts:219` `isOzowSandboxTestModeEnabled()` before the transaction, feeding `resolveExpectedGatewayAmount` | the stamp reuses this value; no second read (A4) |
| Settlement marks a stand paid and sets the office flag | `lib/vendor-stand-payment-notification.ts:339-344`: `status: 'paid'`, `paidAt`, `gatewayPaymentId`, and `transaction.update(submissionRef, { paymentReceived: true })` | the flag is the sandbox-contaminated denormalisation |
| Settlement emails the admin and the vendor on every paid order | same file `:304-326` assigns `paidNotice`, sent `:422-491` | a sandbox payment emails a real vendor a receipt |
| Readers that treat `status === 'paid'` as paid | `initiate/route.ts:124,231` (already-paid refusal), `resend-payment-link/route.ts:68`, `payment/page.tsx:146` (page fallback), `app/admin/(shell)/vendors/page.tsx:64` (cast), `app/admin/(shell)/vendors/[id]/page.tsx:26,58-60`, `VendorReviewTable.tsx:361` (hides the link control on `paid`), `payment/status/page.tsx:91-96` (shows "confirmed") | all go through one rule after F5 |
| `paymentReceived` is written by two different actors | settlement (no `paymentConfirmedBy`) and `app/api/admin/vendors/[id]/payment/route.ts` -> `lib/vendor-payment.ts` (patch always sets `paymentConfirmedBy`) | the two are told apart by `paymentConfirmedBy`; see D2 |
| Booth allocation is not gated by payment | `decideVendorPaymentUpdate` in `lib/vendor-payment.ts`: only `status === 'approved'` and booth uniqueness; `isVendorListingEligible` in `lib/vendor-listing.ts`: eligibility is `status === 'approved'` only | nothing to gate; see N2 |
| Token is a non-revocable 30 day bearer, nonce unused | `lib/vendor-stand-payment-token.ts:46` TTL, the 128-bit nonce is minted in `mint`, `verify` returns only `vendorSubmissionId` and `expiresAt` | holds |
| Resend mints without invalidating | `resend-payment-link/route.ts:89-92`: `mint`, return `paymentUrl`, no record | holds; copy-only since #150 |
| Re-initiate overwrites the live attempt | `initiate/route.ts:213` fresh `attemptId`, `:242` `.set()`; the only guard is the gateway-Pending hold (`:131-134`, `lib/payments/pending-hold.ts`) | holds; absent until a gateway reports Pending |
| Initiate has no limiter | grep for rate/429 empty | holds |

## Decisions

Each decision names its source. A value with no source in the repo, Brad's or Lee-Ann's material is NAMED and listed under DECISION NEEDED.

### D1. Stamp and rule: reuse F4 exactly. Decided.
- `issuedInTestMode = isIssuanceTestMode({ ozowSandboxTestMode: ozowSandboxTestModeEnabled })` computed once at initiate after the toggle read and before the transaction (`// anchor: stand-stamp`), written into the stand order document as a boolean own-property, never undefined (CLAUDE.md "Firestore builders" rule). The request body is never read for it. Source: `lib/ticket-issuance-mode.ts:17-19`, `docs/door-reject-test-tickets.md` "Gateway coupling".
- F4 decided there is no three-state toggle reader: an unreadable toggle maps to `false`, which means no R0.01 override, the vendor is charged full price, so a live stamp is correct for that order (`docs/door-reject-test-tickets.md`). The same holds here: `resolveExpectedGatewayAmount` already keys off the same value, so the stamp and the amount cannot disagree.
- Rule (`standOrderCountsAsPaid(order, { liveMode })`): `status === 'paid'` (own property, exact string) AND (`!liveMode` OR `issuedInTestMode === false` literal). Missing, `null`, `true`, strings, numbers, objects, arrays, inherited values: not counted live. `liveMode = !isTicketingTestMode()` (`lib/ticketing-test-mode.ts:9`), the same input the door uses. Pinned by `stand-order-paid.golden.ts` section 1, including the two prod-shaped documents (`goldens/fixtures/prod-stand-orders.json`).
- Settlement never relabels provenance and never backfills (`docs/door-reject-test-tickets.md` "Consequences"). The `status: 'paid'`, `paidAt`, `gatewayPaymentId` write stays unconditional: money moved in the sandbox and the record must say so.
- `lib/ticket-issuance-mode.ts`, `lib/payments/*`, `lib/ticketing-test-mode.ts` are unchanged (A15).

### D2. Where "counts as paid" is applied. Decided.
| Reader | After F5 |
|---|---|
| Settlement (`decideStandSettlement`) | live + untagged: still writes `paid`, but does **not** set `submission.paymentReceived: true` and sends **no** admin notice and **no** vendor receipt (logs `vendorSubmissionId` only). The office flag is written only as `true` and only when counted, so it can never overwrite an office-recorded `true` with `false`. Test mode: unchanged |
| Initiate (`decideStandInitiate`, before and inside the transaction) | a paid order that does not count is **not** "already paid": the vendor can pay again, and the new attempt overwrites the document with a fresh stamp. This is the path that lets the 2 prod vendors pay for real |
| Resend route | already-paid refusal uses the same rule |
| Vendor payment page and status page | page fallback and "confirmed" use the same rule; the page also applies the link gate |
| Admin list and detail | status shown is `effectiveStandPaymentStatus`: `paid` only when counted, otherwise `test-paid` (stopgap label, D8). The "Office payment" value is `vendorOfficePaymentReceived`: an office-recorded receipt (`paymentConfirmedBy` non-blank, written only by the admin payment route) is trusted as is; a gateway-set flag is trusted only through the stand order. The two prod submissions carry `paymentReceived: true` from sandbox settlements; they read "Not received" live with no write |
| Booth allocation, listing publication | unchanged (DECISION NEEDED N2 records why) |

### D3. Link record and supersede. Decided (shape), no new numbers.
- `vendorSubmissions/{id}.standPaymentLink = { nonce, issuedAt, expiresAt, issuedBy, revokedAt, revokedBy }`, built by `buildStandPaymentLinkRecord` (no undefined, `revokedAt: null`). It lives on the submission, not the stand order, because a link exists before any stand order does (approval and resend precede initiate). No new collection, no index, no rules change.
- `mintVendorStandPaymentToken` already embeds a 128-bit nonce (`n`) that nothing reads. It now also returns `nonce`, and `verify` returns it. Domain separation and the payload shape are unchanged.
- `decideStandLinkUse({ tokenNonce, record, now })`: record absent (`undefined` or `null`) -> `{ ok: true, legacy: true }`; present but not an object, nonce not a non-empty string, or `expiresAt` unreadable -> `malformed-record` (fails closed: present-but-garbage is not legacy); any non-null `revokedAt` -> `revoked` (checked first); `nonce !== tokenNonce` -> `superseded`; `now >= expiresAt` -> `expired`.
- **Migration window (explicit, like the F3 `attemptId` carve-out in CLAUDE.md):** a submission approved before F5 has no record, so its already-emailed links keep working until the next resend or revoke writes a record. Revoke of a record-less submission writes a record with a fresh random nonce and `revokedAt` set, which kills those legacy links too (`buildStandPaymentLinkRevocation`). This is the honest limit: F5 cannot invalidate a legacy link nobody revokes; the admin revoke path is the control.
- Writers: approval (`review/route.ts`) and resend each write the record **before** the link is emailed or returned; a failed write in the approval callback means no email (logged, non-fatal, same shape as the existing step). Revoke is a new route.

### D4. Bounded expiry. Source: existing constant; keep it. NAMED only for any change.
- `VENDOR_STAND_PAYMENT_TOKEN_DEFAULT_TTL_MS` is 30 days (`lib/vendor-stand-payment-token.ts:46`, rationale in its comment: slow committee-to-vendor turnaround). It is already a bound; what was unbounded is the optional `ttlMs` override and the lack of a stored expiry. F5 adds `VENDOR_STAND_PAYMENT_TOKEN_MAX_TTL_MS` (equal to the default), clamps `ttlMs` to it, throws `RangeError` for a non-positive or non-finite `ttlMs`, and stores `expiresAt` on the record so an admin can see and the server can enforce it independent of the token. Decided: keep 30 days (N3).

### D5. In-flight attempt window: 30 minutes. NAMED, source `lib/tickets-constants.ts:9`.
- Audit fix sketch: "refuse a re-initiate while a non-expired attempt from the last N minutes exists, regardless of gateway pending state." N is the time a payment attempt can legitimately be open at the gateway. The repo's only measured figure for that is `RESERVATION_TTL_MINUTES = 30` (`lib/tickets-constants.ts:9`, whose comment ties it to the observed sandbox bank round trip with margin; reused here as the same gateway-attempt budget, an assumption stated, not measured for stand payments).
- Rule: `status === 'pending'` and `0 <= now - createdAt < 30 min` (a small forward skew, 5 minutes, is tolerated as in `pending-hold.ts`; a `createdAt` further in the future, missing or unreadable is treated as no attempt, so a bad document can never lock a vendor out). Gateway-Pending hold (72 h, `lib/payments/pending-hold.ts:7`) is unchanged and outranks it. `failed` and `cancelled` never block a retry.
- Reasons and copy (existing strings, verbatim): `already-paid` -> `ALREADY_PAID_MESSAGE` 409; `pending-hold` and `attempt-in-flight` -> `PENDING_NOTICE_BODY` ("We're still waiting for payment confirmation. Please don't refresh or submit payment again.") 409.
- Cost: a vendor who closes the tab at the bank without cancelling waits up to 30 minutes to retry; Ozow sends a Cancelled notification which clears it at once. Decided: N1.

### D6. Initiate rate limit. NAMED; source F3's precedent.
- Two limits through F3's `consumeAbuseLimit` (durable, Firestore, fail closed): per actor `12 / 15 min` before the body is parsed (`clientActorKey(request.headers.get('x-forwarded-for'))`, trusted hop only), and per submission id `6 / hour`, consumed **after** verify, the link gate and the status checks. Order matters: only a holder of a currently valid link can spend a vendor's budget, so a leaked, superseded or revoked link cannot exhaust it and lock the vendor out. Numbers are F3's own D3 (`12 per 15 min` per actor, `6 per hour` per buyer) in `.agent/memory/project/specs/sec-abuse-controls/spec.md`, themselves NAMED and awaiting SAOC approval; F5 reuses them, so one approval covers both. They live in `STAND_PAYMENT_LIMITS` (frozen, golden-pinned).
- 429 copy: the checkout string `Too many attempts. Please try again later.` verbatim with `Retry-After`. Limiter outage: 503 with `GATEWAY_NOT_CONFIGURED_MESSAGE` ("Payment gateway is not configured. Please try again later."), existing and apt; initiate already writes to Firestore so an outage already fails it, and failing open would silently drop the limit (F3 D1).
- Dependency: needs `lib/abuse-limiter.ts` and `clientActorKey` from `fix/sec-abuse-controls` (head `5679648d`, API: `consumeAbuseLimit({ scope, key, maxAttempts, windowMs })`, `AbuseLimitDecision`, `AbuseLimiterUnavailableError`, `clientActorKey(header)`). **F3 must be merged before F5 dev starts** (A1 enforces it). F5 does not touch the limiter or `lib/client-ip.ts` (A15).

### D7. Admin revoke and expiry path. Decided.
- `POST /api/admin/vendors/[id]/revoke-payment-link`, exported methods exactly `POST`. Same gate as resend: `getAdminSession()` (`reason` no-session/invalid-session -> 401, else 403), then `hasCapability(..., 'review-vendor-applications')`, before any Firestore access. No new capability (the resend and review routes use it; `lib/admin-auth.ts` and `docs/admin-access.md` unchanged). Sends nothing. Writes with `update` only. Revoking and then resending yields a working new link; resending alone supersedes.
- The "expiry" half of the admin path is the stored `expiresAt` plus revoke; there is no separate shorten-expiry control (nothing in the audit asks for one and it would be an extra surface).
- **No UI button in F5.** A control needs a label ("Revoke payment link" or similar), which is new admin copy. Route-only until the committee supplies copy (D8). #150's copy-only resend control is untouched.

### D8. Copy. No new user-facing copy.
Reused verbatim: `This payment link is no longer valid.` (superseded, revoked, expired, malformed: the existing generic 403), `This stand has already been paid for.`, the pending notice, the 429 and gateway-not-configured strings. One gap, named like F3's D8: the admin pill for a counted-out paid order needs a label. Stopgap `'test-paid': 'Test paid'` in `STAND_PAYMENT_LABELS`, marked `// awaiting committee copy`, tone `neutral` (existing). A12 allows exactly that string. Also awaiting copy: the revoke button label.

### D9. Cache-header probe entries for the two bearer-token URLs (SAOC P3). Decided, observed not assumed.
- Paths confirmed from the `app/` tree and the proxy rewrite (NOS-host `/vendors/...` is rewritten under `/national-show/...`): the vendor stand-payment token page is `app/(nos)/national-show/vendors/payment/page.tsx`, public URL `/vendors/payment?token=...` (built in `app/api/admin/vendors/[id]/resend-payment-link/route.ts` `buildVendorStandPaymentUrl` and the approval email). The order-recovery URL is `/tickets/recover?token=...` (`lib/recovery-url.ts:15`, used by `lib/confirmation-email.ts:180`).
- Observed 2026-10-29 on a local production build of this base (`next build` with Sanity stubbed, `next start`, `SITE_PUBLIC_LAUNCH=true`, Host header, GET only), bogus token:
  - `nos` `/vendors/payment?token=bogus` -> 200, `private, no-cache, no-store, max-age=0, must-revalidate` (the page's existing fallback; dynamic because it reads `searchParams`).
  - `nos` `/tickets/recover?token=bogus` -> **404**, same no-store header.
  - Controls: `nos` `/vendors/payment/status?a=bogus` -> 200 no-store; `nos` `/tickets/confirmation?ref=bogus` -> 500 no-store only because this probe blanks Firebase credentials (not recorded). On the `saoc` host `/vendors/payment` is a 404 with `s-maxage=31536000` (no such page on that host, no token page there) and `/tickets/recover` is a 308 to the nos host.
- Both entries are added to `routes.dynamic` in `.../m3-f3-sanity-volume/goldens/cache-header-expectations.json` with host `nos` and the observed status. The probe's `dynamic` rule (`no-store`, not `s-maxage`) is unchanged and `/tickets/no-such-ticket-f4` is untouched. A24 pins the entries; A25 runs the whole probe.
- **Finding for SAOC (not fixed here, out of F5 scope): the order-recovery deep link emailed to buyers 404s.** `lib/recovery-url.ts` builds `/tickets/recover?token=...` but no `app/` route handles `/tickets/recover`; `app/(nos)/tickets/[slug]/page.tsx` treats `recover` as an unknown ticket slug. The probe entry records today's real 404, so it will start failing when a recover page lands (the status becomes 200): whoever builds it must update this entry's status in the same change and keep the page dynamic and no-store.
- Local-run limit: `scripts/checks/lib/local-next-server.mjs` puts the preload path in `NODE_OPTIONS` unquoted, so `cache-headers-probe.mjs --spawn` aborts with `ERR_UNSUPPORTED_DIR_IMPORT` when the repo path has a space (this machine). The observation above used a throwaway runner that quotes it. Not patched here; a script-level fix (quote the value) is a separate one-line change for SAOC.

## Specification

### New pure modules (client-safe, no Firestore)
`lib/vendor-stand-order-paid.ts`: `StandPaymentDisplayStatus`, `standOrderCountsAsPaid`, `effectiveStandPaymentStatus`, `decideStandSettlement`, `vendorOfficePaymentReceived`. Reads own properties only (`Object.hasOwn`), rejects arrays.
`lib/vendor-stand-payment-link.ts`: `STAND_PAYMENT_ATTEMPT_WINDOW_MINUTES` (30), `STAND_PAYMENT_LIMITS` (frozen), `STAND_PAYMENT_IP_SCOPE`, `STAND_PAYMENT_TOKEN_SCOPE`, `buildStandPaymentLinkRecord`, `buildStandPaymentLinkRevocation`, `decideStandLinkUse`, `decideStandInitiate`. Signatures are exactly those the goldens call.
`lib/vendor-stand-payment-token.ts`: `mint` returns `nonce`; `verify` ok result returns `nonce`; `VENDOR_STAND_PAYMENT_TOKEN_MAX_TTL_MS`; TTL clamp and `RangeError`.

### Initiate order (`app/api/vendors/stand-payment/initiate/route.ts`)
body-size check -> actor limit (`stand-ip-limit`) -> parse body -> secret -> `verify` -> submission read -> `status === 'approved'` -> **link gate** (`stand-link-gate`, generic 403 on any not-ok) -> **per-submission limit** (`stand-token-limit`) -> stand order read -> `decideStandInitiate` (409) -> booth size -> price -> gateway -> toggle read -> **stamp** (`stand-stamp`) -> transaction: re-read, `decideStandInitiate` again, `.set()` including `issuedInTestMode` -> gateway hand-off. The existing separate pending-hold block is subsumed by `decideStandInitiate` (same behaviour, same copy).

### Settlement (`lib/vendor-stand-payment-notification.ts`)
Deps gain `liveMode?: boolean` (default `!isTicketingTestMode()`), the one seam the dev uses to test live behaviour. Inside the paid transaction, after the existing guards and the submission read: `const settlement = decideStandSettlement(order, { liveMode })` (`stand-settlement-decision`). `paidNotice` is assigned only when `settlement.sendNotices`; `transaction.update(submissionRef, { paymentReceived: true })` only inside `if (settlement.paymentReceived) {`. Everything else (verify, amount guards, confirm once outside the transaction, attempt-id guard, pending and failed paths) is untouched. F3 replaces `await request.text()` at `:98` with a capped reader; the F5 hunk is far from it, so the merge is mechanical.

### Anchor table (each `// anchor: <name>` is immediately followed by the one statement named; the token must appear on that line)
| anchor | file | statement carries |
|---|---|---|
| `paid-status` `paid-live-rule` `own-key` `array-guard` `effective-test-paid` `settlement-return` `office-flag` `office-trim` `office-fallback` | `lib/vendor-stand-order-paid.ts` | `!== 'paid'`; `!options.liveMode ||` and `=== false`; `Object.hasOwn(order, key)`; `|| Array.isArray(order)`; `'test-paid'`; `sendNotices: counts` and `paymentReceived: counts`; `!== true`; `by.trim()`; `standOrderCountsAsPaid(standOrder, options)` |
| `limits-constant` `attempt-window` `record-revoked-null` `revocation-legacy` `link-legacy` `link-malformed` `link-revoked` `link-nonce` `link-expiry` `initiate-paid` `initiate-hold` `initiate-window` | `lib/vendor-stand-payment-link.ts` | `Object.freeze(`, `ipRequests: 12`, `tokenRequests: 6`; `= 30;`; `revokedAt: null`; `nonce: input.freshNonce`; `r === undefined || r === null` and `legacy: true`; `rec.nonce === '' ||`; `rec.revokedAt !== null &&`; `rec.nonce !== input.tokenNonce`; `>=`; `liveMode: input.liveMode`; `isPendingPaymentHoldActive(order.gatewayPending, input.now)`; `elapsed <` and `elapsed >= -MAX_CLOCK_SKEW_MS` |
| `token-ttl-valid` `token-ttl-cap` `token-nonce-verify` | `lib/vendor-stand-payment-token.ts` | `|| requested <= 0`; `Math.min(requested, VENDOR_STAND_PAYMENT_TOKEN_MAX_TTL_MS)`; `nonce: payload.n` |
| `stand-ip-limit` `stand-link-gate` `stand-token-limit` `stand-stamp` `stand-limiter-fail-closed` | initiate route | `clientActorKey(request.headers.get('x-forwarded-for'))`; `decideStandLinkUse(` with `verification.nonce` and `standPaymentLink`; `key: vendorSubmissionId` on the `consumeAbuseLimit` line; `isIssuanceTestMode({ ozowSandboxTestMode: ozowSandboxTestModeEnabled })`; `status: 503` |
| `stand-settlement-decision` | notification | `decideStandSettlement(` |
Un-anchored pinned spellings the mutations rely on: `if (settlement.paymentReceived) {`, `deps.liveMode ?? !isTicketingTestMode()`, `if (!linkDecision.ok) {\n    return genericTokenRefusal();\n  }`, `if (!hasCapability(`, `if (!session.ok)`, `buildStandPaymentLinkRecord(`, `buildStandPaymentLinkRevocation(`, `freshNonce: randomBytes(16).toString('hex')`, `!isTicketingTestMode()` in every reader, the `Retry-After` header, the 429 string. A NOT APPLIED line in `run_mutations.py` means a spelling differs: change the code to the spelling, never the runner.

## Hunk list (SAOC clearance; A14 fails on any other file)

All files are in the SAOC lane (vendor or admin) except where noted. Estimated size from a throwaway reference implementation that passes every assertion: 14 files, about 145 added lines.

| File | Change | Why |
|---|---|---|
| `lib/vendor-stand-order-paid.ts` (new) | pure counts-as-paid rule, effective status, settlement decision, office-flag derivation | one rule instead of scattered `=== 'paid'` |
| `lib/vendor-stand-payment-link.ts` (new) | link record, revoke, link-use and initiate decisions, named numbers | SEC-22 as pure, testable decisions |
| `lib/vendor-stand-payment-token.ts` | mint returns `nonce`; verify returns `nonce`; TTL cap; `RangeError` | link identity and bounded expiry; payload shape unchanged |
| `lib/vendor-stand-payment-notification.ts` | `deps.liveMode`; `decideStandSettlement`; `paidNotice` and `paymentReceived:true` conditional; one log line. Nothing else | SEC-06: a sandbox payment must not become a receipt or an office "received" once live. Hunks at about `:89-91` (deps), `:137` (liveMode), `:146` (type), `:297-345` (paid transaction) |
| `lib/vendor-stand-payment-labels.ts` | `'test-paid'` stopgap label, key type widened | admin pill (D8) |
| `types/index.ts` | `issuedInTestMode?: boolean` on `VendorStandOrder` | stamp type; optional because legacy documents lack it |
| `app/api/vendors/stand-payment/initiate/route.ts` | actor limit; link gate; per-submission limit; `decideStandInitiate` before and inside the transaction (replaces the paid check and the separate pending-hold block); stamp; `issuedInTestMode` in the `.set()` | SEC-22 and SEC-06 |
| `app/api/admin/vendors/[id]/resend-payment-link/route.ts` | write the link record from the minted nonce; already-paid check uses the rule. Still no email | supersede on resend; keeps #150 |
| `app/api/admin/vendors/[id]/review/route.ts` | write the link record before the approval payment email | first link is recorded |
| `app/api/admin/vendors/[id]/revoke-payment-link/route.ts` (new) | admin-gated revoke | SEC-22 revoke path |
| `app/admin/(shell)/vendors/page.tsx` | read stand orders whole; derive status map with `effectiveStandPaymentStatus` and `paymentReceived` with `vendorOfficePaymentReceived` before the rows reach the client table | admin list fails closed |
| `app/admin/(shell)/vendors/[id]/page.tsx` | same for one vendor; drops the `STAND_ORDER_STATUSES` allowlist | admin detail fails closed |
| `components/admin/VendorReviewTable.tsx` | prop and tone-map types widened; `'test-paid': 'neutral'`. The `standPaymentStatus !== 'paid'` line stays, so a test-paid vendor still gets the link control | type only |
| `components/admin/VendorSubmissionDetail.tsx` | prop type widened | type only |
| `app/(nos)/national-show/vendors/payment/page.tsx` | link gate; already-paid fallback uses the rule | a revoked link shows the existing fallback |
| `app/(nos)/national-show/vendors/payment/status/page.tsx` | "confirmed" only when counted | no false confirmation |
| `docs/vendor-stand-payment-settlement.md`, `docs/stand-order-test-mode.md` (new) | docs | `CLAUDE.md` (floor-protected) is a SAOC follow-up |
| `contracts/checks/live-write-guard/writers-registry.json` | 2 STATIC_FP entries (done in this commit) | A20 |
| `.agent/memory/project/specs/backlog-wave-1028/m3-f3-sanity-volume/goldens/cache-header-expectations.json` | two `routes.dynamic` entries (done in this commit): nos `/vendors/payment?token=bogus` 200, nos `/tickets/recover?token=bogus` 404 | SAOC P3: bearer-token URLs pinned per-request (D9) |

Read and deliberately not touched: `app/api/admin/vendors/[id]/payment/route.ts` and `lib/vendor-payment.ts` (booth allocation), `lib/vendor-listing.ts` and `publish-listing` (listing), both `*-itn` routes, `lib/vendor-stand-order-amount.ts`, `lib/vendor-stand-orders.ts`, every `lib/payments/*`, `firestore.rules`, `firestore.indexes.json` (equality filters on automatic indexes; no new query), `apphosting.yaml`.

## Interactions
- **F4**: same stamp function and same literal-false rule; `liveMode` is the door's input. Settlement never relabels (F4 doc "Consequences").
- **F3**: limiter and actor key reused; `lib/vendor-stand-payment-notification.ts:98` is rewritten by F3 (capped body reader). F5's hunks do not overlap.
- **#150**: resend stays copy-only; approval still emails the link.
- **F3 `attemptId` migration carve-out** (CLAUDE.md, `notification.ts:221`): unchanged.
- **Go-live flip**: flipping `TICKETING_PAYMENTS_LIVE` is a reviewed code change (`lib/ticketing-test-mode.ts`). From that deploy, every stand order without a literal-false stamp reads as test; vendors must pay again for real.

## Hand-offs for SAOC (no code runs these)
- **H1, the 2 prod stand orders (no backfill).** Nothing to write. They are untagged, so once live they read `test-paid`, the vendor payment page offers payment again, and initiate overwrites the document with a live-stamped attempt. Before go-live SAOC may confirm the count read-only (status `paid`, gateway `payfast` and `ozow`, no `issuedInTestMode`). Do not set the field on them: that would relabel sandbox money as live.
- **H2, their submissions.** Both carry `paymentReceived: true` from the sandbox settlements. Readers ignore a gateway-set flag unless the stand order counts, so no write is needed; if SAOC wants the stored flag cleared for tidiness it is a prod data edit for SAOC, not NOS Site.
- **H3, links.** The 2 vendors' emailed links have a 30 day TTL and will have lapsed by go-live. After the flip an admin resends (copy-only) from the vendor row; the old link is superseded automatically.
- **H4, legacy links.** Approved vendors who have an emailed link and no record keep a working link until a resend or revoke. If a specific link is known leaked, use the revoke route (or a resend).
- **H5, copy.** Committee copy needed for the `test-paid` pill and a revoke button label (D8).
- **H6, CLAUDE.md** `vendorStandOrders` row (`issuedInTestMode`, `standPaymentLink`): done by SAOC via Route 1 when F5 merges. Not an F5 item.

## Decided by SAOC lead 2026-10-29 (hunk list cleared as specified at 1c350798)
- **N1.** In-flight window 30 minutes (`RESERVATION_TTL_MINUTES`, `lib/tickets-constants.ts:9`).
- **N2.** Booth allocation and listing publication stay ungated. SAOC logs it as a business-process question, not a security gap.
- **N3.** Keep the 30-day link lifetime.
- **N4.** Reuse F3's limits: 12 per 15 minutes per actor, 6 per hour per submission.
- **N5.** Legacy record-less links stay valid until a resend or revoke. They are HMAC-bound and expire within 30 days, so there is no backfill.
- **N6.** `Test paid` ships as the flagged admin-only stopgap. No revoke button and no new copy: the revoke route is API-only.
- **Hand-offs accepted by SAOC:** the 2 prod stand orders are never stamped, and an admin resends after the go-live flip (go-live checklist). SAOC adds the `CLAUDE.md` `vendorStandOrders` row via Route 1 when F5 merges (H6 is no longer an open item).
- **Cache-header expectations file:** F5 touches only its two entries (D9). SAOC adds its own `/admin`, `/api/admin` and `/events/submit` entries after F5 merges.

## Not proven / limits
Pure goldens and static wiring: they do not prove the deployed Firestore transaction behaviour, a real Ozow/PayFast round trip, a real revoke through a browser, or the production `X-Forwarded-For` hop count (F3 H4). The triad browser and inbox checks are post-deploy only (A22, A23, non-required). The approved-booth-size-from-submission idea in the SEC-22 sketch is not done: the vendor chooses 1, 2 or 3 at payment time by design.
