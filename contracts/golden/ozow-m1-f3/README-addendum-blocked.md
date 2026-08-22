# F3 addendum — live Ozow sandbox purchase is BLOCKED (external, vendor-side)

Written 2026-08-22 after F3's investigation concluded a live positive Ozow sandbox purchase
cannot currently be completed in this environment, and that this is a genuine external blocker on
Ozow's side — not a defect in this project's code. This document is the artifact a future session
(or Brad directly) should read before re-attempting A1 in its original live-purchase form.

## What A1 originally required, and why it can't pass right now

A1, as originally written, required a real BrowserAgent purchase through Ozow's sandbox to reach
`orders/{id}.status === 'paid'` with `gateway === 'ozow'`, verified against a live Firestore
readback. Three independent live attempts were made against the deployed dev site
(`https://saoc-prod--saoc-webapp.europe-west4.hosted.app`), all preserved as artifacts in
`.agent/memory/scratch/ozow-f3-live-runs/`:

1. `ozow-2026-08-22T03-52-00Z.json` — checkout returned HTTP 500, "Payment gateway is not
   configured." Root cause: Ozow sandbox secrets were missing from the deployed environment.
   **Fixed** — confirmed by run 2 returning 201.
2. `ozow-2026-08-22T04-05-46Z.json` — checkout now returns 201 and correctly redirects to
   `pay.ozow.com` with a signed payload. First attempt hit an AWS WAF 403 (headless-Chromium
   User-Agent artifact, unrelated to app correctness — confirmed via curl replay with a normal
   browser UA, which got past the WAF to a real 302 from Ozow's own nginx). Past the WAF, Ozow's
   sandbox rejected the transaction with a generic "Payment unsuccessful — An error has
   occurred." before offering any bank-simulate step. Suspected cause at the time: the
   `BankReference` field, which was `input.reference` unmodified — every real booking reference is
   `BOOKING_REF_PREFIX` (10 chars) + a 12-char random segment = 22 chars, 2 chars over Ozow's
   documented `String(20)` cap for `BankReference`.
3. The `BankReference` overflow was fixed (commit `378c1ac`, deployed, confirmed via
   `check-deploy-freshness.sh` — rollout `2026-08-22T04:24:26Z` postdates the commit) and re-tested:
   `ozow-2026-08-22T04-30-26Z.json`. `BankReference` is now correctly derived and short (e.g.
   `RC1QV4Q0QF2J`, 12 chars) — confirmed in this run's own checkout response body. **Despite the
   fix, Ozow's sandbox still immediately rejects the signed POST**, redirecting to
   `pay.ozow.com/request-error?errors=An%20error%20has%20occurred.&siteCode=INUNUNETCC87E4C79C5F`.
   A follow-up diagnostic (full network/header capture, not saved as a numbered artifact) confirmed
   this is a clean 302 from Ozow's own nginx application tier — not the AWS WAF's headless-browser
   block seen in run 2. Ozow's application itself is refusing the transaction outright, with no
   diagnostic detail beyond the generic message.

## Why this is judged external/vendor-side, not a code defect

The signature algorithm itself has been independently verified correct four separate times across
this mission:

- F1's original documentation research (`docs/payment-gateway-research-2026-08.md`'s HMAC→plain
  SHA512 correction, sourced via Alembic against Ozow's own public integration docs).
- `contracts/checks/ozow-m1-f1/check-outbound-signature.mjs` — a golden-pinned, mutation-tested
  regression check (field order, concat string, HashCheck, and a reversed-order non-vacuity case
  that proves order is load-bearing) — **still passing** as of this writing, and now additionally
  referenced by F3 as `A1` (see below).
- `qa-apex`'s independent hash recomputation during F1/F2 review.
- A final byte-for-byte hand-reimplementation against a real live failed request's field values
  during this investigation, matching the deployed `HashCheck` computation exactly (ephemeral —
  run interactively, not preserved as a script; the durable, permanent regression proof for this
  same algorithm is `check-outbound-signature.mjs`, referenced above).

Ozow's own `/request-error` response is byte-identical whether the signature is correct or
deliberately wrong (this was proven in F1's original research and holds here too) — the error
page does not discriminate between "bad signature" and "any other rejection reason," so it cannot
be used to diagnose further from the outside. Given (a) the signature is independently and
repeatedly verified correct, (b) the previously-identified real bug (`BankReference` overflow) is
fixed and confirmed deployed, and (c) the rejection is a clean redirect from Ozow's own
application tier rather than an edge/WAF artifact, the most likely remaining cause is that Ozow's
sandbox merchant account (`SiteCode INUNUNETCC87E4C79C5F`, merchant `INU-INU-002`) is not fully
provisioned/activated on Ozow's own side for accepting `IsTest=true` transactions —
`docs/payment-gateway-research-2026-08.md` already notes that some Ozow product capabilities
require explicit merchant-side activation.

## What Brad (or whoever manages the Ozow merchant relationship) needs to do

1. Log into Ozow's merchant portal for `SiteCode INUNUNETCC87E4C79C5F` and check for a
   "Test Mode" / sandbox-transactions toggle — confirm it is switched on for this site code.
2. If no such toggle is visible, contact Ozow support directly and ask them to confirm that
   `SiteCode INUNUNETCC87E4C79C5F` (merchant `INU-INU-002`) is fully activated to accept
   `IsTest=true` sandbox transactions, and that the configured `OZOW_SANDBOX_PRIVATE_KEY` is the
   private key actually paired with that site code on Ozow's side.
3. Once Ozow confirms activation (or issues a new confirmed-working key/site-code pair), re-run a
   live BrowserAgent purchase per `contracts/golden/ozow-m1-f3/README.md` §1's artifact schema,
   save it to `.agent/memory/scratch/ozow-f3-live-runs/ozow-<timestamp>.json`, and restore A1 (and
   A3) to their original live-purchase / cross-gateway forms —
   `contracts/checks/ozow-m1-f3/check-live-purchase-blocked.sh` and
   `contracts/checks/ozow-m1-f3/check-a3-cross-gateway-skip.sh` are both written to fail loudly the
   moment a run shows `allStepsPassed: true`, specifically so this blocker cannot go stale
   silently.

## What is NOT blocked

- PayFast's live purchase path (A2) is fully proven: order `WeDssUt08yMwzEYRb9Sn` reached
  `status: paid`, `gateway: payfast`, on the same deployed build as the Ozow attempts — F2's
  shared-code refactor (notification-handling extraction, `order.gateway` threading) did not
  regress PayFast's working path.
- The outbound signature construction, checkout wiring, provider registry, and notification
  routing are all shipped, gated, and Codex-reviewed per round (F1/F2/F2b). The blocker is
  specific to Ozow's sandbox accepting the transaction at all, not to anything this project
  controls.
