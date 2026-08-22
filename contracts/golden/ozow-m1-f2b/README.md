# Ozow M1/F2b golden — decision record: `confirmNotification()` stub-vs-selectable gap

Written 2026-08-22 by @architect-apex, in response to a critical Codex GPT-5.5 finding raised
against F2 (checkout wiring): `lib/tickets-notification.ts`'s shared handler rejects BEFORE the
paid-write step on any failed `confirmNotification()` call (step 8, line ~183), and Ozow's
`confirmNotification()` (F1) is a **permanent, unconditional stub** — `{ confirmed: false, reason:
'not-configured' }`, always. With Ozow now wired as the DEFAULT-selected checkout provider
(`components/tickets/useTicketCart.ts:36`, `components/tickets/ProviderChoice.tsx:8` — "Brad's
direction is that it is now the client's preferred gateway"), every real Ozow payment notification
would be hash-verified, amount-matched, then rejected at the confirm step — acknowledged 200 to
Ozow (so Ozow stops retrying) but never marked paid in Firestore, with no retry mechanism. A buyer
pays, gets no ticket, and nothing in the system ever revisits that order.

## 1. Decision: **Option B** — a live confirmation mechanism exists; implement it for real

F1's stub decision (`contracts/golden/ozow-m1-f1/README.md` §5) was honest and correct **at the
time**: it was gated on `oldhub.ozow.com`, a domain that no longer resolves (NXDOMAIN, verified via
Alembic 2026-08-22). That was the right call for dead-domain code with zero callers.

That premise no longer holds. Re-investigated via Alembic today, against Ozow's own **current,
live** integrations page — the same page F1 already trusted and cited for the hash algorithm
(`contracts/golden/ozow-m1-f1/README.md` §1):

- `curl -s "http://localhost:7077/https://ozow.com/integrations"` — Step 3 of Ozow's own
  documented integration flow, titled **"Check transaction status using API"**, states verbatim:
  *"This step is optional, but we highly recommend it — it helps ensure that the received
  responses reflect the correct transaction status. This will remove any chance of anyone spoofing
  the Ozow response to update a transaction status on your site. Each API call needs an http header
  value with your API Key."* It documents two live methods:
  - `GET https://api.ozow.com/GetTransactionByReference?siteCode={siteCode}&transactionReference={transactionReference}`
  - `GET https://api.ozow.com/GetTransaction?siteCode={siteCode}&transactionId={transactionId}`

  Both require an `ApiKey` request header (merchant's API key, from the Ozow Merchant Admin
  section) and an `Accept` header (`application/json` or `application/xml`). Both return "an array
  of the transaction object" — an array because Ozow does not prevent duplicate merchant
  references, so a caller must match on the specific reference, not merely take the first result.
- Corroborated by a second, independent search pass (`curl "http://localhost:7077/?q=Ozow+transaction+status+check+API+GetTransactionByReference"`)
  — the same `api.ozow.com/GetTransactionByReference` URL appears as the #1 organic result, sourced
  from the same `ozow.com/integrations` page, not a stale cache.
- **`OZOW_SANDBOX_API_KEY` is already present in `.env.local`**, alongside
  `OZOW_SANDBOX_SITE_CODE` and `OZOW_SANDBOX_PRIVATE_KEY` — this credential was staged before this
  investigation began, corroborating that wiring this call was always the intended next step, not
  a new scope invention.

This is genuinely not the same situation as `oldhub.ozow.com`: that domain is dead, this one is
live, current, and documented on a page this project has already independently verified once. A
hash-verified inbound webhook alone is **not** what Ozow itself calls "complete" confirmation —
Ozow's own docs describe the inbound webhook as spoofable and recommend this second, out-of-band
check as the actual anti-spoofing mechanism. Folding confirmation into verification (treating a
verified hash as sufficient) would be building against Ozow's own documented advice, not honoring
it. Option A is therefore rejected: the stub's *design*, not just its implementation, was wrong
once this endpoint is live and reachable — it should never have been a permanently-failing gate on
production traffic once Ozow became selectable.

## 2. What is NOT fully pinned, and why that does not block shipping now

Ozow's page states the two API calls return "an array of the transaction object" and points to a
"Transaction object" section "described further down" for its field list. That section's rendered
table on the live page is corrupted/duplicated content (visibly wrong — it repeats the *outbound
post-variable* table's generic placeholder descriptions verbatim under different field names,
which is a content bug on Ozow's own site, not a page-fetch artefact — reproduced identically across
two separate fetches). The reliable evidence is: (a) the request shape (URL, query params, `ApiKey`
header) is unambiguous and stated in plain prose, not a broken table; (b) the *notification response*
object's field set **is** cleanly documented a few sections earlier on the same page — `SiteCode`,
`TransactionId`, `TransactionReference`, `Amount`, `Status` (`Complete`/`Cancelled`/`Error`, the
identical 3-value enum `lib/payments/ozow.ts`'s `mapStatus` already implements),
`Optional1`-`Optional5`, `CurrencyCode`, `IsTest`, `StatusMessage` — and Ozow's own docs describe
the transaction-status-API's return object as "the object referred to in the response of the 2 API
calls above" without drawing any distinction from that same field set. Treating the two as the same
shape is a reasonable, evidence-based inference, not a blind guess — but it is still an inference,
not a captured live response.

This is why the specification below is written defensively, matching this codebase's own existing
discipline (`parseAmountToCents` returns `null` — never guesses — on anything not an exact decimal
shape; PayFast's `confirmNotification` fails closed on anything but the literal string `'VALID'`):
**the implementation must fail closed (`confirmed: false`) on anything about the response that
does not exactly match expectation** — non-2xx status, a non-array body, no array element whose
`TransactionReference` matches the notification's own reference, or a matched element whose
`Status` is not exactly `'Complete'`. Under this discipline, if the inferred response shape turns
out to be subtly wrong in production (e.g. different key casing), the failure mode is **identical
to today's stub** — order stays `reserved`, loudly logged with a diagnosable reason, reconciled by
an operator — never a silent, incorrect `confirmed: true`. That is a strictly safer regression
surface than "ship it broken and hope," and it turns this from a *permanent, designed-in* failure
into an *ordinary, fixable* production bug if the shape needs adjustment — closeable without a
second architecture decision. The mission's own F3 (BrowserAgent-driven live sandbox transaction
completion, already planned) is the natural point to also capture and golden-pin the real
`GetTransactionByReference` response body from an actual completed transaction, tightening this
from inference to observed fact.

## 3. No interim UI gating needed

Because the fail-closed behavior above means a shape mismatch degrades to exactly today's stub
behavior (never a false "confirmed"), and because Brad's own explicit direction
(`components/tickets/ProviderChoice.tsx:6-7`, `useTicketCart.ts:34-36`) is that Ozow is the
client's *preferred* gateway, there is no honest case for reverting the default to PayFast or
blocking Ozow selection while this ships — doing so would be re-litigating a decision Brad already
made, not responding to new information his decision didn't have. The corrective action is to make
`confirmNotification()` real, not to hide Ozow. (If a live probe later reveals the inferred field
casing is wrong, the fix is a same-day patch to the response parsing — not a re-litigation of this
decision.)

## 4. Specification for @dev

**`lib/ozow.ts`** — add one exported constant, alongside `OZOW_PAY_URL`:
```ts
export const OZOW_TRANSACTION_STATUS_URL = 'https://api.ozow.com/GetTransactionByReference';
```

**`lib/payments/ozow.ts`**:
- `OzowProviderDeps.fetch` stops being a forward-declared unused seam (its doc comment currently
  says "neither refund() nor confirmNotification() call it in this feature" — that sentence is now
  false and must be corrected) — `confirmNotification` now uses `readFetch()`, mirroring
  `createPayfastProvider`'s own `readFetch` accessor exactly (add the same
  `const readFetch = (): typeof fetch => deps?.fetch ?? globalThis.fetch;` line inside
  `createOzowProvider`, which does not exist yet).
- Replace the stub body of `confirmNotification` with a real implementation:
  1. Read `OZOW_SANDBOX_SITE_CODE` and `OZOW_SANDBOX_API_KEY` from env (per-call, not captured —
     same discipline as every other env read in this file). Either missing →
     `{ confirmed: false, reason: 'not-configured' }`, **zero fetch calls**, logged.
  2. Build `${OZOW_TRANSACTION_STATUS_URL}?siteCode=${encodeURIComponent(siteCode)}&transactionReference=${encodeURIComponent(notification.reference)}`.
  3. `GET` with headers `{ ApiKey: apiKey, Accept: 'application/json' }`.
  4. Non-2xx response → `{ confirmed: false, reason: 'not-valid' }`, logged (status + reference).
  5. Fetch throw (network failure) → `{ confirmed: false, reason: 'request-failed' }`, logged.
  6. Parse JSON body. Not an array → `{ confirmed: false, reason: 'not-valid' }`.
  7. Find the array element whose `TransactionReference` (exact string match) equals
     `notification.reference`. None found → `{ confirmed: false, reason: 'not-valid' }`.
  8. That element's `Status` (strict equality, same discipline as `mapStatus`) must be exactly
     `'Complete'`, else `{ confirmed: false, reason: 'not-valid' }`.
  9. Otherwise `{ confirmed: true }`.
- `refund()` is untouched — still a declared stub, unrelated to this decision.
- Update the file's own top-of-file doc comment (currently: "refund()/confirmNotification() are
  declared stubs" — no longer true for `confirmNotification`) and the F1 mission-boundary note
  accordingly; F1's own golden record (`contracts/golden/ozow-m1-f1/`) stays as written — it
  documented what was true on 2026-08-22 at F1 time and is not being revised, this is a new,
  later decision superseding it, same pattern as F1 §1 superseding
  `docs/payment-gateway-research-2026-08.md`.

A reference implementation matching this exact specification was built, mutation-tested, and
deleted during this architecture pass (see §5) — @dev is not inventing the shape from scratch.

## 5. Assertion — mutation-tested by this architecture pass

New check: `contracts/checks/ozow-m1-f2b/check-confirm-notification-real.mjs`, 7 cases, run via
`npx tsx contracts/checks/ozow-m1-f2b/check-confirm-notification-real.mjs`, against the REAL
`createOzowProvider()` with `env`/`fetch` deps-injected (no network).

**Observed FAILING (RED) against the current F1 stub, 2026-08-22:** 6 of 7 cases fail — the two
config-missing cases pass by coincidence (the permanent stub also happens to return
`not-configured` on missing config, though for the wrong reason: it never reads
`OZOW_SANDBOX_API_KEY` at all), but every case that requires a real network attempt fails, because
the stub makes zero fetch calls ever. Full transcript captured during this pass; the two
"not-configured" cases are the only ones a naive read of "6/7 fail" might miss as already-passing —
they do not prove the stub is correct, only that an unconditionally-failing function trivially
satisfies "reject when unconfigured."

**Observed PASSING (GREEN), 2026-08-22:** a throwaway reference implementation matching §4 exactly
was written directly into `lib/payments/ozow.ts`, all 7 cases passed, then the file was restored to
its exact pre-change (F1 stub) state via a pre-edit backup copy and re-verified back to RED
(6/7 failing again) — confirmed via `git status` showing the file untouched from its tracked state.

**Mutation-caught, 2026-08-22:** with the reference implementation in place, the
`TransactionReference` match predicate was mutated to accept ANY array element regardless of
reference (`(t) => typeof t === 'object' && t !== null`, dropping the reference comparison). This
reproduces exactly the security property this check exists to catch — a notification for one
reference being "confirmed" by an unrelated transaction in the response array — and the check
correctly failed 2 of 7 cases (`response array has no matching TransactionReference` — expected
`confirmed:false`, got `confirmed:true`). The mutation was then reverted before finishing.

No golden JSON fixture is pinned for the live response body itself (per §2 — the exact shape is an
evidence-based inference, not a captured observation); the check's `jsonResponse()` fixtures in
`check-confirm-notification-real.mjs` stand in as the executable specification of the expected
shape until F3's live probe can tighten it.

## 6. Contract

See `.agent/memory/project/specs/ozow-payment-provider/contract-m1-f2b.yaml` — one feature (F2b),
one assertion (A1) wrapping the check above, `phase: 4`.
