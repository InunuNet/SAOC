# F8 (ticketing-foundation) — comp tickets bypassing PayFast: decision record

Full source: `docs/ticketing-system-foundation-spec.md` §4.5, mission brief F8
(`.agent/memory/project/missions/2026-08-17-ticketing-foundation.md`).

## Known gaps — read this first

Two things below are not weaknesses this contract failed to catch — they are things this
contract, by construction, structurally cannot catch, and a reader needs to know that before
trusting "9/9 green" as a statement about the route. Both were found and verified by QA/the
orchestrator, not self-reported here in advance; this section exists so the next reader doesn't
have to rediscover them.

**1. Nothing in this contract asserts that `app/api/admin/tickets/comp/route.ts` actually calls
the capability check at all.** Delete the `hasCapability(...)` line from the route entirely, or
swap `'issue-comp'` for a far more widely held capability like `'scan-checkin'`, and the FULL
9/9 gate stays green. A3 exercises `hasCapability()` as a pure function with hand-built tokens —
it never touches the route file. A8 proves the route fails closed on session validity (no
cookie / garbage cookie → 401/403) but that refusal happens *before* the route would ever reach
the capability check, so A8 cannot see whether the check is even present. **The regression this
permits, stated plainly: someone deletes or weakens the capability gate on the one route in this
codebase that mints free tickets, the gate stays green, and free tickets ship with no automated
signal that anything changed.** Closing this gap requires either a live Firebase session
(the same live-Firebase requirement blocking the items in "What this contract does NOT prove"
below) or a source-level check that the route file actually calls `hasCapability` with
`'issue-comp'` as a literal argument — the latter is a source-grep, which this project's
coding standard treats as a smell, and it is a weak proxy for the property that actually
matters, so it is not shipped here. Until the live-Firebase step exists, the capability gate's
continued presence in the route depends on code review, not the gate, for every change.

**2. Per-show `manager`/`door-staff` grants are non-functional at every production call site
today — the route included — and this will silently break F13.**
`app/api/admin/tickets/comp/route.ts` calls `hasCapability(session.decodedToken, body.showId,
'issue-comp')` with no third `opts` argument. `lib/admin-auth.ts`'s `hasCapability()` defaults a
missing `lookupShowWindow` to `() => null` (line ~199), and `resolveRoleCapabilitiesForShow()`
treats a `null` window lookup result as "the per-show grant is not honoured" (by design — a
`null` result means refused, not defaulted open, which is the correct fail-closed choice for a
*missing* window, but has the side effect described here when NO real lookup is wired in at
all). Grepping `app/`, `lib/`, `sanity/`, and `scripts/` turns up **no production implementation
of a `ShowWindowLookup` anywhere** — every reference to the type is inside `lib/admin-auth.ts`'s
own definitions. Consequence: in production, a per-show `manager` grant, even squarely inside
its show's date window, is **always refused** — only an org-wide `{'*': ['owner']}` grant works,
because that path skips the window check entirely. A3's per-show case (2) in this contract only
passes because the check script injects its own `NATIONAL_SHOW_ONLY_LOOKUP` — a lookup the real
route never provides. The assertion is honest about what it proves (`resolveRoleCapabilitiesForShow()`
correctly honours a window when given one) but that is not the same claim as "per-show grants
work in production," and a reader could easily conflate the two.

**This is not a free-ticket risk — it fails closed** (a per-show grant that should work is
refused, never the reverse), so it is not being treated as an urgent security item. But it is an
**ordering constraint on F13** ("Lee-Ann granted a real per-show manager role, verified by HTTP
round trips including negative control"): as wired today, granting Lee-Ann a per-show `manager`
role and then verifying it via a real HTTP round trip **will fail**, and it will fail for a
reason nobody would guess from the symptom alone — she would appear to have been granted a role
that simply does not work, when the actual defect is that no feature has ever wired a real
`ShowWindowLookup` (resolving a show's date window from Sanity — its own genuine piece of work,
with real correctness questions: which date fields, and in what timezone — this project has
already been bitten once by a UTC/SAST confusion turning a true published claim into a false
one) into any call site that needs one. **F13 cannot pass until this is resolved. This is not
self-assigned here and no F-number is invented for it — it is flagged as an ordering constraint
for Brad to sequence, the same way the F7 roles-migration sequencing was handled.**

There is already a filed P3 backlog item for "no live Sanity `ShowWindowLookup`." That item
currently reads as a nice-to-have. It is not — it silently disables an entire grant type
(everything except org-wide `owner`) across every capability, on every route, not just this
one. This README is the record that its priority should be re-read against that fact, not just
against F8.

## `npx tsx` vs `node --import tsx/esm` — note for future contract authors

This cost real time twice on this mission (F8's own A4, and a false report that it also broke
F2's shipped checks — it does not; F2 already had it right). The two invocations are NOT
interchangeable for a check that imports a module carrying a real (non-type-only) import through
the `@/*` tsconfig path alias:

- **`node --import tsx/esm <file>.mjs`** strips TypeScript syntax but does NOT resolve the
  `@/*` alias at runtime — a transitive `import { x } from '@/lib/whatever'` (a VALUE import,
  not `import type`) fails with `Cannot find module '@/lib/whatever'`.
- **`npx tsx <file>.mjs`** goes through tsx's CLI resolver, which does honour `tsconfig.json`'s
  `paths` mapping, and resolves the same import correctly.

`import type { X } from '@/lib/whatever'` is erased entirely before either loader runs, so a
check that only ever imports types (not values) through the alias is safe under either
invocation — this is why F8's A5/A6/A7 (which import `lib/comp-tickets.ts`, whose only `@/`
imports are `import type`) pass under `node --import tsx/esm` while A4 (which imports
`lib/orders.ts`, whose `import { initAdmin } from '@/lib/firebase-admin'` is a real value
import) does not. **Rule of thumb: use `npx tsx` for any check whose import chain contains a
VALUE import through `@/*`; `node --import tsx/esm` is fine otherwise.** When in doubt, run the
check both ways before committing to a command — it is a five-second check that has twice cost a
full review cycle to catch after the fact. F2's own contract
(`contracts/contract-ticketing-f2-orders-model.yaml`) already draws this line correctly: A4/A5
(which call `createOrderWithPosition()`) use `npx tsx`; A6/A7 (which don't) use
`node --import tsx/esm`.

## Scope boundary — what F8 is, and what it deliberately is NOT

F8 adds a comp-ticket construction primitive (`lib/comp-tickets.ts`), extends F2's already-shipped
`lib/orders.ts` with an injectable Firestore dependency and a `compedBy` field, and specifies the
shape of `POST /api/admin/tickets/comp` for `@dev` to build. It does **not** touch
`app/api/tickets/itn/route.ts` — that file is sha256-pinned and F10 is the sole authorised
reopening; F8 never imports it, calls it, or requires it to change. It does **not** build any
manager-facing comp-issuing UI (spec explicitly defers this: "Actual manager-facing screens...
are not part of this document's scope"). It does **not** re-derive or duplicate F4's capability
resolution machinery (`hasCapability`/`resolveRoleCapabilitiesForShow`) — F8 proves `'issue-comp'`
is genuinely required by calling those real functions, the same pattern F5's A3/A4 established.

## Why F8 extends F2's `lib/orders.ts` instead of writing its own transaction

`lib/orders.ts`'s own docstring, shipped by F2, already says: *"This module is the shared creation
primitive later features (F8 comp tickets, F10 checkout/ITN rewrite) build on."* `createOrderWithPosition()`
already writes exactly the order/position pair shape F8 needs, inside one `db.runTransaction()`
call, with `gateway`/`gatewayPaymentId` already present at the order level. Writing a second,
parallel comp-specific transaction function would duplicate that logic and create two places the
order/position pair-write invariant could drift apart. F8's only functional addition to
`lib/orders.ts` is:

1. `compedBy?: string | null;` on `CreateOrderPositionInput`, threaded onto the written position
   as `compedBy: input.compedBy ?? null` — additive, so every existing (currently zero, since F2
   shipped the primitive unused) call site keeps compiling unchanged.
2. An optional second parameter, `deps: { db?: OrdersFirestoreLike } = {}`, defaulting to
   `getFirestore(initAdmin())` when omitted. This is the **only** reason A4's fake-store proof is
   possible at all — `createOrderWithPosition()` previously called `getFirestore(initAdmin())`
   directly with nothing injectable, which is exactly why F5's equivalent security-boundary proof
   (A3) had to work at the `hasCapability()` layer instead of exercising a real write path
   end-to-end. `OrdersFirestoreLike`/`OrdersTransactionLike` are deliberately narrow structural
   interfaces — only `collection(name).doc(id?): {id}`, `runTransaction(fn)`, and the
   transaction's `set(ref, data)` — so the real `Firestore`/`Transaction` classes already satisfy
   them with zero adapter code, the same trick F1's `resolveActiveShow()` lookup and F4's
   `ShowWindowLookup` use for injected dependencies elsewhere in this mission.

Everything else — `buildCompOrderInput()`, the `COMP_GATEWAY` constant, the whole comp-specific
shape decision — lives in the new `lib/comp-tickets.ts`, kept separate from `lib/orders.ts` for
the same reason F3's capability set and F4's resolution logic are separate modules: the pure
construction/decision layer and the shared creation primitive have different reasons to change.

## The two things `@dev` must implement, plus the route

1. **`types/index.ts` (extended)** — add `compedBy?: string | null;` to the existing `Ticket`
   interface. Optional: a pre-F8 `Ticket` literal that never mentions the field must still compile
   (A2 proves this with a real literal).
2. **`lib/orders.ts` (extended)** — see "Why F8 extends F2's `lib/orders.ts`" above for the exact
   shape of the two additions.
3. **`lib/comp-tickets.ts` (new)** — `COMP_GATEWAY`, `BuildCompOrderInput`,
   `CompOrderPositionInput`, `buildCompOrderInput()`. See the contract yaml's feature description
   for the exact field-by-field shape; the module is pure construction, no Firestore, no network,
   no `Date.now()`.
4. **`app/api/admin/tickets/comp/route.ts` (new — not a golden)** — `POST` handler: `getAdminSession()`
   first (401/403 on session failure), then `hasCapability(decoded, showId, 'issue-comp', opts)`
   (403 on capability failure), then `buildCompOrderInput(...)` → `createOrderWithPosition(built)`
   with no `deps` override. Body validation is dev's responsibility, mirroring checkout's existing
   `isValidCheckoutBody` discipline. This file is not a golden because its HTTP-layer behaviour
   beyond fail-closed auth (A8) cannot be proven offline — see below.

## Why `buyerName`/`buyerEmail` are set to the attendee's own name/email

A comp has no separate "buyer" concept the way a PayFast purchase does — nobody transacted, the
attendee was simply granted a ticket. Rather than inventing a placeholder buyer identity (e.g. the
issuing staff member as "buyer", which would misattribute the order to the wrong person on any
buyer-facing surface — F5's `buyers` collection, F6's recovery flow), the order's `buyerName`/
`buyerEmail` are the attendee's own. This keeps a comp order fully compatible with F6's recovery
token (scoped to `orderId`, resolves to `buyerEmail` — the attendee, correctly, can recover their
own comp ticket the same way a paying buyer recovers theirs) without any comp-specific branching
in F6's code. `compedBy` is the separate, purpose-built field for staff attribution — conflating
it with `buyerEmail` would have made the audit trail ambiguous the moment a comp needed a
buyer-facing recovery flow.

## Comp amount/payment-field decision

- **`amount: 0`**, not `null`. A `null` amount would need special-casing in every place that sums
  order amounts for revenue reporting (`Number(null)` coerces to `0` in some contexts and `NaN` in
  others depending on the operation — an inconsistent trap). `0` is unambiguous arithmetic and
  composes correctly with any `SUM(amount)` reconciliation query without a null-check.
- **`status: 'paid'`**, not a new `'comped'` status. A comp position is, factually, admitted at the
  door exactly like a paid one (spec §4.5, mission brief: "a comp position correctly has
  `status: 'paid'`... without ever touching PayFast"). Introducing a fourth admitted-equivalent
  status would require `lib/checkin.ts`'s admission check (`status !== 'paid'` → refuse) to widen
  its comparison, which is exactly the kind of edit the mission's Scope Discipline section is
  wary of touching without a named reason — no such reason exists here.
- **`gateway: 'comp'` is the ONLY safe reconciliation discriminator.** Never filter comps out of a
  revenue report by `amount === 0` alone — a future genuinely-free real ticket tier (a
  promotional/child tier priced at 0, plausible given the spec's own placeholder tier discussion in
  §6/§11) would also have `amount === 0` without being a comp. A5 asserts `gateway === 'comp'` is
  present and treats it as the load-bearing field; the amount/status decisions above are asserted
  but explicitly documented as *not* independently sufficient to identify a comp.
- **`gatewayPaymentId: null`, `pf_payment_id: null`, `m_payment_id: null`.** All three PayFast
  identifier fields are null, not empty strings or placeholder sentinels — a reconciliation script
  joining against real PayFast settlement records by `pf_payment_id` will simply never match a comp
  row, in either direction. An empty string (`''`) would have risked matching against a
  similarly-malformed real record if one ever existed; `null` cannot.
- **`idempotencyKey: comp:${bookingRef}`**, not client-supplied. Checkout's idempotency key comes
  from the buyer's own `Idempotency-Key` HTTP header (retried browser requests); a comp route has
  no such client in the retry-prone sense — an admin either submits the comp form once or doesn't.
  Deriving the key from the server-generated `bookingRef` (which is itself ~60 bits of entropy,
  `lib/booking-ref.ts`) makes it deterministic per comp, traceable back to the position it created,
  and structurally incapable of colliding with the two forbidden sentinel UUIDs checkout's own
  route refuses (A5 asserts this explicitly).

## The capability gate — how "any admin can comp" is proven to actually die

The mission brief's third warning (after F4's A3 and F5's A3) is about assertions whose *stated*
claim ("capability X is required") is broader than what their *cases* actually vary. Before
finalising A3, every case was checked against this question: **what dimension stays constant
across all its cases?** For F4's/F5's original defect, every test token happened to be an owner
(or, in F5's pre-fix form, every token that varied the allowlist dimension had no `roles` claim at
all) — so a mutation that granted based on something *other* than the real capability check could
still pass, because nothing in the suite ever gave that mutation a case where the shortcut and the
real check would disagree.

A3's six cases are built specifically so that dimension can't happen here:

| Case | admin:true | roles claim | issue-comp expected | What it would catch if missing |
|---|---|---|---|---|
| (1) door-staff | yes | `{nationalShow:['door-staff']}` | **false** | Nothing (baseline: has a role, lacks the capability) |
| (1b) same token, scan-checkin | yes | same | **true** | hasCapability() vacuously false for this token |
| (2) manager | yes | `{nationalShow:['manager']}` | **true** | Capability genuinely granted when held |
| (3) owner | yes | `{'*':['owner']}` | **true** | Org-wide grant path broken |
| **(4) admin, no roles claim at all** | yes | **none** | **false** | **The "any admin can comp" mutation named in the brief** — a check that reduces to `isAdminToken(decoded)` alone would grant this case incorrectly while passing every other case unchanged |
| (5) manager, wrong show | yes | `{'show-19-2027':['manager']}`, requested `nationalShow` | **false** | Per-show scoping bypassed — "any capability held anywhere" |
| (6) manager, lapsed window | yes | `{nationalShow:['manager']}`, window already closed | **false** | Date-window lapse mechanism (F4) not actually consulted |

Case (4) is the one that specifically isolates "admin:true is necessary but not sufficient" — every
other case either already holds `issue-comp` (2, 3) or already holds *some* role that plainly lacks
it (1, 5, 6), so a mutant that skipped the capability check and substituted a cheaper "is this
person some kind of staff" heuristic keyed on the mere *presence* of a `roles` claim would still
pass (1)/(5)/(6) — hence the need for a case with admin:true and literally no `roles` claim at all,
which only a real, capability-specific check refuses correctly.

## Pair-write atomicity — what the fake store proves and why it's honest

`FakeFirestore` (in `check-pair-write-atomicity.mjs`) models exactly one property of real
Firestore: **a `runTransaction()` callback's writes are staged and only committed together if the
callback resolves; if it throws, nothing staged is committed.** This is not a reimplementation of
`createOrderWithPosition()`'s business logic (the fake never touches order/position field
construction) — it is a model of the commit/rollback *contract* the real Firestore SDK documents
and guarantees. Because `createOrderWithPosition()` is called unmodified (just with the fake
injected as `deps.db`), any change to how it writes the pair is exercised for real, not simulated.

The defeating mutation this is built to catch: an edit that splits the current single-transaction
write into two independent calls (e.g. `await db.collection('orders').doc(id).set(order)` directly,
followed by a *separate* `db.runTransaction(tx => tx.set(ticketsRef, position))`). Case (2) forces
the position write to fail and asserts the order was **not** committed either — a split-write
mutation would leave the order committed (its independent call already succeeded before the
position's separate transaction failed), so the assertion would catch the drift. Case (3) is the
symmetric negative control (force the *order* write to fail instead), added so the atomicity claim
doesn't rest on an artefact of write ordering — if only case (2) existed, a mutation could
theoretically still route the *first* write through the shared transaction while leaving the
*second* independent, and case (2) alone wouldn't distinguish that from genuine atomicity.

## Attribution and injected time

`compedBy` is asserted to record the issuing staff member's email verbatim (A6, cases 1–2).
`purchasedAt` is asserted to derive exclusively from the caller-supplied `now`, never
`Date.now()`/`new Date()` internally — proven the same way F4's `ShowWindowLookup` and F6's
mint/verify are proven: two calls with an *identical* explicit `now`, several real milliseconds
apart, must produce identical `purchasedAt` values (A6 case 3); two calls with genuinely different
`now` values must differ (A6 case 4, ruling out the equality in case 3 being explained by the
function ignoring `now` and always returning some constant).

## Door indistinguishability — what could NOT be proven offline, stated plainly

The mission brief asks: *"A comp ticket must be indistinguishable from a paid ticket AT THE DOOR
— it scans and admits normally. Note in the README whether anything in the check-in path would
treat it differently, and if you cannot prove that offline, say so plainly rather than asserting
it."*

**Finding, by reading `lib/checkin.ts` (F1/ticketing-hardening, unmodified by F8):** the admission
decision in `admit()` (lines ~82–92) branches on exactly two fields read from the position
document — `showId` (must equal `NATIONAL_SHOW_ID`) and `status` (must be `'paid'`, refusing
`'checked-in'` first). It never reads `gateway`, `amount`, `compedBy`, or `orderId`. `toTicket()`
(the function that shapes the document into the `Ticket` type returned to the caller) likewise
reads the same fixed field set for every position regardless of gateway. A comp position built by
F8 (`status: 'paid'`, `showId: 'nationalShow'`) is therefore, by source-level reading, admitted
through the identical code path a paid position takes.

**This is a source-reading finding, not a contract assertion, and that distinction is
deliberate — not a downgrade of a testable claim into an untested one.** `checkInByBookingRef()`
calls `getFirestore(initAdmin())` directly inside `admit()`, with no injected dependency — unlike
`lib/orders.ts`, this function was never built to be called against a fake store, and F8's scope is
"comp-ticket route... does not modify the ITN route" — refactoring `lib/checkin.ts` to accept an
injected store is a different feature's job (it isn't named as F8's, and `lib/checkin.ts` is
shared, security-critical, load-bearing code for every ticket type, not something to open as a side
effect of proving one narrow property). Per the hard constraint against any check creating a
document anywhere, and against needing live Firestore, this property is **not** covered by an
automated assertion in this contract. It is handed to F12 (the human purchase-and-scan proof
milestone) as an explicit thing to observe: when F12's tester scans a comp-issued ticket at the
door (if one is comped for that proof run), it should admit identically to a paid one, with no
distinguishing behaviour — this README is the record that the source-level reasoning behind that
expectation was checked, not assumed.

## What this contract does NOT prove

- **That the route calls the capability check at all, let alone that a genuine admin session
  lacking `issue-comp` is refused with HTTP 403 specifically, over real HTTP, against a real
  running route.** See "Known gaps" (1) above for the full statement of what this permits — A8
  proves the route fails closed on session validity (no cookie / garbage cookie → 401/403, never
  200), which never gets far enough to reach the capability check at all; A3 proves
  `hasCapability()` itself is correct in isolation, never that the route calls it. Proving the
  capability-specific HTTP refusal requires a real, cryptographically valid Firebase session
  cookie for an account with `admin:true` but no `issue-comp` capability — impossible without a
  live Firebase Auth project (no emulator is pinned in this repo; see F5's README "Why no
  Firebase emulator" for the same reasoning). Deferred to a human-run manual round trip, the same
  posture F5 took for `/api/admin/checkin`.
- **That a per-show `manager`/`door-staff` grant is honoured in production at all.** See "Known
  gaps" (2) above — the route calls `hasCapability()` with no `opts.lookupShowWindow`, which
  defaults to a lookup that always returns `null`, which `resolveRoleCapabilitiesForShow()`
  correctly treats as "refuse this per-show grant." No production `ShowWindowLookup`
  implementation exists anywhere in this codebase today. A3's per-show case (2) proves
  `resolveRoleCapabilitiesForShow()` honours a window when one is injected — it does NOT prove
  the route ever injects one, and today it does not. This is an ordering constraint on F13, not
  a defect this contract can close (see "Known gaps" (2) for why, and for why it is being flagged
  rather than silently patched here).
- **That a genuine manager/owner session WITH `issue-comp` succeeds with 201/200 and actually
  writes a comp order to live Firestore.** Same live-Firebase requirement as above. Deferred to a
  human-run manual step (or F12's proof run, if a comp is issued during it).
- **Door indistinguishability, behaviourally.** See "Door indistinguishability" above — proven by
  reading `lib/checkin.ts`'s source, not by an automated check, because that function has no
  injectable Firestore dependency and refactoring it is out of F8's scope.
- **That the route's request-body validation rejects malformed input correctly** (missing fields,
  wrong types, an unknown `ticketType`, a `showId` that isn't the active show). This mirrors
  checkout's own `isValidCheckoutBody` pattern but is dev's implementation responsibility per the
  contract's feature description, not separately contract-tested here — A8 only exercises the
  auth-refusal path, which happens before body validation runs.
- **Whether Sanity's `ticketType` catalogue actually contains the `ticketType` slug a comp route is
  asked to issue.** F8's `buildCompOrderInput()` accepts whatever `TicketType` string it's given;
  validating that string against the live Sanity catalogue (if desired) is a route-level concern,
  not proven here.
