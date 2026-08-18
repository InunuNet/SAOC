# reconcile-response-accuracy — F1 goldens

Design record for the correctness defect shipped in `5738f61` and documented there as a known-
open item: `app/api/admin/reconcile-orders/route.ts` calls `markOrdersAlerted()` inside a
try/catch that logs a failure but never adjusts the response body. `alertedNow` lists every
order id the route ATTEMPTED to alert, regardless of whether the bookkeeping write actually
committed. On a partial or total `markOrdersAlerted` failure the endpoint returns a
success-shaped body claiming orders were alerted when they were not — a cron caller or a human
reading the response has no way to distinguish "alerted all four" from "alerted none, all four
threw." Both currently render identically. See `lib/reconciliation.ts`'s `markOrdersAlerted`
header ("PER-ORDER ATOMICITY") for the write this response is supposed to be describing, and
`.agent/memory/project/specs/order-reconciliation/goldens/check-partial-failure-atomicity.mjs`
for the existing proof that the underlying write really is atomic per order — that proof was
never wired into what the HTTP caller sees.

## Design decided here

### 1. A structured error, not string-parsing

`markOrdersAlerted()` already computes, per order, whether its batch commit succeeded or
failed (`lib/reconciliation.ts`, the `Promise.allSettled` block) — it just throws that
information as free text embedded in an `Error.message`. The fix does **not** invent a second
source of truth (e.g. a fresh Firestore read to check which stamps landed) and does **not**
regex-parse the error message (fragile: any future edit to the message wording would silently
break parsing without a compiler error). Instead, `markOrdersAlerted()` throws a new exported
class, `MarkOrdersAlertedError extends Error`, carrying a structured `failedOrderIds: string[]`
property alongside the same human-readable `.message` it already builds. The message text is
**unchanged** — `check-partial-failure-atomicity.mjs`'s existing
`String(thrown.message).includes(FAILING_ORDER_ID)` assertion keeps passing unmodified with zero
edits to that file, because `MarkOrdersAlertedError` is still an `Error` with the same message
content, just with one added field.

### 2. A new pure-ish orchestration function, not inline route logic

The route cannot inject a fake `deps.db` into its own handler the way a unit test can — in
production it always calls `markOrdersAlerted()` with the real Firestore client. To make the
"response correctly reflects partial failure" property testable without a running Next.js
server (out of scope for this contract — a `BrowserAgent` currently holds port 3400) or live
Firestore, the try/catch/response-shaping logic moves out of the route into a new exported
function in `lib/reconciliation.ts`:

```ts
export interface AlertBookkeepingResult {
  alertedNow: string[];
  alertBookkeepingFailed: string[];
}

export async function markOrdersAlertedForResponse(
  orderIds: string[],
  now: Timestamp,
  deps: { db?: ReconciliationFirestoreLike } = {}
): Promise<AlertBookkeepingResult>
```

- On full success: `{ alertedNow: orderIds, alertBookkeepingFailed: [] }`.
- On a `MarkOrdersAlertedError`: splits `orderIds` using `error.failedOrderIds` —
  `alertedNow` is every attempted id NOT in `failedOrderIds`; `alertBookkeepingFailed` is
  `failedOrderIds` itself. This is the same named-ids-from-the-error data
  `check-partial-failure-atomicity.mjs` already proves is correct at the `markOrdersAlerted`
  layer; this function only re-shapes it for the HTTP response, it does not recompute it.
- On any OTHER thrown value (a shape `markOrdersAlerted` is not documented to throw, e.g. a
  raw network error from something above it): **conservative**, `{ alertedNow: [],
  alertBookkeepingFailed: orderIds }`. An unrecognized failure must never be read as "probably
  fine" — the whole point of this contract is that an unproven claim of success is worse than
  an loud, possibly-overcautious failure report. See A2.

This is directly unit-testable with the same `FakeFirestore`-shaped `deps.db` dialect
`check-partial-failure-atomicity.mjs` already established, with zero Next.js/HTTP surface
involved — the route becomes a thin wrapper that calls this function and spreads its two fields
into the JSON body.

### 3. HTTP status: 200 on full success, 207 on partial bookkeeping failure

Neither a plain 200 nor a plain 502 fits a run where the alert email sent (the primary,
essential side effect) but some stamps failed to commit (a secondary, already-documented-as-
recoverable bookkeeping concern — see `markOrdersAlerted`'s own doc comment: "a duplicate alert
email is far preferable to a silently dropped one"). Existing behaviour is unchanged at both
ends of the spectrum this decision does not touch:

- Total failure before any alert is attempted (`sendReconciliationAlert` itself throws) — still
  **502**, unchanged, `markOrdersAlerted` is never even called in that path.
- Full success (email sent, every stamp committed) — still **200**,
  `alertBookkeepingFailed: []` always present (never an omitted field — omission is itself an
  ambiguous body a caller could misread as "the field doesn't apply" rather than "nothing
  failed").

For the new partial-failure case (email sent, ≥1 order's stamp failed to commit): **207
Multi-Status**. Rationale: 207 is the one HTTP status whose actual semantics are "multiple
sub-operations were attempted, and they did not all succeed identically" — exactly this
situation, where N orders were attempted and a strict subset failed. A monitoring system or
cron wrapper that treats "non-2xx-clean" as noteworthy (most do, since 207 falls outside the
narrow 200-206 success range many clients special-case) will surface this run as needing a
look, without conflating it with the strictly worse "nothing happened at all" case that 502
already, correctly, represents. `reconcileStatusFor(alertBookkeepingFailed)` is a small pure
function so this mapping is independently testable (A3) rather than living only as an inline
ternary in the route.

**MUST READ before wiring this into Cloud Scheduler or any cron-runner client (raised by @qa,
2026-08-19):** JavaScript `fetch`'s `res.ok` is `true` for the ENTIRE 200-299 range, which
includes 207. A naive cron wrapper that only checks `res.ok` (or any HTTP client library's
equivalent "2xx = success" shortcut) will silently treat a 207 partial-bookkeeping-failure run
exactly like a clean 200 — the whole point of this contract is to stop a caller from wrongly
reading a response as full success, and a status-code-only check defeats that just as
completely as the original bug did, just one layer up the stack. **Any real integration of this
endpoint (Cloud Scheduler retry/alerting config, a manual on-call check, a future dashboard)
MUST parse the response body's `alertBookkeepingFailed` array and treat a nonempty array as
needing attention, regardless of what the HTTP status class says.** 207 is still the right
status to send (it is honest, and it does let stricter clients/monitoring that inspect the exact
code distinguish this case from 200) — but it is not sufficient on its own for a caller that
only checks `res.ok`, and this file is the place that instruction needs to live for whoever
wires the real Cloud Scheduler job (see order-reconciliation's own goldens/README.md "Where it
runs" — that wiring is documented by @docs, not gated by this repo, so this warning must survive
into that documentation, not just this design record).

### 3a. Decided, not yet implemented: the empty-needingAlert early return should also carry `alertBookkeepingFailed: []`

@qa flagged that `route.ts`'s `needingAlert.length === 0` early return (no stranded orders need
alerting) returns `{ alertedNow: [], skippedRecentlyAlerted, strandedCount }` with NO
`alertBookkeepingFailed` field at all — not a contract violation (`markOrdersAlertedForResponse`
is never called on that path, so there is nothing to report), but it breaks the "always present,
never omitted" shape principle §2/§3 above establish for every other path, and a caller doing a
blind `body.alertBookkeepingFailed.length` field lookup would need a defensive `?? []` for this
one branch and not the others.

**Decision: yes, add `alertBookkeepingFailed: []` to that branch too**, for response-shape
uniformity. This is the one branch where "nothing failed" is unambiguously, trivially true (no
write was even attempted), so stating it explicitly is free and correct, and it removes the one
remaining place a caller has to special-case the body shape. This is a one-line change to
`route.ts` — **not applied by this session**, since this pass was scoped to "check script and
golden only, do not touch production code." Recorded here as the decision for whoever picks up
the next `route.ts` edit (@dev, or folded into this feature's next revision).

### 4. The flag-only boundary is untouched

No new write is introduced. `markOrdersAlertedForResponse` only wraps the EXISTING
`markOrdersAlerted()` call in a catch that reshapes its output — it calls no other function, and
in particular never imports `markOrderAndPositionPaidByPaymentId`. `route.ts` still never
touches `status`/`amount`/`gatewayPaymentId`/`purchasedAt`. A5 (structural, secondary) greps for
this.

### 5. Auth is untouched — proven behaviourally, over real HTTP, in two parts, not by a grep

`route.ts`'s bearer-secret check (fail-closed on missing `RECONCILIATION_CRON_SECRET`,
`crypto.timingSafeEqual` comparison via `constantTimeEqual`) is not part of this fix and must
not be weakened incidentally while route.ts is edited to call the new function.

**This went through three rounds of false security in one session (2026-08-19) before landing
here — record kept in full because the lesson generalizes, not because the specific regexes
matter anymore:**

1. A grep against route.ts's raw source, including comments. route.ts's own doc comments
   legitimately NAME `markOrderAndPositionPaidByPaymentId` and `RECONCILIATION_CRON_SECRET` to
   STATE the properties they describe — the grep couldn't tell a prohibition from a violation,
   and false-failed a correct route.
2. Comments stripped before matching, but the auth pattern still matched a bare, comment-
   stripped IDENTIFIER (`constantTimeEqual`). @qa satisfied it with nothing but an unused
   import, the entire guard block deleted underneath it.
3. Pattern tightened to require CALL shape (`if (!constantTimeEqual(...))`). @qa's third
   bypass: leave that exact condition text fully intact, comment out only the
   `return unauthorized();` inside it. The guard's condition was checked; its consequence
   never fired. No text pattern can distinguish "this condition exists in the source" from
   "this condition's branch actually executes and returns" — that is a CONTROL-FLOW property,
   not a text property, and each further regex refinement just relocates the next bypass one
   line over (a buffer compared against itself is the next one nobody has demonstrated).

**Conclusion, and the general lesson kept for future contracts on this repo:** where a real
behavioural check already exists (or can cheaply be added), it is not optional to prefer over a
structural one for a security guard — a structural check on a security guard is always a proxy
for the property, and every proxy has a gap someone will eventually find. `goldens/check-status-and-wiring.mjs` now asserts NOTHING about auth (its header explains why, in
full); it only proves route.ts's non-auth wiring (A3) and the flag-only write boundary (A5),
which are genuine absence/presence properties a grep CAN fully decide (there is no "guard whose
consequence might not fire" shape to "this identifier is never referenced").

Auth is instead proven over real HTTP, against the real compiled route, in two parts — split
because a single reused script turned out not to cover the whole surface (see A6's own
description in contract-f1.yaml for how this was discovered, mid-drill):

- **A6** — reuses order-reconciliation F1's `check-route-auth-fails-closed.sh` UNMODIFIED.
  Scrubs `RECONCILIATION_CRON_SECRET` to an EMPTY STRING for every request, proving the
  fail-closed-on-missing-secret branch (`if (!expectedSecret)`) for both a missing
  `Authorization` header and a "wrong secret" header. **Discovered limit, found while drilling
  @qa's third bypass against it directly:** because the secret is blanked for every request,
  the missing-secret branch intercepts BEFORE the `constantTimeEqual` comparison can ever run
  — A6's own "wrong secret" case never actually reaches the comparison, so it could not have
  caught, and (re-verified directly) did not catch, @qa's exact commented-out-return mutation.
  It remains the correct, load-bearing proof for the paths it does cover.
- **A6b** (new, this contract) — `check-wrong-secret-rejected-with-real-secret-configured.sh`
  configures a real, non-empty, TEST-ONLY secret (Firebase/Resend credentials still scrubbed,
  so a bypass still can't reach a live write or email) and sends a wrong token, which genuinely
  reaches the comparison branch. This is what actually closes @qa's third bypass — verified by
  running the exact mutation against it directly: FAILs with a real 500 (falls through to
  `findStrandedOrders()`, which throws on the scrubbed Firebase credentials) under the
  mutation, PASSes with the guard intact.

Between A6 and A6b, every branch of the auth guard (missing secret, missing header, wrong
secret reaching the missing-secret check, wrong secret reaching the comparison check) is
exercised by a real HTTP request against the real compiled route. Neither script proves the
CORRECT secret succeeds (200) — deliberately deferred to a manual, credentialed step, same
reasoning as order-reconciliation F1's own positive-auth deferral: an automated gate that can
re-run at any time must never be the one thing that could reach a live write or a live email
send.

## Failure reason logging — a regression this contract's own first implementation introduced

Found by @team-lead reading the diff, 2026-08-19, AFTER @qa PASSed the code and Codex PASSed
the code — twice each, across the round trips above. Nothing asserted it, which is why it
slipped past three review passes: the same unasked-question pattern behind several defects this
session.

**The defect:** `markOrdersAlertedForResponse`'s catch (`lib/reconciliation.ts`) returned a
shaped `{ alertedNow, alertBookkeepingFailed }` result in both branches and logged NOTHING. The
`MarkOrdersAlertedError` it catches — which carries the aggregated message naming WHY each
order's batch failed (a Firestore permission error, a quota error, a network error, an
unexpected exception; see that class's own doc comment) — was discarded the instant it was
caught. `route.ts`, downstream, never had the error object at all by the time its own code ran
— its `console.error` could only ever log `{ orderIds: alertBookkeepingFailed }`, restating what
the response body already carried. **Net effect: an operator reading a 207 response learns
WHICH orders failed to stamp and can find NOTHING anywhere — not in the response, not in any
log — telling them WHY.** This directly violates `.claude/rules/coding.md`: "Every error path
logs context... Never log and swallow silently." There is a real irony here worth keeping: this
whole feature exists because the endpoint reported success it couldn't substantiate — fixing the
response while simultaneously blinding the logs would have thrown away half the observability
win this contract exists to deliver.

**The fix:** log at the point of the catch in `markOrdersAlertedForResponse`, where the error
object still exists — not reconstructed later from the returned order ids. Both branches now
call `console.error` before returning:
- `MarkOrdersAlertedError` branch: `{ operation, failedOrderIds, reason: error.message }` —
  `error.message` is the aggregated per-order detail `markOrdersAlerted` already builds (see
  that function's own doc comment), so this is the SAME reason data A1/A4 already prove is
  correct, just no longer thrown away one line later.
- Unrecognized-error branch: `{ operation, orderIds, errorType: error.constructor.name, reason:
  error.message }` (or `String(error)` for a non-`Error` throw) — the exception's own identity
  and message, not just the order id list the caller will also see.

**Decision: log ONCE, at the lib layer, not twice.** `route.ts`'s own `console.error` in the
`alertBookkeepingFailed.length > 0` branch was removed rather than kept alongside the new lib-
layer log. Rationale: by the time route.ts's code runs, it only ever has `alertBookkeepingFailed`
(order ids) — the same data already in the HTTP response it's about to send — so a route-level
log could only ever restate information available elsewhere, never add the REASON that's the
whole point of this fix. "One clear log is better than two noisy ones": the lib-layer log is the
one place the real error exists, so it is the one log that matters; a second log at the route
would just be duplicate noise an operator has to cross-reference instead of a single place to
look. The explanatory comment in route.ts (why a bookkeeping-write failure isn't treated as
fatal at the HTTP layer) was kept — that's still real, useful context — just without a redundant
`console.error` call attached to it.

**Sanitisation** (per this project's `.claude/rules/coding.md`: "No logging secrets... Mask
tokens, passwords, PII"): `markOrdersAlertedForResponse`'s signature is
`(orderIds: string[], now: Timestamp, deps)` — it never receives a buyer email, a bearer token,
or any secret, so none of those can reach this log by construction. This is stronger than "we
checked and didn't log anything sensitive" — the function has no path by which it could.

**Observed failing first, per instruction, before the fix was applied:**

```
FAIL: Scenario 1 (MarkOrdersAlertedError): markOrdersAlertedForResponse() logged NOTHING via
console.error on a partial batch-commit failure — the failure reason (a real
Firestore/permission/quota/network error in production) is completely lost; only the HTTP
response, not any log, would tell an operator anything at all.
FAIL: Scenario 2 (unrecognized error): markOrdersAlertedForResponse() logged NOTHING via
console.error on an unrecognized/infra-level throw — the exception type and message are
completely lost.

2 assertion(s) failed.
```

A7 (`check-failure-reason-logged.mjs`) is the assertion that catches this class going forward —
it specifically requires the REASON TEXT to be present in the captured log, not merely that a
`console.error` call happened or that an order id appears in it, so a future "fix" that logs
only `{ orderIds }` again (the same shape the original regression left behind) would still fail
it.

## Second item raised alongside this one — left OUT of this contract, deliberately

@qa flagged that neither `verifySessionCookie` nor `revokeRefreshTokens` in
`app/api/admin/session/route.ts` is bounded by a timeout, so a genuine Firebase network hang
would hang that handler rather than fail fast. This is a real, separate concern, but it is a
different file, a different route, a different failure mode (hang vs. wrong response body), and
a different fix shape (a timeout/race wrapper around an Admin SDK call, not a response-shaping
change) with its own design questions this contract's scope does not need answered — e.g. what
timeout value, whether a timed-out revoke should still clear the cookie (the existing code
already isolates cookie-clearing from revoke failure, so probably yes, but that deserves its own
golden, not one bolted onto this contract's assertions). Recommend a follow-on contract, e.g.
`admin-session-firebase-timeout`, scoped to `app/api/admin/session/route.ts` alone.

## Load-bearing assertion note

Per this project's own documented repeat defect class ("an assertion satisfiable by something
that isn't the real property" — see `feedback_contract_scoring_principles` /
`project_secret_corruption_class` memory), the primary proof (A1/A2/A4 below) is a real,
injected partial-write failure against a `FakeFirestore` — the same dialect as
`check-partial-failure-atomicity.mjs` — asserting the RESPONSE-SHAPING FUNCTION's OUTPUT, not
merely that an error was thrown or logged. A grep for `alertBookkeepingFailed` appearing
somewhere in route.ts would be exactly the weak-assertion pattern this project has already been
burned by twice; it appears here only as a *secondary*, structural check (A3's second half, A5,
A6) layered on top of the real behavioural proof, never as the sole check for any property.

## Files in this directory

- `check-response-splits-partial-failure.mjs` (A1, A2, A4) — the load-bearing proof: three
  scenarios (partial failure, full success, unexpected/unrecognized error) against a
  `FakeFirestore`, asserting `markOrdersAlertedForResponse`'s returned
  `{ alertedNow, alertBookkeepingFailed }` in each case.
- `check-status-and-wiring.mjs` (A3, A5) — pure-function status-mapping proof
  (`reconcileStatusFor`, load-bearing) plus fast-fail structural checks for route.ts's wiring
  and the flag-only write boundary. Asserts NOTHING about auth (see §5 above for why).
- `check-wrong-secret-rejected-with-real-secret-configured.sh` (A6b) — real HTTP, real compiled
  route, a real non-empty test secret configured, proves a wrong bearer token is refused by the
  `constantTimeEqual` comparison branch specifically — the one path A6 (reused from
  order-reconciliation F1, unmodified) cannot reach, because A6's own script blanks the secret
  for every request it sends.
- `check-failure-reason-logged.mjs` (A7) — monkey-patches `console.error`, forces both of
  `markOrdersAlertedForResponse`'s catch branches against a `FakeFirestore`, and asserts the
  captured log text contains the actual failure REASON (not merely the failed order ids the
  HTTP response already carries). Closes the "Failure reason logging" regression above.
