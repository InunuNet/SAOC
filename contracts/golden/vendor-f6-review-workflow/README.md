# F6 (vendor-registration) — vendor application review workflow: decision record

Full source: mission brief inline F6
(`.agent/memory/project/missions/2026-08-17-vendor-registration.md`), reusing F3/F4's
capability system (`lib/admin-roles.ts`, `lib/admin-auth.ts`) and F8's comp-route wiring
pattern (`app/api/admin/tickets/comp/route.ts`) wholesale.

## What this feature is

One new capability (`review-vendor-applications`), one pure closed-machine status-transition
function (`lib/vendor-review.ts`), and three capability-gated admin surfaces: `GET
/api/admin/vendors` (list), `POST /api/admin/vendors/[id]/review` (approve/reject/start-review
action), and an `/admin/vendors` layout gate. No new auth mechanism — every gate reuses
`hasCapability()`/`resolveShowWindowLookup()` exactly as the comp route already does.

## The F8 lesson this contract exists to close

`contracts/golden/ticketing-f8-comp-tickets/README.md`'s "Known gaps" section documents a real
defect class: F8's own contract never proved that `app/api/admin/tickets/comp/route.ts`
actually calls `hasCapability()` at all — deleting the call, or swapping `'issue-comp'` for a
more widely held capability, left F8's full gate green. F6 does not repeat this. A8
(`check-route-wiring.mjs`) uses the same technique `ticketing-show-window-lookup`'s A9
(`check-comp-route-wiring.mjs`) already proved out for the comp route's `lookupShowWindow`
wiring: a source-level discriminator, self-tested against a frozen KNOWN-UNWIRED fixture (must
reject) and this contract's own architect-authored WIRED golden (must accept) *before* it is
ever trusted against the real repository file. Deleting the capability gate, or reverting to a
session-only check (exactly the shape `app/admin/page.tsx` and `app/admin/door/layout.tsx`
already use for lower-stakes surfaces), makes A8 fail loudly.

**Why source-level, when the rest of this contract is behavioural**: proving the real POST
handler enforces the gate at HTTP level, for a genuine authenticated-but-uncapable admin,
requires a live Firebase Auth session — outside this contract's offline/credential-free
constraint (same gap F8's own README documents and defers to its own human-proof step). "Does
the call site actually pass `hasCapability()` a real `lookupShowWindow` and the literal
capability string" is a source-shape property, not a runtime one — exactly like F3's A8
(`check-manager-hand-listed-source.mjs`, "is manager's bundle hand-listed, not derived") and
`ticketing-show-window-lookup`'s A9. A9 in *this* contract (the HTTP fail-closed round trip)
covers the runtime half that source-inspection cannot: that both routes genuinely refuse an
unauthenticated or garbage-cookie request over real HTTP, against the real compiled route.

## Capability naming and role bundles — the judgement call

`review-vendor-applications` is granted to `manager` and `owner`, not `door-staff` — the
mission brief's own recommendation, and consistent with the existing precedent that
`door-staff` is barred from `search-buyers`/`export-buyer-data`: those are back-office/PII
capabilities, and vendor-application review (business names, CIPC/VAT numbers, permit numbers)
is squarely back-office triage, not door operations. `manager`'s bundle is HAND-LISTED (not
`new Set(CAPABILITIES)`), matching F3's own established rule for `manager` — see
`contracts/golden/ticketing-f3-admin-roles/README.md`'s "Contradiction found and resolved" for
why a *derived* `manager` is the wrong default: it would silently auto-grant Lee-Ann's role
every future capability the instant it's added to `CAPABILITIES`, with no review step. `owner`
needs no source edit at all — it is already derived from `CAPABILITIES` and picks up the new
capability automatically, exactly as F3's A6 (`check-owner-derived-from-fixed-set.mjs`)
predicts and this contract's own A3 re-confirms live.

## The F3 regression — verified live, not merely asserted

Adding an 8th capability could, in principle, break three different properties F3's contract
already proved for the original seven: fixed-set coverage, `owner`'s full-set equality, and
`door-staff`'s exact two-member exclusion. Rather than re-derive these from scratch, A4
re-runs F3's own four check scripts completely unchanged against a live, temporarily-patched
`lib/admin-roles.ts` (8 capabilities, `manager`'s hand-listed array extended). Result, run
2026-08-18:

- `check-fixed-set-coverage.mjs` — **FAILS** as written: it hardcodes `if (fixedSet.size !== 7)`
  rather than deriving the expected count. This is a required one-line edit for F6 (bump 7→8),
  not a genuine regression — but it is not free; A4 will stay red until it's made.
- `check-owner-derived-from-fixed-set.mjs` — **PASSES unchanged.** It compares `resolve(['owner'])`
  against the live `CAPABILITIES` import, so it tracks the set automatically.
- `check-door-staff-negative-control.mjs` — **PASSES unchanged.** Same reason — it iterates the
  live `CAPABILITIES` export, not a hardcoded list, so the new capability is automatically
  included in the "must NOT hold this" check and correctly confirms door-staff still excludes
  it.
- `check-manager-hand-listed-source.mjs` — **FAILS** as written: it hardcodes the exact
  7-string `CAPABILITIES` literal it expects to find inside `manager`'s array for source
  comparison. This is the second required one-line edit (append
  `'review-vendor-applications'` to that hardcoded list) — again expected, not a regression.

Both required edits are named explicitly in the contract's F6 feature description and in A4's
own description, so a red A4 that names a length/count mismatch on `CAPABILITIES` or
`manager`'s array is legible as "make this edit," not "F6 broke F3."

## The closed transition machine

Exactly three edges exist: `submitted --start-review--> under-review`, `under-review
--approve--> approved`, `under-review --reject--> rejected`. Every other one of the 12
(status, action) combinations is refused, including the two the brief calls out by name: a
direct `submitted --approve--> approved` shortcut (approval must pass through `under-review`
first — this is deliberately NOT a single-step "submitted → approved" shortcut, even though
the mission brief's own F6 prose could be read either way; the closed-machine framing in the
brief, "submitted→under-review→approved/rejected only," is read literally here as a path, not
an OR of reachable endpoints), and any action at all out of a terminal state (`approved`/
`rejected`). A5 (`check-closed-transition-machine.mjs`) proves all 12 combinations by real
function call, not by enumerating only the 3 happy paths.

## Additive-only patch, not a full document

`decideVendorStatusTransition()` never returns or touches the original 31 submitted fields —
its `ok:true` result is a 3-key patch object (`status`, `reviewedBy`, `reviewedAt`) only. This
is structural, not a promise the route has to keep on its own: the route applies the patch via
Firestore's partial-merge `ref.update(decision.patch)`, never `ref.set(...)` (which would wipe
every field the patch doesn't name). A8's `isAdditiveTransitionWiring` check on the review
route specifically requires `ref.update(decision.patch)` and forbids any `ref.set(` call site
in that file. A6 proves the patch shape and injected-time behaviour (mirroring F8's
`compedBy`/`purchasedAt` pattern) via real function calls: identical explicit `now` values
several ms apart in wall-clock time produce identical `reviewedAt`; different `now` values
produce different ones — proving the function never reads `Date.now()`/`new Date()`
internally.

## Zero-authorization carry-through

`lib/vendor-review.ts` imports neither `lib/admin-auth.ts` nor `lib/admin-roles.ts` — the
transition decision is authorization-blind by construction. A7 extends vendor-f4's own
zero-authorization check (`check-zero-authorization.mjs`) through both review-patch
transitions to `'approved'`, proving a fully-reviewed `VendorSubmission`, JSON round-tripped,
still carries no admin/roles/capability-flavoured key. The capability check lives only in the
three gated route/layout files A8 verifies — never in the data model or the pure transition
function.

## No PII in list-route logs

A10 is a structural source check on `app/api/admin/vendors/route.ts` (not behavioural — that
would require triggering a live Firestore failure against a running server): no `console.log`
call at all, and any `console.error` call must reference only a generic message and
`error.message`, never the submissions array, a Firestore snapshot/docs identifier, or any of
businessName/contactEmail/contactPersonName/contactCellPhone/physicalAddress/cipcNumber/
vatNumber as a real expression. The check strips string-literal message text before scanning
for these identifiers, specifically so an English error message that happens to say "...vendor
submissions..." doesn't false-positive against an actual `submissions` variable reference —
this was caught and fixed during hand-verification (see "Verification" below).

## What this contract does NOT prove

- That a genuine admin session WITHOUT `review-vendor-applications` gets 403 specifically (as
  opposed to 401 for no session at all), or that a genuine manager/owner session succeeds with
  200/201. Both require a live Firebase Auth project — deferred to F10's human-proof step,
  exactly as F8's own README already documents for the comp route.
- Anything about `/admin/vendors/page.tsx`'s visual rendering, table layout, or the
  approve/reject button UX. That file sits inside the gate this contract proves, but its
  acceptance is @qa/human-proof (F10) territory, per the house rule that `agent_review`-shaped
  UI checks are a smell this contract does not introduce.
- Cross-instance or persistent rate-limiting, concurrent-write races on the same submission
  (e.g. two admins reviewing the same document simultaneously), or anything about
  `app/admin/vendors/page.tsx`'s data-fetching strategy (direct Admin SDK read vs. hitting its
  own `GET /api/admin/vendors` — left to dev's judgement, not specified here).
- Whether `manager` is the *only* correct role for this capability, or whether a narrower,
  dedicated "vendor-coordinator" role should exist instead — the mission brief explicitly
  frames the manager/owner choice as a recommendation, and this contract encodes that
  recommendation, not a re-litigation of it.

## Verification

Every check script was syntax-checked (`node --check`, `bash -n`) and then hand-run against a
throwaway reference implementation of `lib/vendor-review.ts` and a temporarily-patched
`lib/admin-roles.ts`/`types/index.ts` (created, verified, then fully reverted — `git status`
confirmed clean before this contract was handed off). Findings from that verification pass,
already folded into the check scripts above:

1. **check-route-wiring.mjs, first draft**: the review-route wired golden's own explanatory
   comment used the phrase "NEVER ref.set(...)" — which contains the literal substring
   `ref.set(`, tripping the discriminator's own negative check and failing its self-test
   against its own golden. Fixed by rewording the comment to avoid the literal substring, not
   by weakening the check.
2. **check-no-pii-in-logs.mjs, first draft**: the list route's own `console.error` message
   text ("Failed to list vendor submissions:") contains the English word "submissions",
   tripping the PII-identifier scan against its own wired golden. Fixed by stripping
   string-literal content from each `console.*` call's argument list before scanning for
   identifier references, so a message *mentioning* "submissions" in prose no longer
   false-positives against an actual `submissions` variable reference.
3. All three defeating-mutation fixtures (unwired list route, unwired review route — which
   also uses `ref.set()` and hand-rolls the transition inline — unwired layout) were confirmed
   to fail A8 when substituted for the real files.
4. A5's closed-machine claim was confirmed to catch a live mutation: temporarily widening
   `submitted`'s allowed-transitions set to include `'approved'` (the exact shortcut named in
   the contract) produced the expected 2 failures, both naming the shortcut by name.
5. A3/A4 were confirmed against a live, temporarily 8-capability `lib/admin-roles.ts`: A3
   passes; of F3's four re-run scripts, two pass unchanged and two fail with the exact
   hardcoded-count messages documented in "The F3 regression" above.
