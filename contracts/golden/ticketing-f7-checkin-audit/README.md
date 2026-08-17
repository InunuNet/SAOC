# F7 (ticketing-foundation) — check-in audit trail: decision record

## Scope boundary — what F7 is, and what it deliberately is NOT

F7 adds a `checkinAttempts` Firestore collection shape (spec §7.3) and the pure, offline-testable
decision/construction logic that produces one append-only record for **every** scan attempt —
admits and refusals alike. It does **not** build the offline sync/reconcile machinery of spec
§7.2/§7.4 (service worker, IndexedDB cache, `syncedAt` reconciliation) — F7 only reserves the
`source`/`syncedAt` shape that machinery will eventually need, exactly as the mission brief
specifies and exactly the "decide the shape now, defer the feature" pattern §7.4 itself names for
§4.1's `show` and §4.2's `orders`.

The one module `@dev` must implement:

**`lib/checkin-audit.ts` (new)** — pure construction module (no Firestore, no network, no
`Date.now()`/`new Date()` call anywhere in the file), mirroring the pattern F5's `lib/buyers.ts`
and F6's `lib/recovery-token.ts` already established:

- `CHECKIN_ATTEMPTS_COLLECTION = 'checkinAttempts'`
- `CheckinAttemptOutcome` — eight members (see "Why the outcome enum is wider than spec §7.3's
  literal text" below)
- `CheckinAttemptSource` — `'online' | 'offline-queued'`
- `CheckinAttemptRecord` — the ten-field record shape (see "PII minimisation" below)
- `BuildCheckinAttemptInput`, `buildCheckinAttemptRecord()` — pure construction
- `AppendOnlyCheckinAttemptsStore`, `RecordCheckinAttemptResult`, `recordCheckinAttempt()` —
  the write contract, proven against a fabricated in-memory store
- `AuditWriteFailureContext`, `logAuditWriteFailure()` — the loud, non-blocking failure path

The full field-level spec is in the contract's `features[0].name`; this README covers the
judgement calls, the defeating mutations, and — per the architect brief's explicit instruction —
what this contract cannot prove offline and hands to a human/QA step instead.

## Judgement call 1 — the outcome enum is wider than spec §7.3's literal text, and why

Spec §7.3 names five outcomes verbatim: `admit` / `not-found` / `wrong-show` / `unpaid` /
`already-checked-in`. The mission brief's design intent, written by the same person who owns this
mission, is explicit and goes further: *"A denied scan, a duplicate/already-used ticket, an
unknown QR, a malformed payload, a ticket for the wrong show, and a scan by someone lacking the
capability must ALL produce an attempt record."* Two of those — a malformed payload, and a scan
refused for lacking the `scan-checkin` capability — have no home in the spec's literal
five-member enum.

Both are real, already-occurring refusal paths in `lib/checkin.ts`/`app/api/admin/checkin/
route.ts` today:

- `checkInByBookingRef()` already returns a `'bad-request'` `CheckinRefusalCode` when
  `bookingRef` is missing or empty — this never reaches Firestore at all today, and would
  otherwise leave **zero** trace, the same gap §7.3 exists to close for every other refusal.
- The route today checks `admin:true` only (`getAdminSession()`), never a specific capability —
  meaning a caller who is a genuine admin but holds no `scan-checkin`-granting role (e.g. an
  account freshly granted `admin:true` before any `--role` grant from `scripts/admin-grant.ts`
  runs) can currently reach `checkInByBookingRef()` at all. F7 closes that gap by having the
  route check `hasCapability(decoded, showId, 'scan-checkin')` immediately after the session
  check (see "Judgement call 3" below) — a refusal there needs an outcome to log against too.

Rather than force these two into one of the five existing names (which would make a `not-found`
or `unpaid` count include cases that never touched a ticket document at all, corrupting any
future "count outcomes by type" query the mission's own Done criteria for F7 asks for), the
contract adds `'malformed'` and `'not-authorized'` as two new, honestly-named members. This is
the same kind of deliberate, documented correction F2 made to `TicketStatus`'s member count and F1
made to the `show`/`nationalShow` identifier conflation — call out the correction at the point it
happens, don't silently absorb it.

### A third addition: `'infra-error'`, found by @qa against the shipped implementation, not by this contract's own design review

The two members above were anticipated at design time. A third was not, and was caught the way
this project's own coding rules say it should be: @qa read the shipped
`app/api/admin/checkin/route.ts` and found that its `catch` block around `checkInByBookingRef()`
— which fires when the call throws for a reason **unrelated to any admission decision** (a
Firestore outage mid-transaction, say) — did `console.error` and returned `500`, and never
audited anything. Zero `checkinAttempts` records are written for that branch today. This is
precisely the silent-gap class F7 exists to eliminate, and it slipped past this contract's first
draft because the draft's own "Judgement call 2" (below) asserted, without verifying it against
the actual code, that the write happens "whether the transaction resolved with an admit or a
refusal, or even threw for an unrelated reason." That sentence described intent, not the shipped
route — see the correction inline in Judgement call 2.

`'infra-error'` is the eighth `CheckinAttemptOutcome` member, added to close this gap. It is
deliberately NOT folded into `'malformed'` (which means "the request itself was never valid — no
admission decision was ever attempted") or any refusal code (all of which mean "a real admission
decision was reached, and it was no"). `'infra-error'` means neither: an admission decision was
never reached at all, for a reason outside the admission logic's control. Folding it into an
existing member would corrupt the "count outcomes by type" query the mission's Done criteria
requires, exactly the reasoning that already justified the original five-to-seven widening —
staying consistent with that reasoning is why this is an eighth honestly-named member and not a
reuse of `'malformed'`.

## Judgement call 2 — the write is NOT in the same Firestore transaction as the admission decision

Spec §7.3's literal text says the audit write "happens on the same transaction as the admission
decision in `lib/checkin.ts`, adding no new abort surface." The architect brief's own steer
directly contradicts the natural reading of "same transaction": *"a scan whose audit write fails
should still admit the ticket-holder ... but must surface the failure loudly rather than
swallowing it."*

These two sentences cannot both be true if the audit write is folded into
`checkInByBookingRef()`'s existing `db.runTransaction()` call. A Firestore transaction is atomic —
if the transaction body throws (which a rejected `addCheckinAttempt()`-equivalent write inside it
would, since Firestore transaction bodies propagate their own errors as the transaction's
rejection), **every** write in that transaction rolls back, including the position's flip from
`paid` to `checked-in`. That is exactly the failure mode the brief says must not happen: a person
who should be admitted gets turned away by a logging fault.

**Decision: the audit write happens OUTSIDE `checkInByBookingRef()`'s transaction**, immediately
after it settles (whether the transaction resolved with an admit or a refusal), and for
`'malformed'`/`'not-authorized'` — which never open a transaction in the first place today —
before any transaction is ever considered. `recordCheckinAttempt()` itself never throws (proven by
A6): a failed write returns `{recorded: false, error}`, which the caller passes to
`logAuditWriteFailure()` for the loud, ERROR-level, non-blocking half.

**Correction (post-@qa-FAIL, 2026-08-17):** an earlier draft of this sentence also claimed the
write happens "or even threw for an unrelated reason — the outcome is still known at that point
and still gets logged." **That was a statement of intent this contract had not actually verified
against the shipped route, and it was false against the code @dev implemented first**: @qa read
`app/api/admin/checkin/route.ts:88-94` and found the `catch` block around
`checkInByBookingRef()` — which fires when the call throws for a reason unrelated to any
admission decision — logs to `console.error` and returns `500`, and calls neither
`recordCheckinAttempt()` nor `logAuditWriteFailure()`. Today, a door-side Firestore blip produces
**zero** `checkinAttempts` records — exactly the silent-gap class this feature exists to
eliminate. The `'infra-error'` outcome (see Judgement call 1's third addition, above) and the
requirement below correct this: the design intent was always that every reachable branch audits
something, but the sentence describing it got ahead of the code proving it, and a reader trusting
this README over the code would have been wrong. **The current, verified requirement, stated so
code and record agree:** the route's `catch` block around `checkInByBookingRef()` MUST call
`recordCheckinAttempt()` with `outcome: 'infra-error'` before returning its `500` response. This
is not yet true of the shipped route as of this correction — @dev must wire it, and A3's coverage
now includes an `'infra-error'` case specifically so a future regression here has a fake-store
assertion to fail against, not merely a README claim to contradict.

This is "adds no new abort surface" read the way that actually matters operationally — the
admission decision's abort surface (what can stop a genuine admit from succeeding) gains nothing
new — rather than the literal "same `db.runTransaction()` call" reading, which would have added
exactly the new abort surface the brief explicitly forbids. If a future spec revision disagrees
with this reading, that is a spec correction to make explicitly, the same way F1/F2's corrections
were made, not a reason to quietly refold the write into the transaction later without re-deciding
this tradeoff.

## Judgement call 3 — wiring `scan-checkin` capability enforcement into the checkin route is a genuinely NEW control, and it MUST NOT SHIP before the roles migration is applied

**Correction (post-review, 2026-08-17):** an earlier draft of this section justified this
control's safety by claiming "F4's one-time migration already re-granted every existing
`admin:true` account `roles: {'*': ['owner']}`." **That claim was false and has been removed
from the record it was made in.** `scripts/admin-migrate-roles.ts` is dry-run by default and has
**never been executed with `--apply` against the live Firebase project** — confirmed against
`.agent/memory/project/backlog.md`'s standing item ("The live `roles`-claim migration has NOT
been run... No account currently holds a `roles` claim, including `brad@inunu.net`") and
`docs/ticketing.md`'s migration section, which documents `--apply` as a step still awaiting
Brad's authorisation, not as something already done. **Right now, zero accounts hold a `roles`
claim, full stop.**

`grep -rn "hasCapability" app/` today returns zero matches — no route in this codebase currently
checks a specific capability; `app/api/admin/checkin/route.ts` gates on `admin:true` alone via
`getAdminSession()`. F3/F4 built the capability system and proved it in isolation
(`contracts/golden/ticketing-f3-admin-roles/`, `contracts/golden/ticketing-f4-roles-claim/`), but
no F-item in the mission's current 14-feature list explicitly says "wire `hasCapability` into the
existing admin routes."

The mission brief for F7 asks, by name, for "a scan by someone lacking the capability" to produce
an audit record — which is only a reachable code path at all if the route actually checks the
capability. F7 therefore instructs `@dev` to add exactly one new check to
`app/api/admin/checkin/route.ts`: `hasCapability(decodedToken, showId, 'scan-checkin')`
immediately after the existing session check, refusing with `403`/`not-authorized` (logged to
`checkinAttempts`) when it fails.

**This is flagged here explicitly, not silently absorbed as "just audit trail" work**, because it
is a real, behaviour-changing authorization enforcement point, not a passive observer. Given the
correction above, the actual risk is the opposite of "low": `hasCapability()` returns `false` for
every account today, because `resolveRoleCapabilitiesForShow()` has no `roles` claim on any
account to resolve. **If this enforcement ships to a live door device before
`pnpm exec tsx scripts/admin-migrate-roles.ts --apply` has been run and verified against real
accounts, every door scanner is refused for every account, including Brad's.** No contract gate
would catch this — A3/A4/A6/A7 all run offline against fabricated tokens/roles claims the test
constructs itself, not against the live project's actual (currently empty) claim state. The
failure surfaces at a door, at a show, to a volunteer with no way to fix it, which is exactly the
class of failure `.agent/memory/project/needs-human.md` exists to flag ahead of time rather than
discover live (see the new entry added there).

### Hard prerequisite — do not ship this control to a live door device out of order

1. Run `pnpm exec tsx scripts/admin-migrate-roles.ts` (dry-run) against the live project and
   confirm the printed plan grants `{'*': ['owner']}` to every account that needs door access,
   most immediately `brad@inunu.net`.
2. Run `pnpm exec tsx scripts/admin-migrate-roles.ts --apply` — this requires Brad's explicit
   authorisation; it is a human-gated step, not something any agent may run unprompted.
3. Verify with `pnpm exec tsx scripts/admin-list.ts` that the target accounts now show a `roles`
   claim.
4. Only then may `hasCapability(decodedToken, showId, 'scan-checkin')` enforcement in
   `app/api/admin/checkin/route.ts` be deployed to a device real door staff will use.

**Ownership of this ordering is explicitly NOT self-assigned here.** F13 ("Lee-Ann granted real
per-show `manager` role, verified by HTTP round trips including negative control") is the natural
place in the mission where live `roles` claims first get created and proven end-to-end against a
real account — which suggests route-level enforcement should not precede it — but that is a
sequencing call for Brad (or whoever plans the mission next) to make explicitly, the same way F5's
buyer-boundary manual procedure and F6's TTL value were left as open ownership questions rather
than folded into F13/F14 without a deliberate decision. Do not infer from this README that F13
now owns wiring the enforcement itself; it owns proving live roles exist, which is the
precondition this section depends on.

## PII minimisation and why the QR payload is never stored

The architect brief is explicit: *"Do NOT design a record that stores the raw QR payload if that
payload is or contains a signed token — a leaked audit collection must not become a
ticket-minting oracle."*

Spec §7.1 (confirmed, not merely assumed, by the prior-art review already in this mission) settled
that this project's QR codes are **unsigned, random 60-bit booking references** — not a signed
secret. That has two consequences for F7's field design:

1. `bookingRef` genuinely is what the brief calls "what was scanned" — it is not, itself, a signed
   token, so storing it is not creating a new oracle: it is the same live credential that already
   sits, unencrypted, on the `tickets/{bookingRef}` position document every door-staff account can
   already read via `lookup-booking-ref`. A leaked `checkinAttempts` collection exposes no more
   than a leaked `tickets` collection already would.
2. Nothing else about the scan is stored. `CheckinAttemptRecord` deliberately has **no**
   `attendeeName`, `attendeeEmail`, or `buyerEmail` field — those live on the position/order
   documents already, reachable by `orderId`/`bookingRef` for anyone who actually needs to
   reconstruct a dispute and already holds a capability to look them up. Duplicating them onto
   every scan attempt — including the high-volume `not-found`/`malformed` refusal cases, which by
   definition often come from mistyped or unrelated input, not a real attendee at all — would
   needlessly widen the POPIA-relevant surface of a collection every `scan-checkin`-holding
   door-staff account can write to. A2/A4 prove no such field can pass through even if a future
   caller tries to smuggle one in.

`deviceId` is included per spec §7.3's literal field list, typed `string | null`, defaulting to
`null` — no device-fingerprinting UI is built by F7 (out of scope, same "reserve the shape, defer
the feature" reasoning as `source`/`syncedAt`); a future door-device identifier can be threaded
through `BuildCheckinAttemptInput.deviceId` without a schema change when that work happens.

## What each assertion proves, and its defeating mutation

- **A1/A8** — `pnpm type-check` / `pnpm lint` still pass with `lib/checkin-audit.ts` added.
- **A2** — compiler-driven proof of every exported shape, including a `@ts-expect-error`-guarded
  literal proving `AppendOnlyCheckinAttemptsStore` is a closed interface (an object literal
  assigned directly to it may declare `addCheckinAttempt` and nothing else). Defeating mutation:
  widening the interface to permit an `updateCheckinAttempt` member — verified live, both
  directions: with the interface as specified, A2 passes; temporarily adding
  `updateCheckinAttempt?: (id: string, patch: Partial<CheckinAttemptRecord>) => Promise<void>;`
  to `lib/checkin-audit.ts`'s interface makes A2 fail with `TS2578: Unused '@ts-expect-error'
  directive` (reverted immediately after, confirmed byte-identical to the original); A2 passes
  again once reverted.

  **A directive-placement defect shipped in the first draft of this fixture and was caught during
  @dev's implementation, not by this contract's own design review — worth naming so the next
  contract author places `@ts-expect-error` deliberately.** The first draft put the directive on
  the comment block immediately above the object literal's *opening* line
  (`const invalidStoreWithUpdate: AppendOnlyCheckinAttemptsStore = {`), several lines above the
  actual `updateCheckinAttempt:` property. TypeScript reports an excess-property diagnostic
  (TS2561) at the *offending property's own line*, not at the literal's opening brace — so a
  directive attached to the opening line suppresses nothing. The result was **both** TS2578
  (unused directive, because the expected error never appeared where the directive looked) *and*
  TS2561 (the real excess-property error, unsuppressed) firing together, and A2 failing outright.
  A `@ts-expect-error` that never fires where you think it does is indistinguishable from a
  passing test until someone actually reads the diagnostic's line number — the same family of
  defect as the two "assertion's claim is broader than what its cases actually test" gaps this
  mission already hit (F4's A3, F5's A3): a proof mechanism that looks load-bearing by
  construction but is silently checking nothing, discoverable only by deliberately trying to make
  it fail. The fix: the directive now sits on its own comment line directly above the
  `updateCheckinAttempt:` property line inside the literal, not above the literal's declaration.
  The explanatory prose stays, now written to say *why* the directive is placed where it is, not
  just what it proves. **@qa independently re-verified this fix** by re-widening the interface a
  second time (in the same way, as their own check rather than trusting this README's claim) and
  confirmed A2 fails the same way and passes again on revert.
- **A3** (`check-outcome-coverage-fake-store.mjs`) — the load-bearing property this whole feature
  exists for: all EIGHT outcomes each produce exactly one record, with `refusalReason` forced to
  `null` only on `admit`, `orderId` null only where genuinely unresolvable, `scannedByUid`
  reflecting whether a real caller identity exists at that decision point, and `source`/`syncedAt`
  behaving correctly. The `'infra-error'` case (added post-@qa-FAIL) is deliberately NOT a copy
  of `'not-found'`'s field combination with only the outcome label changed: `bookingRef` AND
  `showId` are both known (the route had already parsed the bookingRef and was operating against
  the fixed active show before the throw interrupted it), while `orderId` stays null because the
  throw happened before any position/order could be resolved — a genuinely distinct combination,
  not a relabelled clone. No dimension is held constant across the eight cases (see "Self-audit"
  below). Defeating mutation: gating the write behind `outcome === 'admit'`, or behind any
  narrower allow-list omitting `'malformed'`/`'not-authorized'`/`'infra-error'` — the skipped
  cases would see zero records.
- **A4** (`check-record-shape-and-pii-minimization.mjs`) — the returned key set is exactly the ten
  documented fields even when the input is deliberately widened with smuggled PII/secret-shaped
  properties (`qrPayload`, `rawToken`, `signedToken`, `token`, `attendeeEmail`, `buyerEmail`,
  `attendeeName`); the `admit`-forces-`refusalReason`-null and `syncedAt`-always-null rules are
  each proven with a case that deliberately supplies a non-null value, so the assertion fails if
  the forcing logic is ever removed rather than merely never exercised. Defeating mutation:
  widening the return statement to a shallow spread of the raw input instead of an explicit field
  list — the smuggled keys would then appear in the output.
- **A5** (`check-append-only-usage.mjs`) — a Proxy-wrapped store throws if
  `recordCheckinAttempt()` reads or calls any property other than `addCheckinAttempt`, proving the
  append-only guarantee holds at the actual call site, not merely in the declared type (which A2
  already covers separately). Defeating mutation: a rewrite that additionally calls an
  `updateCheckinAttempt`/reads a `.doc`/`.collection` property on the passed store — the trap
  fires.
- **A6** (`check-write-failure-does-not-block-admission.mjs`) — the architect brief's steer,
  proven directly: a store whose `addCheckinAttempt()` always rejects never causes
  `recordCheckinAttempt()` to throw (tested with NO surrounding try/catch, so an unhandled
  rejection would crash the script and fail the check on its own), for both an admit and a
  refusal case; `logAuditWriteFailure()` logs exactly once via `console.error` (never
  `console.warn`/`console.log`), never throws, and returns `void`. Defeating mutation: removing
  the try/catch inside `recordCheckinAttempt()` — the resolve-normally assertion fails, catching
  the exact regression the steer exists to prevent.
- **A7** (`check-zero-authorization-meaning.mjs`) — same rule and same harness shape as F5's A3
  and F6's A8, including the case(5)-style combo (admin absent, allowlisted email, a live
  `{'*': ['owner']}` roles claim) those two files needed to add before a real admin-gate-bypass
  mutation was actually caught by a case that varies the gate's input while also giving the rest
  of the function something to act on.

## Self-audit — the "held-constant dimension" trap, applied to every assertion here

The architect brief calls out, by name, a defect shape that has shipped twice already in this
mission (F4's A3, F5's A3): an assertion whose cases all vary one dimension while holding constant
the very thing needed to actually exercise the property under test.

- **A3**: could this have shipped testing only `admit` vs. one refusal code, both holding
  `refusalReason`/`scannedByUid`/`orderId` presence constant? Checked explicitly — the eight cases
  vary `refusalReason` presence (present for seven, forced-null-despite-being-passed for
  `admit`), `refusalReason` *content* (each non-`admit` case carries wording distinct enough that
  a mutation confusing two refusal outcomes would be caught, including `'infra-error'`'s reason
  text being the route's actual generic failure message rather than a decision-table refusal
  string), and `orderId` resolvability (null for four — `not-found`, `malformed`,
  `not-authorized`, `infra-error` — non-null for four). `'infra-error'` specifically avoids
  reusing `not-found`'s exact field combination (see the A3 bullet above) so the new case is not
  merely a relabelled duplicate. The one dimension that stays literally identical across all
  eight — `scannedByUid` being non-null in every case — is deliberate, not an oversight: **every
  current caller of `recordCheckinAttempt()` in this design is authenticated before it is ever
  invoked** (the route's session check happens first, even for the
  `'malformed'`/`'not-authorized'`/`'infra-error'` outcomes), so there is no real code path where
  `scannedByUid` would be null at this call site. A future feature that lets an unauthenticated
  caller reach this function would need its own case added here first — noted, not silently
  assumed away.
- **A4**: could this have shipped testing PII-smuggling only on the `admit` outcome? Checked — the
  smuggling case (2) uses `admit`, and the forcing-invariant cases (3)/(5) each use a different
  outcome (`admit` and `not-found` respectively) specifically so that (3)'s "refusalReason forced
  on admit" claim and (5)'s "refusalReason passes through on non-admit" claim cannot both be
  explained by one shared code path being untested.
- **A5**: only one dimension is genuinely fixed here on purpose — every case still calls
  `recordCheckinAttempt()` exactly once. That is intentional: A5 is scoped to prove call-site
  *shape* (which methods are touched), not outcome coverage (A3's job) or record content (A4's
  job). Testing it across two different outcomes (admit, refusal) still guards against a mutation
  that only behaves append-only on the happy path.
- **A6**: both halves (a) and (b) are run against two distinct outcomes (`admit`, `wrong-show`),
  not one — a mutation that only wraps the `admit` branch in a try/catch, leaving refusal-path
  writes unprotected, would be caught.
- **A7**: mirrors F5/F6's own self-audit conclusion directly — case (3)'s combination (no `admin`
  claim + allowlisted email + a live, generous-window, `owner`-granting roles claim) is the one
  combination needed to actually exercise an admin-gate-bypass mutation, not merely vary the
  allowlist or roles dimension in isolation the way F4's original A3(e) gap did.

## What this contract does NOT prove

Per the hard constraints (offline, credential-free, no live Firebase, no network, no document
creation of any kind), this contract proves the pure module in isolation, against a fabricated
in-memory store. It explicitly does **not** prove:

1. **That `app/api/admin/checkin/route.ts` actually calls `recordCheckinAttempt()`/
   `logAuditWriteFailure()` on every real code path** (no session, invalid session, missing
   `scan-checkin` capability, malformed body, not-found, wrong-show, unpaid, already-checked-in,
   admit, and now the `catch` block's `'infra-error'` path). Proving this needs either a live
   Firebase Auth session (this repo has no pinned `firebase-tools`/emulator, per F5's README "Why
   no Firebase emulator" — the same reasoning applies unchanged here) or a source-level call-site
   audit, which the project's own rules treat as a design smell when a behavioural alternative
   exists. **This is a real gap, named rather than downgraded to a grep — and it is exactly the
   gap that let the `'infra-error'` branch ship unaudited in the first place**: @qa found that
   defect by reading the route's source, which is the fallback this section already recommended,
   but it is not something any of A1-A8 could catch, because none of them execute the route at
   all. Recommended: a human/QA manual step — start the dev server, attempt each refusal case
   against the real route, and confirm a `checkinAttempts` document appears in the Firebase
   console for each — or fold this into F12's already-planned human purchase-and-scan proof,
   which already checks for one `checkinAttempts` entry with `outcome: 'admit'` and a second with
   `already-checked-in`; extending that human step to also attempt one deliberately malformed
   scan and confirm a third entry with `outcome: 'malformed'` would close this gap with no new
   machinery. A live-infra-failure case (`'infra-error'`) is harder to trigger by hand and is not
   proposed as part of that human step — a source read at review time remains the check for that
   one branch specifically, same as item 2 below.
2. **That the thin Firestore adapter `@dev` writes (`db.collection(CHECKIN_ATTEMPTS_COLLECTION)
   .add(record)`) genuinely only ever calls `.add()`** and never `.doc(id).set()`/`.update()`/
   `.delete()` anywhere in that adapter. A2/A5 prove the *pure module's* call site is append-only;
   the adapter itself is real Firestore-touching I/O that this contract's hard constraints forbid
   testing against a live project. **@qa confirmed this gap is real, not theoretical, by mutating
   the shipped adapter's `.add(record)` call to `.doc(id).set(record)` — every one of A1-A8 still
   passed.** The append-only guarantee this contract proves is enforced only at the pure-module
   boundary (A2's closed interface, A5's Proxy trap around `recordCheckinAttempt()`'s own call
   site); it is never checked against the one file that actually talks to Firestore, and nothing
   in this gate regresses automatically if a future edit swaps `.add()` for `.set()`/`.update()`
   there. This is architecturally expected given the no-live-Firestore hard constraint — the
   adapter is currently correct — but a reader six months from now should not assume the gate
   would catch a regression here; it would not. A source-level review of that one small adapter
   function (a few lines, by design) at implementation/review time is the appropriate check —
   small and inspectable enough that a source read is proportionate, unlike the multi-branch
   route-wiring gap in (1).
3. **A genuine timing-side-channel measurement of anything in this module.** Nothing in F7 does
   signature comparison (that is F6's `constantTimeEqual`, already out of scope here) — noted only
   for completeness, since F6's README carried the same caveat and a reader comparing the two
   files should not wonder why F7 doesn't repeat it.
4. **That `outcome`-by-type counting queries the mission's Done criteria mention** ("a test
   contract can query the collection and count outcomes by type") work against real Firestore.
   This requires documents to exist in a live collection, which the hard constraints forbid this
   contract from creating. A3's fake-store proof establishes the record *shape* every such query
   would filter on is correct; the query itself is exercised for the first time by whichever human
   step verifies (1) above.

## Note on `syncedAt` and reconciliation, so a future reader doesn't reopen this

`syncedAt` is unconditionally `null` in every record F7 ever writes — not because reconciliation
never matters, but because F7 never runs the offline-queue path at all (§7.2/§7.4 machinery is out
of scope, unbuilt). The field exists now purely so the collection's shape doesn't need a schema
migration the day offline mode ships. Do not read the always-null value in this mission's fixtures
as evidence reconciliation was attempted and is broken — it was never attempted.
