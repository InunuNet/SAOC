# F2 — postCheckout() shape decay (decision record)

## What was found

`contracts/checks/ticketing-hardening/_shared.mjs`'s `postCheckout()` helper (line 437)
POSTs the pre-6046bc0 flat body shape `{ showId, ticketType, attendeeName, attendeeEmail }`
to `/api/tickets/checkout`. The route (`app/api/tickets/checkout/route.ts:238-434`) has
required `{ showId, lineItems: [{ ticketType, attendeeName, attendeeEmail, chosenDay? }] }`
since commit `6046bc0` (2026-08-21, "M2-F5 — pooled-capacity checkout, closes Mission Two").
`_shared.mjs` was last touched 2026-08-18, three days before the route changed — it was
never updated.

`parseLineItems(body.lineItems)` (route.ts:260) requires an array; `body.lineItems` is
`undefined` for every call `postCheckout()` makes, so `parseLineItems` returns `null` and
the route unconditionally 400s with `"showId, lineItems (1-20 valid line items) are
required."` This is not an edge case — every single call through this helper fails before
any checkout logic runs.

## Severity: confirmed real, and it blocks this mission's own F1, not just orphaned decay

Two independent findings, in order of how bad they are:

1. **F1 of this same mission (`verify-reservation-release-path`) directly depends on
   `postCheckout()`.** Its golden `check-lazy-release-frees-and-resells.mjs` A2 imports
   `postCheckout` and asserts the resulting checkout returns 201 to prove a lazily-freed
   seat is genuinely resellable. As written today, that call returns 400, not 201 — A2
   cannot pass. **F2 must land before F1 can be verified as green**, exactly as flagged.

2. **The wider `ticketing-hardening` check suite is not silently green — it is orphaned
   from the gate, not run.** `contracts/contract-ticketing-hardening.yaml` is a
   standalone contract; `execution/mission.py`'s gate resolves only
   `specs/<mission-slug>/contract-f<N>.yaml` for the *active* mission/feature
   (`execution/mission.py:892-903`), and nothing in `Makefile` or `execution/contract.py`
   sweeps all of `contracts/*.yaml` automatically. No cached result file for
   `contract-ticketing-hardening` exists anywhere in the repo (`find` for
   `*ticketing-hardening*result*` came back empty), so there is no artefact anyone could
   have mistaken for a passing run. Conclusion: this is real, currently-invisible
   regression-suite breakage (worth fixing), not a "check silently reports pass on error"
   defect (which would have been the worse class).

## Affected checks (all import `postCheckout` from `_shared.mjs`)

`contracts/checks/ticketing-hardening/`:
check-capacity-admits-when-free.mjs, check-capacity-no-oversell.mjs,
check-booking-ref-entropy.mjs, check-constant-idempotency-key-rejected.mjs,
check-idempotency-bound-to-payload.mjs, check-distinct-keys-distinct-tickets.mjs,
check-missing-capacity-fails-closed.mjs, check-idempotency-bound-to-buyer.mjs,
check-expiry-never-touches-paid.mjs, check-idempotency-key-required.mjs,
check-live-reservation-holds-seat.mjs, check-idempotency-replay-not-payable.mjs,
check-missing-price-fails-closed.mjs, check-idempotent-duplicate-post.mjs,
check-reservation-carries-expiry.mjs, check-notify-url-uses-site-url.mjs,
check-expired-reservation-releases-seat.mjs
— 17 files, plus this mission's own `check-lazy-release-frees-and-resells.mjs`
(spec goldens dir) = 18 total call sites confirmed by grep.

## Fix

Wrap the existing scalar params into the `lineItems` array shape inside the helper —
see `postCheckout-corrected.mjs` in this directory. The call signature
(`ticketType`/`email`/`name`/`idempotencyKey`/`showId`) is unchanged, so no caller needs
editing.

## Verification requirement (not just a signature fix)

Fixing the helper alone is not sufficient proof — F2's assertions must re-run a real
sample of the dependent checks against the corrected helper and confirm they now pass
for real (HTTP 201 where expected, not just "no exception thrown"). See contract-f2.yaml
A2–A4 for the three checks selected as the representative sample: one plain-success path
(check-capacity-admits-when-free), one idempotency-key path
(check-idempotency-key-required), and one multi-POST/high-volume path
(check-booking-ref-entropy) — chosen to cover the three distinct calling patterns used
across the 18 affected files.
