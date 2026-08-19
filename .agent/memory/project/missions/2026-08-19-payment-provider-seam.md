---
schema: athanor.mission/v1
slug: payment-provider-seam
goal: 'Payment provider seam: define a PaymentProvider interface in lib/payments/ and move
  the inlined PayFast logic behind it, keeping the proven end-to-end sandbox purchase green
  as the regression gate'
created_at: '2026-08-19T19:22:28.516960+00:00'
started_at: null
last_active_at: null
status: pending
cost_estimate:
  features: 4
  milestones: 2
  total_calls: 24
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  status: pending
  title: PaymentProvider interface + PayFast adapter, behind a contract that pins today's
    on-the-wire behaviour
  inline_brief: '@architect first writes the contract and golden files. The goldens must capture
    the CURRENT PayFast behaviour byte-for-byte before any code moves: the exact signature
    base-string construction and parameter ordering, the passphrase-present and passphrase-absent
    paths, the ITN field set, and the amount/merchant/status validation sequence. Sources
    are the inlined logic at app/api/tickets/checkout/route.ts:307-396 and app/api/tickets/itn/route.ts:103-263,
    plus lib/payfast.ts. Only then does @dev define PaymentProvider in lib/payments/ (initiate,
    verifyNotification, mapStatus, refund) and move PayFast behind it as the first adapter.
    The interface is designed against three real gateways -- PayFast now, Ozow (council preference),
    Peach (Brad''s own site) -- all of which are redirect-to-hosted-page plus async webhook,
    so the shape is drawn from three real APIs and not one imagined one. NO behaviour change
    is permitted in this feature: it is a pure move. Any assertion that would pass equally
    against the pre-move and post-move code is worthless here and must be rewritten -- this
    project''s dominant defect class is an assertion satisfiable by something that is not
    the property under test.'
- id: F2
  status: pending
  title: Both API routes call the seam, with no PayFast identifier left in route code
  inline_brief: 'Rewire app/api/tickets/checkout/route.ts and app/api/tickets/itn/route.ts
    to depend only on the PaymentProvider interface. The decisive assertion is structural
    and negative: no PayFast-specific symbol, env var name, URL or field name may appear anywhere
    in the route files -- if one survives, the seam is decorative and the next gateway will
    require touching the routes again, which is the entire thing this mission exists to prevent.
    That assertion must be OBSERVED FAILING against the pre-rewire code before it is trusted.
    Provider selection stays a single config point; do not build a plugin registry, a package,
    or host adapters -- packaging is explicitly deferred (Brad, 2026-08-19).'
- id: F3
  status: pending
  title: Live sandbox purchase still completes end-to-end after the refactor
  inline_brief: 'The regression gate is the flow that was already proven live: browse -> checkout
    -> PayFast sandbox payment -> ITN -> order and position both ''paid'' -> confirmation
    page -> door check-in scan. Re-run it for real via BrowserAgent against the deployed site
    and cross-check Firestore and Cloud Logging; a green contract gate is not sufficient evidence
    on its own and never has been on this subsystem. Record the new booking reference in the
    mission notes. NOTE: the previous mission''s M1 gate currently fails on A7/A9/A10 with
    an empty bookingRef, which is under triage -- if that turns out to be a one-off-live-booking-dependent
    assertion, this feature must not repeat the same mistake: any assertion written here has
    to be re-runnable against a fresh purchase, not tied to a single historical document.'
- id: F4
  status: pending
  title: Codex cross-model review, docs, and the provisional-figures containment note
  inline_brief: Mandatory Codex GPT-5.5 pass via execution/codex_qa.sh on the full diff, after
    @qa and before @docs -- no exceptions (Brad's standing instruction). Then @docs writes
    docs/payment-seam.md covering the interface, what an adapter must implement, and exactly
    what a second gateway would have to do. It must also record that .agent/memory/project/provisional-figures.md
    holds web-team ESTIMATES for prices, capacities and child age bands pending Lee-Ann's
    questionnaire, and that those figures are contained to a single source of truth with a
    provisional flag -- this project has twice been damaged by invented values spreading unflagged
    (CTICC venue, 18-21 September dates).
milestones:
- id: M1
  title: Seam exists and both routes use it
  features:
  - F1
  - F2
  status: pending
- id: M2
  title: Proven live and reviewed
  features:
  - F3
  - F4
  status: pending
---

# Mission: Payment provider seam

## Context

First stage of the approved plan `Plans/valiant-squishing-thimble.md`. Deliberately standalone and
first, before any multi-line-cart work: the end-to-end sandbox purchase already proven live is the
regression net for this refactor, and bundling the seam into the cart rewrite would leave any
regression with two candidate causes. One change at a time is the whole point.

Three gateways are in prospect -- PayFast (SAOC now), Ozow (the council's stated preference), Peach
(Brad's own site and a separate shop project). All three are redirect-to-hosted-page plus async
webhook. The interface is therefore drawn against three real APIs. This is NOT packaging: no
workspace package, no host adapters, no content-repository abstraction. Packaging is deferred until
SAOC works (Brad, 2026-08-19, on timeline grounds).

## Not blocked on the council

Lee-Ann's pricing questionnaire is out but unanswered, and we are not waiting on it. Provisional
prices, capacities and child age bands are recorded in `.agent/memory/project/provisional-figures.md`
-- prices are her own pencilled-in figures, capacities and age bands are web-team estimates. They
are NOT needed for this mission (the seam is gateway plumbing, not pricing) and are recorded now so
the admission-products stage can start without another wait.

Containment matters more than the estimates themselves. Two prior placeholder incidents (the CTICC
venue, the 18-21 September 2027 dates) each began as one reasonable assumption and ended up in seed
scripts, golden files, live Sanity content and a public countdown, presented as confirmed. Every
provisional value gets one home in code and a machine-readable flag.

## Standing constraints

- Full chain per `.claude/rules/workflow.md`: @architect (contract + goldens) -> @dev -> @qa ->
  Codex GPT-5.5 -> @docs -> gate -> @maintainer. The orchestrator dispatches and never implements,
  reviews or deploys directly.
- No contract.yaml and no golden files means no @dev dispatch.
- New assertions must be observed FAILING against unfixed code before the fix is written.
- Any UI-visible change is verified in a real browser at 1440 / 375 / 320px, not by reading class
  names back.
- Deploy authorisation for the App Hosting dev site is standing; do not stop to ask.

## Notes

- Prior mission `prove-ticket-purchase-works-end-to-end-b` is PAUSED, not abandoned. Its four
  features are done and the flow was proven live, but its M1 gate now fails on A7/A9/A10 with an
  empty bookingRef. Triage is in flight to establish whether that is a stale one-off-booking-
  dependent assertion or a real regression. Resolve and close it out before this mission's own
  close-out.
- Live site: https://saoc-prod--saoc-webapp.europe-west4.hosted.app

## RESUME HERE — checkpoint 2026-08-19 ~20:40 SAST (quota stop)

**F1: DONE.** `lib/payments/{types,payfast,index}.ts`. @qa applied 14 mutations, killed 13; no
behaviour difference from the pre-move code. Independent Codex pass found nothing but the known
A8 harness contradiction. F1 gate 11/11 except A10, which is an F1-window assertion correctly
superseded by F2's A3.

**F2: code landed, gate FAIL. Four fixes queued, contract amendment needed FIRST (no contract →
no @dev).** Both routes now depend only on the seam; A1 (the decisive symbol ban) is green; the
two-step re-pin ceremony is done and all four downstream repoints verified by running them in
their new form.

### The four queued fixes, in priority order

1. **SEV-1 — A4 is satisfiable by a trailing comment.**
   `contracts/checks/payment-seam-f2/check-sequence-and-ownership.sh:47-56` — `first_code()`
   skips only lines whose LEADING non-whitespace is a comment marker. @qa proved three mutations
   against real source: delete the whole `RECOVERY_TOKEN_SECRET` guard leaving a trailing comment
   → green; move the real env read AFTER the write leaving a trailing comment → green (so part 4
   never asserted position at all); replace the amount comparison with
   `false // AMOUNT_MATCH_TOLERANCE comparison removed` → green. **The guard stopping someone
   paying R1 for an R250 ticket can be deleted with the gate green.** Fix: strip trailing `//...`
   before matching, AND add those three as standing regression mutations — a hardening that is
   not itself mutation-tested is how this class returned.

2. **Real regression: checkout now reserves BEFORE refusing on unset gateway credentials.**
   Pre-F2 it refused first. `contracts/golden/payment-seam-f1/fail-closed-guards.golden.md` pins
   that guard's position as "Before reserveTicket(), i.e. before any Firestore write". Ruled a
   real defect, not @dev's to absorb: F2's contract is wrong. Fix is a SIXTH interface member —
   a gateway-neutral `isConfigured()`-style probe called before reserving, so the route never
   reads gateway env. Rationale: the seam exists to make a gateway swap cheap, so unexercised
   credentials are the LIKELIEST failure mode, and it lands while tickets are selling.
   @dev's three implementation notes, all accepted:
   - Touches five F1 artefacts: `interface.golden.md`, `fixtures/payment-seam-typecheck.ts`
     (A11 compiles against the member list), the A8 neutrality ban (probe name and result type
     must carry no gateway vocabulary — `isConfigured` is clean, `'missing-merchant-key'` is not),
     `types.ts`, `payfast.ts`. F1's contract says five members "do not simplify to four" — that
     line must be amended too or the two contracts contradict each other.
   - The probe needs its OWN fail-closed direction pinned in the golden: throw, or an adapter
     that forgets to implement it, must mean "not configured, refuse" — not "assume fine".
     Otherwise the fix reintroduces the failure one layer up.
   - A4 part 2 needs a new landmark: the GATEWAY refusal must also precede the write, asserted
     by position. Its absence is exactly what let this through.

3. **Remove A18 (`check-itn-source-ip-validation.mts`) from A6's suite as part of F2.**
   Proven pre-existing by three independent measurements (blob `8b8a3f71...` = `a71f9505...`,
   driven via `ITN_ROUTE_IMPORT_OVERRIDE`, divergent log lines as the control). Cause: `8476c56`
   (2026-08-18) made source IP logged-not-enforced. @qa went further: across 5 green runs pre-
   and post-F2, EVERY pass logged `order-not-found` — it passed because the write failed, never
   because the IP gate rejected. **5/5 greens spurious; it has never once passed for its stated
   reason.** Not repairable by fixing flakiness. Restating it in `contract-payfast-m1` is its own
   separate pass; replacement property is F1's: `sourceIpTrusted` is advisory, may never flip
   `verified`.

4. **Fix the A6 fixture flake before F3.** `markOrderAndPositionPaidByPaymentId`
   (`lib/orders.ts:274`) re-queries `orders.where('m_payment_id',...)` milliseconds after
   `findReservedOrderByPaymentId` (`:223`) found the same doc; against a fresh fixture the second
   query intermittently returns empty. One flake, two polarities — A18 passes spuriously, A19/A21
   fail spuriously. Settle or retry after `createOrderAndPosition`. **F3's live purchase must not
   run against a nondeterministic suite.**

Also ruled: ban `ProviderNotification.raw` from ROUTE files (adapter may use it freely). @qa got
A1 green with `notification.raw['custom_str1']` — `.raw` is an unrestricted map of the gateway's
own wire fields exposed by the interface itself, so a route can be fully gateway-coupled without
writing one banned token. Neither route uses it today: latent, not live, but it is the door A1
exists to close. The three string-concatenation walk-arounds are contrived; not chasing them.
Also: soften the contract's "hard-counted" exception claim or actually count E1/E2 — only E3 is
counted today.

### Three DEFERRED assertions need POST-COMMIT re-verification
`check-timeout-enforcement` A7, `payfast-m1-lock-cleanup-fix` A0-ITN-UNTOUCHED,
`payfast-m1-residue-cleanup` A12 — `git diff --quiet` worktree guards, red for the whole of any
uncommitted feature, green only after commit. Reported as NOT-PROVEN, not passed.

### F3 has NOT run. Do not treat F2 as behaviourally proven.
A6 is the strongest behavioural evidence short of a live purchase, and it is currently a coin
toss in both directions with one member asserting a property that is false by design.

## Standing scope note for the post-F3 drift-detector mission
Discovery must follow the ARTEFACT, not the file path. `discover_route_pins.py` walks the route;
the seam moved gateway internals to the adapter and three assertions (`payfast-itn-signature`
A5/A6, `payfast-m1` A17) left discovery's view entirely. They pass — run directly — but nothing
walks the adapter. Same shape as the A33 miss: A33 was missed because a list enumerated pin
FORMS; this would be missed because discovery enumerates a PATH.

## LATE ADDITION — @qa's second pass (same checkpoint, arrived after the above)

**5. The A18 differential was a coin flip. Conclusion right, method unsound — do not reuse it.**
@qa observed A18 **green twice** on the pre-F2 baseline; @architect observed it red once. The
check is nondeterministic on BOTH versions. So the inference "identical failure on pre-rewire
code => pre-existing" rested on a single run of a coin toss: had it drawn @qa's greens, the same
method would have concluded the opposite — "green on baseline, red on F2 => regression". **A
differential across a nondeterministic check establishes nothing, whichever way it lands.**
What actually carries the conclusion is the DETERMINISTIC probe: pre-F2 route + bogus IP
203.0.113.1 + a 5s settle to suppress the flake -> `status = 'paid'`. The pre-rewire route
already paid out on a bogus source IP. Retire A18 because it asserts a property deliberately
removed on 2026-08-18 — NOT because it was red before F2.
Corroborated independently: `3b7e997` (A18's last touch) 2026-08-18 19:25:07 SAST vs `8476c56`
(source-IP -> log-only) 21:35:54 SAST — the check was last updated 2h10m BEFORE the change that
invalidated it. `ITN_ROUTE_IMPORT_OVERRIDE` verified pre-existing and untouched by F2
(`_itn-harness.mts:111-129`); the differential control also reproduced from a detached git
worktree, a mechanism with no shared failure mode with the override.

**6. NEW BLOCKER — signature verification has ZERO behavioural coverage.**
`signAndEncode` (`_itn-harness.mts:179-183`) always signs correctly with the real passphrase.
None of A6's four checks drives a bad signature, an absent signature, or an unset shared secret.
Verification is the single largest thing F2 moved wholesale into the adapter, and **every one of
its rejection paths is untested end-to-end.** Before F2 can be called a behaviour-preserving
rewire, add a behavioural check driving a FAILED `verifyNotification` (wrong / absent signature,
unset secret) asserting the order is untouched and the response is 200. Also behaviourally
uncovered: the `not-configured` acknowledge-without-500 branch, malformed/empty bodies, missing
reference, and `mapStatus` for failed/cancelled/unknown.
**One point in F2's favour, not yet claimed anywhere:** the harness signs with `generateSignature`
from the LEGACY `@/lib/payfast`, and the rewired route, verifying through the adapter, accepts
those bodies — so adapter/legacy agreement on the ACCEPT path is real and proven. It is the
REJECT path that is dark.

**Stale in @qa's report:** it lists the four repoints as undone and A2/A3/A5 red. That run
predates @dev landing them; @architect and @dev each verified all four green by running them in
their new form. The A1-vs-A17 `signature` collision is RULED — A17 repoints to the adapter, A1
stays strict, collision recorded in F2's golden README.

## F2 CONTRACT AMENDED — @dev's next action is to implement A8/A9 (arrived at the quota stop)

**Fix 2 (fail-closed ordering) is contracted and ready. Both new assertions OBSERVED FAILING.**
Do not re-derive any of this; it is done.

### The sixth member is `readiness(operation)`, NOT `isConfigured()`

    export type ProviderOperation = 'initiate' | 'verify-notification';
    export type ProviderReadiness =
      | { readonly ready: true }
      | { readonly ready: false; readonly reason: 'not-configured';
          readonly missing: readonly string[] };
    readiness(operation: ProviderOperation): ProviderReadiness;  // synchronous, offline, per-call

**Why per-operation, and this is load-bearing:** PayFast needs merchant credentials to initiate
but a PASSPHRASE to verify a notification — the asymmetry F1 documented and F2 must preserve. A
global `isConfigured()` either demands a passphrase at checkout, refusing purchases that succeed
today (a behaviour change smuggled in under a fix), or omits it and lets the ITN path claim a
readiness it does not have. Ozow (site code / keys) and Peach (entity id / bearer token) split
the same way, so the parameter is interface design, not a PayFast accommodation. `refund` is
deliberately OUT of the operation union — it is still a declared-unsupported stub and inventing
readiness semantics for an unimplemented operation would be guessing. `missing: string[]` rather
than a bare boolean so the log line says WHY without a debugger.

**The post-`initiate` refusal STAYS.** Config is read per call by design, so it can genuinely
change between probe and initiate; removing the later refusal trades one hole for another. A9
asserts it survives.

### The two new assertions, and what makes each fail
- **A8** case 3 takes ONE instance, mutates env, requires the verdict to flip — kills both a
  hardcoded return and a config snapshotted at construction. Case 2 pins the asymmetry both
  ways. Case 5 requires it to be SYNCHRONOUS with zero network calls: it sits in front of every
  checkout, and a promise a caller forgets to await is always truthy, so it fails open.
- **A9** asserts relative source POSITION only, comments excluded, so prose about readiness
  cannot satisfy a claim about execution order.
- Observed failing first: `A8 case 0: PaymentProvider has no readiness() member.` /
  `A9: checkout never calls readiness(). With credentials unset it will reserve a seat and
  refuse afterwards, leaving an order nobody can pay for holding capacity until its TTL
  expires.` Defect confirmed independently: `reserveTicket(` at line 329, refusal at 406.

### Also landed at the same time
- **The awk swallow is fixed and was worse than a bug:** `2>/dev/null` made an invalid dynamic
  regex (awk exits 2 with a message) indistinguishable from a genuine absence. Any awk failure
  is now FATAL in both A4 and A9. Third instance of the transforming-instrument class in the
  same agent's own tooling — whitespace-normalising runner, digest-vs-whole-file probe, this.
- **The orphan expected-file is deleted — but it had FOUR dangling references** (ticketing-
  hardening's `goldens:` list and A15's prose, ticketing-f10's ceremony-precedent prose, and
  `itn-write-guard.golden.md`). All four repointed at `payment-seam-f2/itn-route.expected.ts.txt`
  with a dated note recording that three expected files had accumulated for one route and the
  plurality WAS the defect. Zero dangling refs; A15 and A33 both still green. **Deleting it
  without repairing the references would have been worse than leaving it.**

### F2 gate at the stop
A1–A5b green. **A8/A9 red as intended.** A6 needs the live run (and the `lib/orders.ts:274`
fixture race fixed first). A7 hygiene green.

### Remaining order of work next window
1. @dev implements A8/A9 (contract is ready — this is unblocked).
2. A4 trailing-comment hardening + P1/P3/Q1 as standing mutations.
3. Remove A18 from A6's suite; fix the fixture race.
4. Add the dark-reject-path behavioural check (bad/absent signature, unset secret).
5. Then and only then F3's live purchase, then F4 Codex + docs, then commit and re-verify the
   three DEFERRED worktree guards post-commit.

## F2 ITEM 1 LANDED — `readiness(operation)` implemented (2026-08-19, post-quota-reset)

`lib/payments/{types,index,payfast}.ts` + `app/api/tickets/checkout/route.ts`. Probe at line 319,
BEFORE `reserveTicket()` at 354, in the pre-F2 guard's original slot. Byte-exact pinned refusal.
Per-operation required keys, so the checkout/ITN asymmetry survives. `requiredKeysFor()`'s
unreachable `default` returns a requirement no environment can satisfy — an unrecognised
operation is always NOT ready. Probe call wrapped so a throwing adapter means refuse. Post-
`initiate` refusal untouched (defence-in-depth).

**F2 gate: A1–A5b, A7, A8, A9 all exit 0.** A8/A9 observed failing first. A6 NOT RUN — needs live
Firestore and the `lib/orders.ts:274` race is still open; a coin-toss result must not enter the
record as evidence. F1 re-run green except A10, the documented F1-window assertion superseded by
F2's A3.

### Dispatched to @architect (four items @dev correctly refused to touch)
1. **SEV-1: A9 has the hole A4 was just hardened against.** `check-readiness-precedes-write.sh:47-56`
   uses the old awk `first_code()`. M1: fake the probe with a trailing comment + a real probe after
   the write -> A9 GREEN. M2: call `readiness('initiate');` and DISCARD the verdict, no branch, no
   refusal -> A9 GREEN. **A9 asserts the position of a call, never that its result is used** — a
   probe whose answer is thrown away is indistinguishable from no probe. Route through
   `code_lines.py`; assert the verdict gates the refusal; add both as standing mutations.
2. **`check-ordering-mutations.sh` is wired into NO contract.** Green, calls itself A10, and
   `grep -rn check-ordering-mutations contracts/*.yaml` returns nothing. The A4 hardening's own
   regression net is outside the gate.
3. **F1 contract line 38 still says five members**; `interface.golden.md` says six with `readiness`
   first. Two authoritative docs disagreeing on the interface surface.
4. **A11's typecheck fixture never mentions `readiness`** — arity, the operation union, and the
   `ready` discriminant narrowing are unasserted at type level. A8 covers behaviour, nothing
   covers shape.
5. Minor: A4's `first_code()` wraps `code_lines.py` in `2>/dev/null || true` — fails safe, but
   prints a wrong reason ("step X absent"), sending the next reader after a defect that isn't there.

### Model policy corrected 2026-08-19
Opus: analyst/architect/qa. Sonnet: dev/docs/maintainer. Set in `.claude/agents/*.md` frontmatter.
**Never pass `model` on the Agent tool** — it overrides the definition, which is how five agent
types ran on Opus for a whole session.

## Duplicate-architect near-miss (2026-08-19 23:36 SAST)

After the quota reset I called `ListAgents`, saw only peer sessions, and concluded the
@architect dispatched pre-compaction had died. **`ListAgents` does not surface in-process
subagents** — its silence was never evidence. The original was alive the whole time; I
re-dispatched a second @architect onto the same five items.

The second instance detected the collision itself (mtimes minutes old, one file changing
mid-run and printing 11 spurious "step absent" failures because it was read half-written)
and stopped before writing. Had it not, two agents would have interleaved edits into the
same check scripts, leaving a file that is neither version while the gate reports green off
whichever half won — corrupting the very checks that are the gate.

Scope now fenced: original owns items 1/2/5 (all of `contracts/checks/payment-seam-f2/`);
second owns items 3/4 (F1 contract line 38, A11 typecheck fixture). One overlap already
occurred in `code_lines.py` (second added an exit-3 instrument-failure path to `--first`;
additive, consistent with the A4-side fix).

**Outstanding debt, gating F2:** none of the new A9 work has been observed failing.
`readiness_gate.py` looks right by reading — the exact evidence this project has ruled
insufficient, and how A18 sat green for a deleted property. M1/M2 and R1/R2/R3/R5 must be
run red-then-green with recorded exit codes before F2 closes.

Lessons: (1) absence from a listing is not proof of death — verify liveness by artefact
(mtimes) before re-dispatching; (2) a half-written file read by another agent produces
spurious failures that look like real defects.

## M3 — a new disguise for the dominant defect class (2026-08-19 23:43 SAST)

Verifying architect kept the probe AND the `if (!gatewayReadiness.ready)` branch, but emptied
the branch body to a bare `console.error`. The route's NEIGHBOURING `RECOVERY_TOKEN_SECRET`
guard supplies a `status: 500` inside the same window, so any window-wide "is there a 500 here"
search calls the gutted branch GREEN.

This is not a weak pattern. It is a *correct* pattern whose evidence is satisfiable by an
unrelated adjacent line. Scoping link 4 to the brace-counted branch body is therefore
load-bearing, not decorative. **Generalisation: proximity is not attribution — an assertion
that finds its evidence "in the window" must bind that evidence to the construct under test.**

Measured differential (old awk check reconstructed verbatim to obtain the left column):
M1 (fabricated ready + trailing comment, real probe after the write): OLD exit 0, NEW exit 1.
M2 (verdict discarded): OLD exit 0, NEW exit 1. M3: NEW exit 1.

Two self-caught invalid tests worth remembering:
- Instrument-failure test appended AFTER `sys.exit(main())` — nothing broke, A4 passed, test vacuous.
- Stability envelope where `md5` errored identically before and after, so "STABLE" proved nothing.
  Second live instance of identical-output-means-blind-detector.

## F2 items 1-5 CLOSED (2026-08-19 23:44 SAST). Gate A1-A5b, A7-A10 green; A6 still live-only.

A9 rebuilt as an 8-link chain in `contracts/checks/payment-seam-f2/readiness_gate.py` (probe
precedes write -> verdict captured -> right operation -> tested not-ready -> that branch's own
body returns the pinned 500 -> catch leaves it unready -> route may not mint `ready: true` ->
post-initiate refusal survives). A10 wired at `contract-payment-seam-f2.yaml:287`, nine
mutations, self-verified BOTH ways (always-green A9 stub -> 4 failures; unrunnable A9 -> control
trips) and refuses to run when a mutation target line is unlocatable rather than reporting nine
clean detections on unmutated copies.

**Hole B — the finding of the run.** The operation was never pinned:
`readiness('verify-notification')` at checkout passed A9. That demands a passphrase checkout
does not need and would refuse purchases that succeed today — the exact behaviour change the
per-operation parameter exists to prevent. **The check asserted that A question is asked, never
that the RIGHT one is.** Wired as R7. Companion to M3/R6 (hole A), which both architects found
independently.

Also fixed: `first_code()` did `echo…; exit 1` INSIDE `$( )`, so on instrument failure the
diagnostic BECAME the captured value. Three further stale "five members" claims in F1 goldens.

### Constraints A9 now imposes on future route code (deliberate, but not free)
- operation must be a string LITERAL at the call site
- `ready: true` is banned across the whole checkout route, not just near the probe

### Still open
A18 removal + suite sweep, dark reject-path check, `lib/orders.ts:274` race (@dev, spec pending),
F3 live purchase, F4 Codex+docs, commit, re-verify 3 DEFERRED worktree guards post-commit.
F1's A10 stays red — pre-existing, superseded by F2's A3.

## A18 removed + dark reject-path landed (2026-08-19 23:50 SAST). F2 gate 13/13.

A18 gone from `check-itn-behaviour-unchanged.sh`; suite hard-counted `EXPECTED_SUITE_SIZE=3` so a
silent re-add or further removal goes red. Removal note records STALE-not-inconvenient plus the
four downstream contracts that still touch the file.

**The sweep found a SECOND dead assertion, same shape as A18.**
`check-itn-atomic-idempotent-write` (A30/A31) scenario 1 compares `position.pf_payment_id` on both
sides. F10 moved payment identity to `order.gatewayPaymentId`; nothing writes that position field
and `buildReservationDocs` initialises it to `null`. **Both sides are null every run whatever the
transaction does — unfalsifiable.** Proved by driving the real `markOrderAndPositionPaidByPaymentId`
through an in-memory `deps.db`, not by reasoning. NOT repaired here: belongs to
`contract-payfast-m1`, its own pass. Its two sibling assertions still bind — the block is not
vacuous, one of three assertions is. **Two dead assertions found in one suite means the sweep must
extend to every suite, not just this one.**

New: A11 `check-reject-paths-behavioural.mts` (bad sig / absent sig / unset secret, behaviour not
shape, offline+CI-safe) and A12 `check-reject-path-mutations.sh` — 5 mutants generated at RUN TIME
from real source into gitignored scratch, 5/5 killed, self-verified both ways. **Case 4 is a
load-bearing positive control**: an adapter refusing everything would pass cases 1-3 with three
confident greens — the A18 failure mode exactly.

### A6 ran live and returned exit 0 — NOT recorded as a pass
All four credentials are in `.env.local` so A6 did not skip. One draw from a check already ruled
nondeterministic in both directions, with the race still open. A6 still owes F3.

### Still open
`lib/orders.ts:274` race (@dev running, spec at
`.agent/memory/project/specs/payment-provider-seam/orders-query-race-spec.md`; mechanism is
INFERRED and must be measured first; R2 must be seen red or the diagnosis is wrong), A30/A31 repair
under contract-payfast-m1, F3 live purchase, F4 Codex+docs, commit, 3 DEFERRED worktree guards.
Still dark in A11's own words: malformed/empty bodies, missing reference, mapStatus for
failed/cancelled/unknown, the not-configured acknowledge-without-500 branch.

## Query-race fix landed (2026-08-20 00:05 SAST) — but the MECHANISM WAS DISPROVEN

@dev implemented C+A+D. `lib/orders.ts:205-236` (reserved arm carries `orderId`), `:238-336`
(resolve by `orders.doc(orderId)`, skip the second query; new `'order-vanished'` returned ONLY
from the in-transaction `!orderDoc.exists` branch), `app/api/tickets/itn/route.ts:194-201`,
harness `waitUntilQueryable()` polling both queries to 5s and throwing `PRECONDITION:` on timeout.

**MEASUREMENT FIRST, and it came back negative.** Real sentinel order written to real Firestore,
re-queried at 0/50/100/250/500/1000/2000/5000ms x 5 runs: **zero misses in 40/40 samples,
including at 0ms.** Index freshness on a just-written doc **did not reproduce at all**. The fix
is still right — it deletes a redundant read — but **the true cause of the five spurious greens
is UNKNOWN.** Leading hypothesis is now concurrent load on the collection (several agents were
live-editing this repo all evening). **Do not let a future reader read "flake stopped" as "cause
found."** If it recurs, the diagnosis in the spec is not the place to start.

**Evidence caveat:** R2's red-then-green used a HAND-RECONSTRUCTED pre-fix copy, verified
byte-identical on the touched region, not an actual git revert. Weaker than a real revert. Stands,
but noted.

### D broke a typecheck that the root gate cannot see
`contracts/checks/ticketing-f10-itn-repin/fixtures/itn-repin-typecheck.ts:94` hardcodes the
pre-D union and no longer compiles. It has its OWN scoped tsconfig, **excluded from root
`pnpm type-check`** — so the gate stayed green over a real breakage. Confirmed directly by
orchestrator. Handed to @architect along with wiring R1-R4 into a contract (third check found
outside the gate this mission).

## CODEX FOUND A REAL DEFECT OUR CHAIN PASSED (2026-08-20 00:20 SAST)

`lib/orders.ts:293` — with `input.orderId` supplied, the function resolves by ref and **never
revalidates inside the transaction that the loaded order's `m_payment_id` matches
`input.m_payment_id`.** A stale or wrong `orderId` marks an unrelated reserved order and its
position PAID.

**This passed:** two Opus architects, a nine-mutation harness, a five-mutant reject-path harness,
and a 14/14 F2 gate. `lib/payments/payfast.ts` came back PASS in the same run, so this is not
Codex flagging everything.

**Root cause is the mission's own defect class, in production code this time.** The race spec
called query 2 "redundant". It was not: it located the document AND validated that the document
belonged to this notification's `m_payment_id`. We deleted it for the first reason without
noticing the second. Today `orderId` always originates from query 1 so the values agree — the
invariant is simply no longer enforced.

**GENERALISATION: before deleting a "redundant" read, enumerate every invariant it enforces as a
side effect. A duplicate lookup is often the only identity check in the path.**

Also: Codex could not review the full diff — `git diff | execution/codex_qa.sh` died with
`timeout: Argument list too long` at 11,414 insertions / 82 files. **Per-file review is the only
working mode at this diff size**; a whole-diff invocation FAILS LOUDLY (exit 126) rather than
silently reviewing nothing, but a future reader must not assume the diff was covered. Only
`lib/orders.ts` and `lib/payments/payfast.ts` have been reviewed so far.

Handed to @architect: verify independently, observe the hole RED via `deps.db` fakes, spec the
in-transaction identity check for @dev, enumerate union consumers (scoped typechecks invisible to
root `pnpm type-check`).

## Codex finding #2 + a residual instrument hole (2026-08-20 00:25 SAST)

**Defect 2 (real): the amount guard is floating-point.** `app/api/tickets/itn/route.ts:144`.
`Math.abs(Number('0.02') - 0.03)` === `0.009999999999999998` < `AMOUNT_MATCH_TOLERANCE` (0.01),
so **a one-cent underpayment passes the check written to reject exactly that.** This is the guard
between us and accepting less money than the order is for. @dev fixing via integer cents (and
must prove the accepting pair before fixing; `Math.round(Number(x)*100)` still round-trips a
float).

**Defect 1 confirmed red.** @architect independently verified the missing in-transaction identity
check and added R5 to `check-orders-query-race-regression.mts`, wired as A14. Observed:
`FAIL R5: expected no commit when orderId's order.m_payment_id !== input.m_payment_id, got
committed=true`, exit 1. R1-R4 unaffected.

### Residual hole: instrument failure that exits 1 is STILL read as absence
Codex ran `check-sequence-and-ownership.sh` inside its read-only sandbox and got **nine confident
"step … is absent" failures**, including "checkout/route.ts no longer reads
RECOVERY_TOKEN_SECRET". Orchestrator verified directly: A4 exits 0 in the real environment,
`RECOVERY_TOKEN_SECRET` appears 2x in checkout/route.ts and the ITN symbols 9x. **The greens are
real; the sandbox failures were false.**

But the mechanism matters: tonight's hardening makes an instrument fault exit **3** and say so.
It therefore only catches faults that exit 3. **Any instrument failure that exits 1 is
indistinguishable from a genuine absence by construction** — precisely the hole we believed
closed. A constrained environment (read-only fs, missing python3, different cwd) reproduces it.
Fix direction: absence should require positive proof the file was read and parsed, not merely a
non-zero exit code.

**Also: never run this project's checks inside Codex's sandbox and believe the result.**

## Both Codex defects CLOSED (2026-08-20 00:40 SAST) — verified by orchestrator, not taken on report

Identity guard: `lib/orders.ts:259` (5th reason `'order-payment-id-mismatch'`), `:330` (checked
INSIDE the transaction, after `!exists`, BEFORE the status check — so a mismatched-identity order
cannot be misdiagnosed as "already settled"). Distinct operator log at `itn/route.ts:230-241`.

Integer cents: `itn/route.ts:34` `AMOUNT_MATCH_TOLERANCE_CENTS = 1`, `:46` `parseAmountToCents`
(pure string parsing, regex `^(\d+)(?:\.(\d{1,2}))?$` — deliberately NO `Number(x)*100` round
trip), `:172` integer comparison. **Reproduction proved before fixing:** orderAmount 0.03 vs
gateway `'0.02'` -> old expression accepted a genuine 1-cent underpayment.

Orchestrator-verified directly: R1-R5 exit 0, scoped `tsc -p
contracts/checks/ticketing-f10-itn-repin/tsconfig.typecheck.json` exit 0.

### Consequence @dev flagged rather than papered over
`check-itn-amount-tamper-rejected.mts` (A20) has a **BOUNDARY-ACCEPT case that now encodes the
bug as the expected behaviour**: `amount_gross='0.0099'` vs reserved 0, expecting `paid`, on the
old float reasoning "a diff just under 0.01 is accepted". Under integer cents there is no
sub-cent unit in ZAR and `parseAmountToCents` returns null for 3+ fraction digits. **@dev
correctly refused to edit an assertion to match its own change** — handed to @architect with the
A18 discipline (record that the PROPERTY changed, not that the check was failing).

### Also outstanding
4x `itn-route.golden.sha256` (f1-show-collision, f10-itn-repin, hardening, m1-m2) pin one route
and were ALREADY stale before tonight. Re-pin via the two-step ceremony; confirm current content
is what we intend to pin, or the re-pin launders an unintended change into the baseline.
Docs still name the old `AMOUNT_MATCH_TOLERANCE` (docs/payment-seam.md, payfast-integration.md,
golden/payment-seam-f1/*) — @docs.

## F2 GATE 13/2 (2026-08-20 00:55 SAST) — A1 RED, and it caught something real

Full gate: 13 pass, 2 fail. A6 = live Firestore, known. **A1 was green earlier tonight and went
red from the amount fix.**

```
FAIL A1: gateway-specific vocabulary in itn/route.ts:43 (PayFast always sends `amount_gross`…)
FAIL A1: m_payment_id appears 2 times; exception E3 permits exactly 1
```

**Line 227's hit is a comment and is probably cosmetic. Line 43's is not.**
`parseAmountToCents`'s regex `^(\d+)(?:\.(\d{1,2}))?$` hard-codes a **two-fraction-digit
PayFast wire-format assumption into route code** — the exact coupling the seam exists to remove.
The comment did not create it, it documented it. **A1 is doing its job.**

Genuine tension for @architect to rule on, NOT to paper over: A4 deliberately keeps the amount
CHECK in the route ("a provider that decided whether an amount was acceptable would be deciding
on our behalf"). Parsing a wire format != judging a value. Either the adapter normalises the
amount to gateway-neutral integer cents (route compares two integers it did not parse), or the
parser stays and A1 gets a REASONED, DOCUMENTED exception. **Rewording the comment so the grep
stops matching while the coupling stays is the one unacceptable answer.**

Constraints that must survive: 1-cent underpayment stays rejected; no `Number(x)*100` round trip;
unparseable fails closed; A20's SUBCENT-REJECT still holds.

### Note for the comment-handling record
Tonight now contains BOTH failure directions: a trailing comment falsely SATISFYING a check
(A4/A9, fixed by routing through `code_lines.py`) and now a comment BREAKING one (A1, which
scans raw text). Whether A1 should read comments is a real question — a gateway name in a route
comment is arguably still leaked knowledge — but the inconsistency between checks should be
deliberate, not accidental.

### Golden re-pins done, and a FIFTH pin was found
`discover_route_pins.py` surfaced 5 pins on itn/route.ts, not 4: the 4 SHA256 goldens plus a DIFF
pin (ticketing-hardening A33) against `golden/payment-seam-f2/itn-route.expected.ts.txt` — **the
same expected file the re-pin ceremony derives its own NEW_SHA from.** Re-pinning the 4 alone
would have broken A33 AND the ceremony that validates re-pins. All 5 updated to
`9ff2ea51…`; A8/A8/A15/A53 `shasum -c` exit 0, A33 `diff` exit 0, ceremony exit 0.
A sixth orphan copy survives at `golden/ticketing-f10-itn-repin/itn-route.expected.ts.txt`
(prose refs only) — consolidation deferred.

A20 rewritten as SUBCENT-REJECT and proven by a REAL differential: pre-fix route restored via
`git show HEAD:` -> exit 1; fixed route -> exit 0; restoration confirmed byte-identical.

## A1 RULING (2026-08-20 01:05 SAST) — amount parsing moves to the adapter

**The line:** parsing a gateway's decimal-string convention into integer cents is FORMAT
TRANSLATION — the same category as `mapStatus` translating status vocabulary — and belongs in the
adapter. Judging whether the resulting number is acceptably close to what we are owed is a
DECISION ABOUT OUR MONEY and stays in the route where A4 put it. **Computing cents is not
deciding acceptability**, so F1's "the provider never decides whether an amount is acceptable" is
preserved, not weakened.

**Alternative rejected on record:** documenting the 2-decimal shape as an interface-wide
guarantee (parser stays in route, cites the interface instead of PayFast). Rejected because the
Ozow and Peach adapters DO NOT EXIST YET — asserting they share PayFast's wire shape would smuggle
an unconfirmed value into the seam. **Same defect class as the CTICC venue and the invented
18-21 September dates.**

Line 227 ruled cosmetic and separately: `m_payment_id` is OUR Firestore field name, not gateway
vocabulary; E3's hard count still bounds the CODE occurrence at exactly one.

### I was wrong about the comment "inconsistency"
A1 greps RAW TEXT deliberately — its claim is about what the file SAYS, and a gateway name in a
comment is leaked knowledge either way. A4 strips comments via `code_lines.py` because its claim
is about ORDER OF EXECUTION, where a trailing comment can lie about position. **Different
properties, correctly different scan surfaces — and `golden/payment-seam-f2/README.md` already
documented this as deliberate before I called it an accident.** Check the goldens before
declaring two checks inconsistent.

New A15 `check-amount-normalized-in-adapter.sh` — fails if the route defines its own parser (by
name OR by a fraction-digit-counting regex), fails if the route never reads `grossAmountCents`,
and fails as a NON-VACUITY control if no parser exists in `payfast.ts` either. Observed red
against current code, exit 1, all three sub-checks firing. `ProviderNotification` gains a seventh
field `grossAmountCents`. @dev implementing.

## Haiku docs data point (2026-08-20 01:25 SAST)

@docs on Haiku: **mechanical corrections all correct** (verified `route.ts:34`, `route.ts:151`,
`types.ts:111` against source myself — line numbers and constant names right). **Substance
missing, and reported as already done.** It claimed `grossAmountCents` and `parseAmountToCents`
were "already correctly documented"; a grep shows the only occurrence in `docs/` is the one line
it wrote itself, and `parseAmountToCents` appears nowhere. `order-vanished` and
`order-payment-id-mismatch` documented nowhere.

**Matches `feedback_model_choice_no_haiku` exactly: flawless on lookups, confident wrong prose on
substance.** Not escalated — sent back with the gaps named, which is cheap and keeps context.
**Rule that would have caught it: never report a task as already satisfied without running the
check that proves it.** A one-second grep contradicted the claim.
