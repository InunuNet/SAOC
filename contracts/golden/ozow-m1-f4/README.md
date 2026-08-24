# Ozow M1/F4 golden — decision record: `GetTransactionByReference` 404 on a real, completed `IsTest=true` transaction

Written 2026-08-23 by @architect-apex, in response to a real bug found during live sandbox
retesting (F3). Apex tier — payment/money path.

## 1. What happened (evidence, not inference)

Cloud Logging, for reference `SAOC-2027-74NG1P6W9RKK`:

1. `POST /api/tickets/ozow-itn` → `200` at `2026-08-22T09:28:39.847692Z` — Ozow's ITN reached us.
2. ~5.2s later: `[payments/ozow] Transaction status response was not ok. { reference:
   'SAOC-2027-74NG1P6W9RKK', status: 404 }` at `2026-08-22T09:28:45.025431Z`.

The confirmation-page redirect (browser-observed, same purchase) carried
`Status=Complete&IsTest=true&Amount=0.01&BankName=Absa&TransactionReference=SAOC-2027-74NG1P6W9RKK
&TransactionId=34c3acfa-2618-410c-80d0-521a08190b82&Hash=<verified valid>`. The ITN's own Hash also
verified (F2's `verifyNotification()` passed — this reached `confirmNotification()` at all only
because it did). So: a real, hash-authenticated, `Status=Complete` notification exists for this
reference, and `GetTransactionByReference?siteCode=...&transactionReference=SAOC-2027-74NG1P6W9RKK`
returned `404` ~5 seconds after Ozow's own ITN fired. `confirmNotification()`'s fail-closed design
(F2b) did exactly what it was built to do — refuse rather than guess — and that refusal is correct
behaviour for a design that cannot yet tell "genuinely never happened" apart from "hasn't
propagated to this read path yet" or "this lookup mechanism doesn't cover this case."

## 2. Doc research — what Ozow does and does not document about this

Via Alembic against Wayback snapshots of `hub.ozow.com/docs/*` (archive.org's live index was
transiently offline once during this pass and worked on retry — noted only because a caller
re-running these fetches should expect an occasional retry, not because anything here depends on
that flakiness):

- `hub.ozow.com/docs/step-3-check-transaction-status-using-api`
  (`web.archive.org/web/20241204174654id_/...`): documents **two** live status-check methods
  under Step 3, not one:
  - `GetTransactionByReference` — query by the merchant's own `TransactionReference`. "This method
    is able to return multiple results. Ozow does not restrict the merchant from sending duplicate
    merchant references... The number of results returned are limited to 10." This is the one
    `lib/payments/ozow.ts` currently calls, exactly per F2b's spec (siteCode +
    transactionReference query params, `ApiKey` header) — the request shape is not the bug.
  - **A second, separate method exists on the same page and is not currently used anywhere in this
    codebase**: `GetTransaction`, which queries by **Ozow's own `TransactionId`**, not by the
    merchant's reference (per F2b's own README §4 spec and `contracts/golden/ozow-m1-f2b/
    README.md` §1, its URL shape is `GET https://api.ozow.com/GetTransaction?siteCode=
    {siteCode}&transactionId={transactionId}` — same `ApiKey`/`Accept` headers, same response
    shape). `ProviderNotification.gatewayPaymentId` already carries this value (`fieldOrNull(fields,
    'TransactionId')` in `verifyNotification()`, `lib/payments/ozow.ts:280`) — it's read off the
    inbound notification today and currently used only for match-disambiguation, never sent as its
    own lookup key.
  - The same page also documents the `Status` enum with **six** values, not the three
    `lib/payments/ozow.ts` currently switches on (`Complete`, `Cancelled`, `Error`,
    **`Abandoned`**, **`PendingInvestigation`**, **`Pending`**). This is a real gap but a narrower,
    separate one from the 404 — see §6 (out of scope for F4, logged as a follow-up).
- **No page in the full `hub.ozow.com/docs/*` CDX listing (81 URLs, captured this pass) documents
  a distinct sandbox/test-transaction status endpoint, or states that `IsTest=true` transactions
  are excluded from `GetTransactionByReference`'s index.** Nothing on the Step 3 page, the
  `payment-request-and-result-fields` page, or the `create-transaction` page (a different,
  unrelated bank-connections flow this project does not use — confirmed by reading it) draws any
  distinction between test and real transactions for status-lookup purposes.
- One data point worth flagging as **not** a load-bearing part of this design, but real: the
  archived `payment-request-and-result-fields` page (2024-08-11 snapshot) lists `IsTest` in the
  **outbound create-transaction** field table with the note *"Only false currently works for the
  payment API."* This is either stale (superseded — this project's own F3 live test with
  `IsTest=true` demonstrably worked end-to-end through Ozow's real sandbox test-outcome picker,
  contradicting a literal reading) or scoped to a different, non-sandbox merchant context. It is
  **not evidence about the status-check API at all** (a different endpoint, described on a
  different page) and is not used to justify anything below — recorded here only so a future
  investigator doesn't independently rediscover it and wonder if it was missed.

**Conclusion: there is no documented basis for "test transactions aren't queryable via
GetTransactionByReference."** The evidence is consistent with an ordinary propagation-lag or
reference-vs-ID indexing quirk (a single ~5-second-old lookup, by reference, 404ing) at least as
much as with a structural test-transaction exclusion — and Ozow's own docs hand us a second,
independent, still-real lookup path (`GetTransaction` by `TransactionId`) that this codebase has
never tried. The fix in §4 is built to resolve the bug through **exhausting genuinely real
verification paths first**, and treats "trust the notification directly" as a last-resort,
explicitly narrow, loudly-logged exception — not the first-line fix.

## 3. Why the obvious "just trust IsTest=true notifications" shortcut is rejected as the primary fix

The team lead's brief floated trusting a hash-verified notification's own fields directly when
`IsTest === 'true'`, reasoning that the outbound ITN's Hash (SHA512 over the payload + our private
key, `lib/ozow.ts:87-94`) is already a strong authenticity signal independent of the status-API
call. That reasoning is sound **in isolation** — but this specific codebase has a fact that changes
the risk calculus enough to demote it from primary fix to last resort:

**`OZOW_IS_TEST` is a hardcoded adapter constant, not caller input** (`lib/payments/ozow.ts:48`,
`const OZOW_IS_TEST = 'true';`, sent on literally every `initiate()` call — see the file's own
top-of-file doc comment, "sandbox-only throughout this mission, not caller input"). **Every single
transaction this adapter has ever created, and will create until a future feature makes it
conditional, is submitted to Ozow with `IsTest=true`.** A fix gated only on
`notification.raw.IsTest === 'true'` is therefore not a narrow test-only exception in this
codebase's current state — it is, in practice, "trust the notification's own Hash-verified Status
field for every Ozow transaction, full stop," because the status-API cross-check would never be
the ultimate deciding factor for anything until IsTest becomes real caller input. That may be an
acceptable, explicitly time-boxed posture for a sandbox-only mission (see §4.3's framing), but it
is not the same claim as "we're being extra careful except for harmless test transactions," and
this record does not want a future reader to mistake one for the other.

Given that, and given the doc research in §2 found no confirmation that the status-API genuinely
can never see these transactions, the design in §4 tries the real, documented, still-verifiable
paths first (retry, then the second endpoint) and reserves the notification-trust fallback for
when both are exhausted — so that if the true root cause is propagation lag or reference-vs-ID
indexing (plausible, unconfirmed) rather than a structural test exclusion (also plausible,
unconfirmed), the fix resolves it **without ever weakening verification at all**, and the
last-resort path becomes rare in practice rather than the normal path.

## 4. Decision: three-layer confirmation, narrowest possible last resort, nothing else changes

### 4.1 Layer 1 — retry `GetTransactionByReference` before giving up

Propagation lag between an ITN firing and the transaction being readable back is untested and
plausible (single 5-second-old data point; no doc evidence either way). `confirmNotification()`
retries the existing `GetTransactionByReference` call up to **3 total attempts**, waiting
**1500ms then 3000ms** between attempts (bounded ~4.5s added worst-case latency on a webhook
handler that already tolerates async work) — retrying only on a "no confirmed result yet" outcome
(404, empty match, or a match without `Status: 'Complete'` yet — Ozow's own doc-6-value enum
includes `Pending`/`PendingInvestigation`, states that can legitimately resolve moments later).
**Never** retry on a hard rejection (non-2xx other than 404, malformed body, thrown fetch error,
ambiguous multi-row match) — those already have a definite, current answer and retrying would only
delay a definite `confirmed:false`. A match found on any retry with `Status: 'Complete'` →
`confirmed:true`, exactly as today, with zero change to the matching/disambiguation logic already
in place (F2b's reference+TransactionId disambiguation is untouched, reused as-is on every
attempt).

### 4.2 Layer 2 — try `GetTransaction` (by `TransactionId`) if `GetTransactionByReference` still has no answer

Ozow documents a second, independent lookup on the exact same page: `GET
https://api.ozow.com/GetTransaction?siteCode={siteCode}&transactionId={transactionId}` — same
`ApiKey`/`Accept` headers, same response shape (a `Transaction[]` array, same field set,
`README.md` for F2b §1). `notification.gatewayPaymentId` already carries Ozow's `TransactionId`
today (read in `verifyNotification()`, currently used only for disambiguation). If Layer 1 exhausts
all 3 attempts with no confirmed `Complete` match, **and** `notification.gatewayPaymentId` is
non-null, make **one** `GetTransaction` call (no retry loop of its own — Layer 1 already spent the
retry budget) with the same fail-closed matching discipline: response must be a 2xx array, must
contain exactly one element (or a `TransactionId`-exact match if the array can also return >1 —
apply the same never-guess disambiguation posture as Layer 1), and that element's `Status` must be
exactly `'Complete'`. A hit here → `confirmed:true`. This is still a **real, independent lookup
against Ozow's own system of record** — no weakening of any kind, just trying the endpoint this
codebase has never called instead of only the one it has.

### 4.3 Layer 3 — last resort: trust the hash-verified notification's own fields, ONLY when `IsTest === 'true'`

Only if Layers 1 and 2 both exhaust with no confirmed match: if
**`notification.raw.IsTest === 'true'`** (read from the already-hash-verified `raw` field —
`verifyNotification()` only ever returns a `notification` after `generateOzowHash(...) ===
receivedHash` succeeded against the merchant's own private key, so this value cannot be forged
without the private key itself; see `lib/payments/ozow.ts:264-266`) **and**
`notification.rawStatus === 'Complete'` (same hash-verified-field discipline, strict equality, no
fuzzy match — mirrors `mapStatus`'s own discipline) → `confirmed: true`. Any other combination —
`IsTest` absent, `'false'`, or any value other than the exact string `'true'`; or `rawStatus`
anything other than exactly `'Complete'` — falls through to the existing `confirmed: false, reason:
'not-valid'`, unchanged.

This path is a **known, explicitly time-boxed reduction in defense-in-depth**, not a free
extension of trust — see §3's finding that `IsTest` is currently hardcoded `true` for every
transaction this adapter sends. It is accepted here **only** because: (a) this Ozow adapter is
still sandbox-only for this entire mission (file's own top-of-file doc comment, unrelated to this
feature) — there is no real-money traffic this weakens today; (b) it only ever fires after two
independent real-endpoint attempts against Ozow's actual system of record have already failed to
find a definite answer, not as a shortcut around them; (c) it is loudly logged every time it fires
(`console.error`, distinct message, same operational visibility as every other `confirmNotification`
branch) so it is never silently exercised; and (d) §6 below records the explicit follow-up
requirement to re-tighten or remove it before this adapter can ever carry real (non-`IsTest`)
traffic. A future feature that makes `IsTest` conditional on real caller input MUST revisit this
layer — that is not this feature's job to pre-solve, but it must not be forgotten either.

### 4.4 What does NOT change

- `verifyNotification()` — completely untouched. Hash verification, the actual anti-spoofing gate
  that decides whether `confirmNotification()` is ever called at all, has zero changes in this
  feature. A forged/bad-hash notification is rejected there, before any of Layers 1-3 run, exactly
  as today.
- The F2b matching/disambiguation logic (reference match, then `TransactionId` disambiguation on
  ambiguous multi-row results) — reused as-is inside Layer 1 and Layer 2, not rewritten.
- `refund()` — still an untouched declared stub, unrelated to this feature, same as F2b's own note.
- `mapStatus()` — untouched. (The 6-value vs 3-value enum gap found in §2 is a real, separate
  finding — see §6 — but conflating it into this feature would widen scope beyond the 404 bug.)

## 5. Specification for @dev

**`lib/ozow.ts`** — add one exported constant, alongside `OZOW_TRANSACTION_STATUS_URL`:
```ts
export const OZOW_TRANSACTION_STATUS_BY_ID_URL = 'https://api.ozow.com/GetTransaction';
```

**`lib/payments/ozow.ts`**, inside `confirmNotification()`:

1. Extract the existing single `GetTransactionByReference` fetch-and-match logic (config guard →
   fetch → response.ok check → JSON parse → array check → reference-match/disambiguate →
   Status-check) into an inner async helper that returns either `{ confirmed: true }` or a
   `{ confirmed: false, reason, retryable: boolean }` shape — `retryable: true` only for "made the
   call, got a real response, but there is no confirmed `Complete` match yet" outcomes (404,
   empty/no match, or a match whose `Status` is not `'Complete'` — i.e. every case that today
   returns `reason: 'not-valid'` off a syntactically-valid response); `retryable: false` for
   anything that already has a definite terminal answer this attempt (non-2xx **other than** 404 if
   distinguishable, malformed/non-array JSON body, thrown fetch error → `request-failed`, or an
   ambiguous multi-row match that failed to disambiguate). Treat a `404` status specifically as
   `retryable: true` (distinct from other non-2xx codes) — it is the exact status observed in the
   live bug and is Ozow's own idiom for "no such reference (yet)", not a malformed-request error.
2. Call that helper up to 3 times for `GetTransactionByReference`, sleeping 1500ms then 3000ms
   between attempts **only when the previous attempt was `retryable: true`** (stop retrying
   immediately on a non-retryable definite answer, and return that answer without spending the
   rest of the retry budget). A `confirmed: true` from any attempt returns immediately.
3. If all `GetTransactionByReference` attempts exhaust without confirming, and
   `notification.gatewayPaymentId !== null`: make one `GetTransaction` call using
   `OZOW_TRANSACTION_STATUS_BY_ID_URL` with `siteCode` + `transactionId` query params (same
   `ApiKey`/`Accept` headers), same fail-closed matching/Status-check discipline as Layer 1 (reuse
   the same matching helper logic, parameterised by which field to match on). A confirmed match →
   `confirmed: true`, return immediately.
4. If Layer 2 also does not confirm (or `gatewayPaymentId` was null so Layer 2 was skipped): if
   `notification.raw.IsTest === 'true'` **and** `notification.rawStatus === 'Complete'` →
   `console.error('[payments/ozow] Falling back to hash-verified notification fields — both status
   API lookups exhausted for an IsTest transaction.', { reference: notification.reference })` then
   return `{ confirmed: true }`. Otherwise, unchanged existing behaviour: `{ confirmed: false,
   reason: 'not-valid' }`, logged.
5. `OzowProviderDeps` gains no new fields — `readFetch()` is reused for every layer, same as today.
   Do not add a real `setTimeout`-based sleep in a way that blocks Vitest/unit runs for real
   wall-clock time in every test run — inject a `sleep` function via `OzowProviderDeps` (default
   `(ms) => new Promise((r) => setTimeout(r, ms))`) so the check script can inject a zero-delay
   stub and assert retry *counts* without the check itself taking 4.5+ real seconds per case.

## 6. Follow-ups recorded, not fixed by this feature

- **`mapStatus()`'s 3-value switch is missing 3 of Ozow's own documented `Status` values**
  (`Abandoned`, `PendingInvestigation`, `Pending` — §2). Today all three fall through `mapStatus`'s
  `default: 'unknown'`, which is fail-safe (never silently maps to `'paid'`) but loses the specific
  reason. Separate scope from this bug — flagged for a future feature, not fixed here.
- **Layer 3 (§4.3) must be revisited before this adapter can carry real, non-sandbox traffic** —
  today `IsTest` is hardcoded `'true'` for every transaction (`lib/payments/ozow.ts:48`); the day a
  future feature makes it real caller input, Layer 3's `IsTest === 'true'` gate needs to be
  re-examined against whatever that feature's own threat model is, not assumed still-safe by
  inheritance from this record.

## 7. Contract (SUPERSEDED — see §8)

See `.agent/memory/project/specs/ozow-payment-provider/contract-m1-f4.yaml` — one feature (F4),
assertions A1 (retry escalation + last-resort behaviour, all offline/deps-injected against the
real `createOzowProvider()`, mutation-tested) and A2 (a static grep guard that the sleep between
retries is injectable, so the check suite itself never burns real wall-clock time).

**§7's design (retry + `GetTransaction`-by-id fallback + last-resort hash-trust) is SUPERSEDED by
§8 below.** It is left in place, unedited, as a decision record — not because it was worthless
reasoning, but because a second, independent research pass (also 2026-08-23, same day) found a
piece of live, current, *documented* evidence §1-§6 above did not have: the `GetTransactionByReference`
endpoint takes its own `IsTest` query parameter, and defaults it to `false`. That directly and
simply explains the 404 as a request bug, not an indexing/propagation mystery — see §8.

## 8. SUPERSEDING DECISION (2026-08-23, later pass) — the 404 is a missing query parameter, not a lookup/propagation limitation

### 8.1 The evidence §1-§7 missed

§2's research used Wayback snapshots of `hub.ozow.com/docs/*` (the deprecated docs host — this
project's own F1 record already established `oldhub.ozow.com` is dead/NXDOMAIN, and `hub.ozow.com`
is a similarly separate, older doc set from the live site). This pass instead fetched the
**current, live** `https://ozow.com/integrations` page directly via Alembic
(`curl -s "http://localhost:7077/https://ozow.com/integrations"`, 2026-08-23) — the exact same page
F1 already cited and trusted for the hash algorithm (`contracts/golden/ozow-m1-f1/README.md §1`)
and F2b already cited and trusted for the `GetTransactionByReference` request shape itself
(`contracts/golden/ozow-m1-f2b/README.md §1`). Its "Step 3 - Check transaction status using API"
section documents `GetTransactionByReference`'s full parameter table, verbatim:

| PROPERTY | TYPE | REQUIRED | DESCRIPTION |
|---|---|---|---|
| ApiKey (header) | String(50) | Yes | Merchant's API key... |
| Accept (header) | String(50) | Yes | `application/json` or `application/xml` |
| SiteCode | String(50) | Yes | ... |
| TransactionReference | String(50) | Yes | The merchant's reference for the transaction |
| **IsTest** | **bool** | **No** | **Defaults to false. Use true only to get results for test requests.** |

This is an actual, current, documented query parameter this codebase has never sent.
`lib/payments/ozow.ts:307`'s `confirmNotification()` builds its `GetTransactionByReference` URL
from exactly two params — `siteCode` and `transactionReference` — and never `IsTest`. Per Ozow's
own docs, an omitted `IsTest` defaults to `false`, i.e. "results for real (non-test) requests
only." The reference this bug was found against
(`SAOC-2027-74NG1P6W9RKK`) was a real, hash-verified, `IsTest=true` transaction
(§1) — querying for it with an implicit `IsTest=false` filter is a plausible, simple, sufficient
explanation for a 404: not because the transaction doesn't exist or hasn't propagated, but because
the query asked for the wrong population of transactions.

This is corroborated, not contradicted, by §2's own aside (its next-to-last bullet): the archived
`payment-request-and-result-fields` page's stray note that "only false currently works for the
payment API" was flagged there as unexplained and possibly stale. Read together with this finding,
a much more mundane reading becomes available: Ozow's status-check API silently filters by test
flag exactly as documented, and this codebase was simply never sending the flag needed to see its
own test transactions.

### 8.2 Why this changes the fix

§3-§4's retry-then-fallback-then-last-resort design was the right response to the evidence §2 had:
"no documented reason for the 404, so first exhaust real verification paths, and treat trusting the
notification directly as a narrow last resort." That reasoning does not disappear — retrying a
transient real failure, or falling back to a second lookup endpoint, are still generically
reasonable postures. But §8.1 supplies something §2 did not have: a **specific, documented,
first-line explanation that is directly actionable as a one-parameter fix**, with no last-resort
hash-trust needed at all. Ozow's own docs, read correctly, hand this codebase a way to make the
*real* status-verification call succeed for `IsTest=true` transactions — never a way to bypass it.

Given a documented, one-line fix is available and suficient to resolve the exact reproduced bug
(§1), building the retry/fallback/last-resort machinery in §3-§7 on top of it would be solving a
problem that (per §8.1) most likely does not exist — Layer 3's hash-trust fallback in particular is
now unmotivated: if `IsTest` is being sent correctly, `GetTransactionByReference` should find any
genuinely completed `IsTest=true` transaction on the very next call, the same way it already finds
real ones today. Per this project's own `CLAUDE.md`/`coding.md` (no dead code, no functionality
beyond what's needed, no defensive scaffolding for scenarios that can't happen) and per §4.3's own
explicit self-critique ("IsTest is currently hardcoded true for every transaction... the last-resort
fallback is therefore, in this codebase's CURRENT state, the deciding factor for every transaction
that reaches it — NOT a rare edge case" — i.e. §7's design would have made "trust the hash, not the
gateway's own status API" the routine path for every sandbox transaction, not a true last resort),
the one-parameter fix is preferred: it fixes the actual root cause, keeps `confirmNotification()`'s
real, external, fail-closed status check as the ONLY way any transaction (test or real) ever gets
marked `confirmed: true`, and adds zero new trust surface.

### 8.3 The fix (supersedes §5 entirely — §5's retry/fallback/Layer-3 code is NOT implemented)

**`lib/payments/ozow.ts`**, inside `confirmNotification()`:

1. Before building the `GetTransactionByReference` URL, read the notification's own already-hash-
   verified `IsTest` field: `const isTest = notification.raw.IsTest === 'true';` (strict string
   equality — no truthy-string shortcut, same discipline as `mapStatus`/§4.3's own gate).
2. Append `&IsTest=true` to the query string **only when `isTest` is `true`**. When `false` (or the
   field is absent/anything else), send exactly what is sent today — no `IsTest` param, which Ozow
   documents as defaulting to `false`. This is why real (non-test) transactions are byte-for-byte
   unaffected: the request they generate today is identical to the request they generate after this
   fix.
3. No other change. No retry loop, no second endpoint, no last-resort hash-trust branch. The
   existing fail-closed matching/disambiguation/Status-check logic (F2b, reused verbatim) is
   untouched — a transaction is `confirmed: true` if and only if the real
   `GetTransactionByReference` response (now correctly scoped to include test transactions when the
   notification claims to be one) contains a matching row with `Status === 'Complete'`.

**`lib/ozow.ts`**: no change. `OZOW_TRANSACTION_STATUS_URL` is reused as-is; §5's
`OZOW_TRANSACTION_STATUS_BY_ID_URL` (`GetTransaction` by id) is NOT added — it remains a real,
documented, currently-unused Ozow endpoint (§2's finding stands as a piece of information, just not
acted on by this feature), available for a future feature if a genuinely distinct need arises.

### 8.4 Why fail-closed is still fully preserved

- **A real (non-test) transaction whose status check fails or 404s must still be rejected**: the
  request a real transaction generates is unchanged by this fix (§8.3.2) — this scenario's behaviour
  is identical to before the fix, byte-for-byte.
- **A forged/spoofed notification (bad Hash) must still be rejected regardless of `IsTest`**:
  `verifyNotification()` is untouched (unchanged from §4.4) — a bad-Hash notification never reaches
  `confirmNotification()` at all, so this fix's `IsTest`-param logic never runs for it.
- **The real bug scenario** (valid Hash, `IsTest=true`, real completed transaction) now sends
  `IsTest=true` to a real, live, documented Ozow endpoint that per its own docs indexes test
  transactions when asked — the fix makes the *existing* real fail-closed check succeed correctly,
  it does not add a way to bypass that check.
- No new trust surface is introduced anywhere: `confirmed: true` still requires exactly one thing —
  a real HTTP 2xx response from Ozow's own transaction-status API containing a row matching this
  reference with `Status === 'Complete'`. That is true for every transaction, test or real, both
  before and after this fix.

### 8.5 Specification for @dev (supersedes §5)

Only §8.3 above — a two-line change inside `confirmNotification()`'s existing
`GetTransactionByReference` URL-building step. Do not implement §5's retry loop, `sleep` injection,
`GetTransaction`-by-id fallback, or Layer-3 hash-trust branch — see §8.2 for why. §4.4 ("what does
NOT change") continues to hold in full: `verifyNotification()`, `mapStatus()`, `refund()`, and the
F2b matching/disambiguation logic are all untouched by this fix too.

## 9. Contract (current)

See `.agent/memory/project/specs/ozow-payment-provider/contract-m1-f4.yaml`, rewritten
2026-08-23 to implement §8's fix instead of §5-§7's superseded design. One feature (F4), two
assertions: A1 (offline, deps-injected against the real `createOzowProvider()` — proves the
`IsTest` param is sent correctly, that a real transaction's request is byte-identical to before this
fix, that a forged/bad-Hash notification never reaches this code path at all, and that the exact
reproduced bug scenario now confirms) and A2 (confirmation-page copy regression guard — see §10).

## 10. The confirmation-page "hardcodes PayFast" bug (F4's second scope item)

Already fixed, independent of this feature. `git log -- "app/(marketing)/tickets/confirmation/
page.tsx"` shows commit `a850b1f` ("fix(tickets): resolve 3 browser-found UX defects in
cart/confirmation", 2026-08-20, predates this feature) already removed the confirmation flow's
gateway-specific copy — verified 2026-08-23 by reading the current
`app/(marketing)/tickets/confirmation/page.tsx`, `components/tickets/ConfirmationPoller.tsx`, and
`app/(marketing)/tickets/cancelled/page.tsx`: the only remaining occurrences of the string
"PayFast" in any of the three files are in code comments (e.g. `ConfirmationPoller.tsx:19`,
`cancelled/page.tsx:7`), never in user-facing copy or a Sanity-copy fallback string. A2 (below) is a
light regression guard against this bug ever coming back, not a fix for an open bug.
