# Ozow M1/F1 golden — decision record

Mission `ozow-payment-provider`, M1/F1: `lib/ozow.ts` (signature builder) + `lib/payments/ozow.ts`
(PaymentProvider adapter). Written 2026-08-22 by @architect-apex. This feature is **additive
only** — zero changes to `lib/payments/index.ts`, `lib/payments/types.ts`, `lib/payments/payfast.ts`,
`lib/payfast.ts`, or either existing `app/api/tickets/` route. Checkout wiring is F2.

## 1. The algorithm claim was independently verified, not trusted secondhand

`docs/payment-gateway-research-2026-08.md` (2026-08-14) states Ozow uses HMAC-SHA512. The mission
brief and an earlier architect spec (`.agent/memory/project/specs/ozow-payment-provider/spec.md`)
both say that's wrong — plain SHA512, not HMAC. Before writing this contract, that correction was
re-verified independently via Alembic against Ozow's own current public docs, not taken on the
strength of the earlier spec:

- `curl -s "http://localhost:7077/https://ozow.com/integrations"` (fetched 2026-08-22) — Ozow's
  own integration page states, verbatim: *"Generate the Post Hash Check: 1. Concatenate the post
  variables (excluding HashCheck) in the order they appear in the post variables table. 2. Append
  your secret key to the concatenated string... 3. Convert the concatenated string to lowercase.
  4. Generate a SHA512 hash of the lowercase concatenated string."* No mention of HMAC anywhere on
  the page. The full 17-field outbound post-variable table and the 13-field notification-response
  table were pulled from this same page and are reproduced in `ozow-wire.golden.json`'s field
  orders.
- `curl -s "http://localhost:7077/?q=Ozow+HashCheck+signature+generation+SHA512+integration"` —
  corroborated by `api.i-pay.co.za/guide/payment` (independent third party implementing the same
  Ozow integration, same four-step description) and by a public Laravel integration example
  (`medium.com/@respectmurimi2000/...`) that shows the *response-side* verification code literally:
  `hash('sha512', strtolower(implode('', [SiteCode, TransactionId, TransactionReference, Amount,
  Status, private_key])))` — plain `hash()`, not `hash_hmac()`. That snippet also independently
  confirms the 3-value status enum (`Complete` / `Cancelled` / anything else falls through to
  `failed`), matching this contract's A5.

**Conclusion: the mission brief and prior spec were right, `docs/payment-gateway-research-2026-08.md`
is wrong, and this is now verified against Ozow's own current docs rather than inherited from an
earlier pass.** F3 (per the mission plan) corrects the research doc; this feature does not touch
it.

## 2. The live sandbox probe — what was actually observed, and what wasn't

Per the dispatch brief: "golden-pin the actual request/response shape observed from the sandbox,
not a mocked/invented shape." A real POST was made to `https://pay.ozow.com` using the REAL
sandbox credentials already staged in `.env.local` (`OZOW_SANDBOX_SITE_CODE`,
`OZOW_SANDBOX_PRIVATE_KEY`, account INU-INU-002), built with exactly the algorithm above, `IsTest:
"true"`, the documented 17-field order.

**Observed:** `HTTP 200`, redirected to `https://pay.ozow.com/request-error?errors=An%20error%20has%20occurred.&siteCode=INUNUNETCC87E4C79C5F`.

**Then, as a control:** the identical request was re-sent with the `HashCheck` field replaced by
128 zero characters (a deliberately wrong signature). **Result: byte-identical response** — same
status, same redirect, same generic error text.

**What this proves:** the request reaches Ozow's real sandbox site for this real site code (no
DNS/network/site-code problem), but `pay.ozow.com`'s response does not distinguish a correct
signature from an incorrect one over a raw, non-browser HTTP POST. The returned page loads
`aegis-node.v1.2.0.min.js` and Datadog RUM device-fingerprinting (`aegisApiUrl:
"https://payments-fingerprints.ozow.com/v1/device/signals"`, `fingerPrintUrl`,
`isDeviceProfileEnabled`) ahead of whatever server-side hash check exists — consistent with a bot/
fraud-detection layer rejecting non-browser POSTs before the hash is even evaluated, not with a
signature failure. This was not tested further (no browser session available to this feature's
scope) — the mission's own plan puts exactly this proof at F3, via BrowserAgent against the
deployed dev site, which is the honest way to observe a real successful redirect. **This contract
therefore does not claim a captured successful sandbox transaction shape** — inventing one would
be exactly the "mocked/invented shape" the dispatch brief said not to produce. What it does pin is
the outbound wire format computed by the verified real algorithm, and documents the real (if
inconclusive) connectivity attempt honestly.

## 3. Why the golden uses fabricated credentials, not the real sandbox secret

Mirrors `contracts/golden/payment-seam-f1/payfast-wire.golden.json`'s own stated practice ("Every
merchant id, key and passphrase below is a fabricated test value"). The real
`OZOW_SANDBOX_PRIVATE_KEY` from `.env.local` was used only for the live probe in §2, in memory, and
is not written anywhere in this repository. `ozow-wire.golden.json`'s `credentials` block is a
fabricated 32-character-shaped test key; every hash in that file is computed against it, and is
independently reproducible offline by anyone re-running the documented algorithm — this is what
makes the golden a genuine algorithm proof rather than a secret-dependent one.

## 4. Design decisions this golden bakes in (F1's job to fix, not F2's)

`InitiateInput` (per `lib/payments/types.ts`, unchanged) has no field for Ozow's `BankReference`
or `ErrorUrl`. Per the architect spec's own walkthrough (§1), these are adapter-internal choices,
not interface gaps. This contract fixes them concretely so the golden is well-defined:

- `BankReference = input.reference` (identical to `TransactionReference` — there is no other
  candidate value on `InitiateInput`, and reusing the order reference is what appears on the
  buyer's bank statement, which is the field's documented purpose).
- `ErrorUrl = input.cancelUrl` (no separate error URL exists on `InitiateInput`; treating "cancel"
  and "error" as the same return destination is the simplest correct choice given the input shape).
- `CountryCode = 'ZA'`, `CurrencyCode = 'ZAR'`, `IsTest = 'true'` are adapter-owned constants
  (mirrors `PAYFAST_SANDBOX_PROCESS_URL`'s category) — this mission is sandbox-only throughout, so
  `IsTest` is hardcoded true in F1, not read from environment; going live is out of scope and a
  future feature's job to flip.
- `Optional1`–`Optional5` and `Customer` are sent empty — `InitiateInput` carries no equivalent
  data, mirroring how PayFast's adapter drops `itemName` cleanly (§1 of the spec already covers
  this exact category of "no-op field", it is not new to this contract).

## 5. `confirmNotification` is a declared stub in F1, same category as PayFast's `refund()`

Ozow's REST status-check endpoint (the mechanism `confirmNotification` would call, per the spec's
walkthrough) needs an `ApiKey`-authed request whose exact field-level shape is NOT independently
verifiable right now: `oldhub.ozow.com`, the domain the spec's own §0 cited for refund/status API
detail, no longer resolves (`NXDOMAIN`, checked via Alembic 2026-08-22 — dead between the spec
being written on 2026-08-21 and this contract on 2026-08-22, or the spec's Alembic search snippet
was never confirmed live in the first place). No live replacement documentation was found. Per
this project's own precedent (`contract-payment-seam-f1.yaml` A7 — PayFast's `refund()` is a
"DECLARED SIGNATURE ONLY... inventing new behaviour here would smuggle in unverifiable behaviour
no route reaches and no live test exercises"), F1's `confirmNotification` follows the same
discipline: it returns `{ confirmed: false, reason: 'not-configured' }` unconditionally and makes
zero network calls. Wiring the real REST call is deferred to a feature that can first pin its
shape from a live, successful call — which requires a completed sandbox transaction to confirm
against, which itself requires F3's browser-driven proof. This is flagged, not silently narrowed:
see A10 below.
