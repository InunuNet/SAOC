# ticketing-complete M1/F7 — design record

Self-test harness, standing up from ZERO: no `test` script in `package.json`, no
vitest/jest, no `playwright.config.*` anywhere despite `playwright` already being a
devDependency. **Reordered ahead of F3/F4** (2026-09-08, team lead) — Brad asked for the
work to be self-testable *while being built*, not audited afterward; scheduling this after
the purchase surfaces it's meant to verify would make it a retrofit shaped to whatever the
implementation happens to do.

## 1. Files this feature creates

- `playwright.config.ts` — NEW, repo root.
- `e2e/support/dynamic-port.ts` — NEW. `getFreeLocalPort(): Promise<number>` — opens a
  `net.createServer()` on port 0, reads the OS-assigned port from `.address()`, closes the
  probe server, returns the port. No new dependency.
- `e2e/nav-links-200.spec.ts` — every NAV href returns 200.
- `e2e/no-horizontal-overflow.spec.ts` — geometry check across viewport widths.
- `e2e/sold-out-and-empty-states.spec.ts` — mocked-data rendering checks.
- `e2e/no-fabricated-content.spec.ts` — banned-token + `data-placeholder` presence checks.
- `package.json` — adds a `"test:e2e": "playwright test"` script.

## 2. Port discovery — never hardcoded, never guessed

Several stale dev servers are running right now (3002, 3911, 3913-3916, 3999); nothing is
on 3333 despite `dev:secure` naming it. A hardcoded port is a flaky test waiting to happen
-- it might silently talk to a STALE server on that port serving old state, or fail outright
if nothing is listening there.

`playwright.config.ts` picks its own port at config-load time via top-level `await
getFreeLocalPort()` (Playwright's TS/ESM config loader supports this; Node 22 supports
top-level await natively) and uses that SAME value for both `use.baseURL` and
`webServer.url`/`webServer.command` (`pnpm dev -- --port ${PORT}`).
`webServer.reuseExistingServer: false` always — since the port is freshly discovered each
run, there is never a legitimate existing server to reuse, and reusing one would mean
either a collision (impossible, the port was just probed free) or accidentally attaching to
something unrelated.

## 3. The footer overflow test MUST be RED today

The mission's own "Known defect to fix in this mission" section: the footer Subscribe
button causes horizontal page scroll at 1024-1050px (reported by the NOS session, SAOC
chrome, ours). `e2e/no-horizontal-overflow.spec.ts` tests viewport widths 390, 1024, 1050,
and 1280 at minimum, measuring **real layout** (`document.documentElement.scrollWidth`
vs. the viewport width, or `element.getBoundingClientRect()` — actual rendered geometry),
never a class-name check (`toHaveClass`, `className.includes(...)`) — a component reading
back its own Tailwind string is the same claim restated, not verification. Team lead's own
framing: "a test suite that goes green on first run against a known-broken page is a suite
that isn't looking." **A8 in the contract asserts this test is currently RED at
1024-1050px** — proof the harness is looking at something real, not vacuous. Fixing the
footer bug itself is explicitly OUT of F7's scope (F7 builds the detector; the fix belongs
to whichever feature owns `components/chrome/Footer.tsx` next — likely F6's nav rebuild,
since Footer is chrome, or its own small fix Brad schedules).

## 4. No Sanity dataset access from tests — mocked, not live, not written

Same hard rule as F1/F2: one shared `production` dataset. Tests must never write to it
(obviously) but also must not even READ live data as their oracle, because live content can
change out from under a fixed expectation and because a sold-out/empty state is easiest and
safest to prove by constructing it deliberately rather than hunting for a live document that
happens to be in that state today. `sold-out-and-empty-states.spec.ts` uses Playwright's
`page.route()` to intercept the relevant fetch/query call and serve a fixed fixture payload
(one sold-out ticket type, one empty category) — no `@sanity/client` import, no
`createClient(`, no live network call reaching Sanity at all for this spec.

## 5. Coverage this feature ships, and what it deliberately does NOT cover yet

F7 lands BEFORE F3/F4, so it can only cover surfaces that already exist:
home/nav/footer (chrome, all routes) and the existing `/tickets` admission purchase page.
**F3 and F4's own contracts must each add a spec file to `e2e/`** exercising the same
three falsifiable properties (no horizontal overflow, sold-out/empty states render,
`data-placeholder` present where provisional) for their new purchase surfaces
(`/national-show/conferences`, `/national-show/workshops`) — this is the mechanism by which
"self-testable while being built" actually happens: the harness exists first, each later
feature extends it as part of landing, rather than one giant retrofit at the end. Whoever
writes F3/F4's contract should cite this section rather than rediscovering the convention.

## 6. `/api/contact` mails a stranger every run unless mocked -- one dedicated, proven-mocked spec

Found 2026-09-08 (team lead, verifying `/members`): `POST /api/contact` writes to Firestore
`contactSubmissions` AND dispatches a real Resend email to whatever address was submitted.
It is shared by TWO forms -- `components/contact/ContactForm.tsx` and the new
`components/members/SuggestionForm.tsx` (discriminated only by a `subject` field) -- both
posting via client-side `fetch('/api/contact', ...)`. Any Playwright test that submits
either form for real mails a stranger and writes a live Firestore document, every run --
already happened once tonight (a test document sat in the live queue with `status: "new"`
next to real enquiries; deleted by exact id). This project is also mid-migration on its
sending domain/DNS, so bounces from a non-existent test address accrue against a sending
reputation that is already fragile -- this is a bigger hazard here than it would be on a
settled project.

**Decision: mock at the browser network boundary (Playwright `page.route()`), not a
server-side test-mode guard.** Both forms submit via client-side `fetch`, which Playwright's
`page.route()` intercepts before the request ever leaves the browser context -- the request
never reaches the Next.js server, so neither the Resend call nor the Firestore write ever
happens, in EITHER form, with ZERO changes to `lib/email.ts` or the `/api/contact` route.
Rejected the alternative (an env-gated "test mode" branch in the route handler) because it
adds a production code path that exists only for tests and can be left on/misconfigured in
production -- the same shape of risk as leaving a debug flag in shipped code, and Brad's own
mission explicitly asked for `active`/`provisional`-style explicit flags precisely to avoid
exactly this kind of silent, easy-to-forget state.

**Only ONE spec file may interact with either form**: `e2e/contact-form-mocked.spec.ts`. It
must:
1. Register `page.route('**/api/contact', ...)` BEFORE navigating to the page under test.
2. Set a boolean flag (e.g. `let interceptedContactRequest = false;`) to `true` INSIDE the
   route callback, then call `route.fulfill({ status: 201, ... })` -- never `route.continue()`,
   which would let the real request through and defeat the whole point.
3. After submitting the form, assert `expect(interceptedContactRequest).toBe(true)` --
   proving the mock actually fired, not merely that the test file happens to contain a
   `page.route()` call that never matched. This is the exact defect class the NOS session
   caught in their own SEO layer (code built, never imported): "the test ran and nothing
   exploded" is satisfied just as well by a mock that silently never wired in as by one that
   worked. A17 in the contract checks for this hit-flag pattern specifically, not just the
   presence of `page.route(`.

No other `e2e/` spec file may submit either form -- A18 is a repo-wide negative-grep banning
any OTHER spec from touching a contact/suggestion-form submit interaction, so a second,
unmocked interaction can't creep in later without being caught.

**Deliberate scanning choice, recorded so it isn't rediscovered mid-implementation**: like
F1's A3 (which tripped on a comment naming a forbidden constant, not just code using it),
every negative-grep assertion in this contract scans the WHOLE file text, comments included.
A code comment describing the forbidden pattern will also trip these checks. That is a
known, accepted tradeoff (false-positive-safe over convenient) for every negative-grep in
this contract, not an oversight -- if a future comment needs to discuss a banned pattern by
name, phrase it to avoid the literal token (e.g. "the unsafe polarity" rather than pasting
`route.continue(`), matching how this project's own scripts already discuss
`fix-vip-and-weekend-pass-pricing.ts`'s hazard without re-triggering other contracts' greps.

## 7. Anti-fabrication smoke check

`no-fabricated-content.spec.ts` asserts none of a banned-token list appears in the rendered
body text of every tested page: `undefined`, `NaN`, `[object Object]`, `Lorem ipsum`,
`TODO`, `FIXME`. Separately (not the same assertion), it asserts `[data-placeholder="true"]`
is present in the DOM on `/tickets` when the (mocked) ticket data includes a
`provisional: true` product — proving `TicketTypeCard.tsx`'s F2-added attribute actually
reaches the rendered page, not just the component's source.

## 8. CI wiring — detection, not enforcement (added 2026-09-08)

The backlog's standing "nothing in this repo runs the contract checks" item (no `test`
script, nothing in `.github/workflows/ci.yml` invokes `contracts/checks` or any e2e suite)
names this feature as the one that folds in a real runner + CI job, so F7's own coverage
doesn't join the pile of specs that exist on disk and never run again after their author's
one-time invocation.

- `.github/workflows/ci.yml` gains a job step that runs `pnpm test:e2e` (the `package.json`
  script A2 requires), landing alongside the existing lint/type-check/build steps — it does
  not replace or gate them.
- Same hit-flag discipline as A16's contact-form mock: a step merely *mentioning*
  `test:e2e` (a comment, a step under an `if: false` or otherwise unreachable condition, a
  step silently skipped because an earlier step in the same job already failed) proves
  nothing actually ran. `contracts/checks/ticketing-complete-f7/verify_ci_step_reachable.py`
  parses the workflow YAML and confirms the `test:e2e`-invoking step sits in a job with no
  restrictive `if:` on the job itself, carries no `if:` condition of its own, and isn't
  downstream of a `continue-on-error`/`if: failure()` branch from a prior step — i.e. it
  actually executes on an ordinary push/PR run, not merely on paper.
- **DETECTION-ONLY, not enforcement.** `main` carries no branch protection today (see
  `ci.yml`'s own existing comments) — a red `test:e2e` step blocks nothing from merging
  until Brad turns branch protection on for `main`. That is his call: a GitHub repository
  setting, not a code change this feature can make on his behalf. F7 wires the signal;
  turning the signal into a gate is a separate, explicit decision recorded here so it is
  never silently assumed to already be true.

## 9. The runner: pass/fail/missing, and why it exists (added 2026-09-08)

`contracts/checks/_shared/run_contract_suite.mjs` exists because "nothing runs the contract
checks" is a documented, recurring problem, not a hypothetical this feature is guarding
against pre-emptively:

- **The four failing contracts found during the vendor F2 QA sweep** (2026-08-25/26) —
  `vendor-f6-review-workflow`, `vendor-f5-register-route`, `vendor-f3-showcase-page`,
  `vendor-form-ui` each had a real, confirmed-pre-existing contract failure sitting
  unnoticed, because nothing re-ran any of them after the agent that wrote them moved on.
- **The standing P1 backlog item** — "audit remaining contracts for the weak-assertion defect class" —
  logged, never actioned, because there was no mechanism to run the audit
  continuously rather than as a one-off manual sweep.
- **The NOS session's own contract**: of nine Playwright check scripts it names, **7 of 9
  do not exist on disk.** A runner that treats "script missing" the same as "script failed"
  would either bury real failures in a wall of missing-file noise, or — worse — silently
  skip them and report green for coverage that was never written. That is the exact
  motivation for A22/A23's three-state classification: pass, fail, and missing are reported
  as three genuinely distinct outcomes, never folded together.
- **F2's own A13** (this mission) was found vacuous by @qa for the identical structural
  reason: it scoped a `grep -rl` at a directory that did not exist, so it examined nothing
  and was green unconditionally. The general rule this feature's goldens record for future
  contract authors: **an assertion that cannot fail is not a weak assertion, it is a
  missing one.** A dedicated vacuity-detection pass (does an assertion's own command target
  a path/directory that provably doesn't exist, making it unconditionally true?) is real,
  useful follow-on work this feature does NOT build tonight — logged separately in
  `backlog.md` rather than silently assumed to be covered by A22/A23, which only detect a
  MISSING SCRIPT, not a vacuous assertion structure in general.

Design choice made explicit, not left implicit: the runner's `missing` classification does
NOT itself fail the CI job (A20/A21) — a mission legitimately mid-flight may reference a
check script another feature hasn't written yet (see F3's own `required: false`
verification specs of NOS-owned routes for the same shape of honest incompleteness). A real
`fail` does fail the job; `missing` is surfaced as a distinct, visible count in the job's
output so coverage gaps are never silently invisible, without making an in-progress mission
un-mergeable for work that hasn't been reached yet. This is a judgment call, not something
the team lead specified explicitly — flagged here for confirmation rather than assumed.

## 10. The ratchet — why "hard-fail" and "visible-but-free" are both wrong (added 2026-09-08)

Team lead's ruling, after the "should `missing` fail CI?" question raised in §9 above: both
obvious policies fail.

- **Hard-fail on any `missing`** makes CI red from its very first run — 7 of 9 scripts are
  already absent in the NOS session's own contract, plus the four pre-existing failing
  contracts already logged in `backlog.md`. A red job that's red on day one gets disabled or
  ignored within a week, destroying the mechanism's credibility in the same commit that
  built it.
- **Non-blocking-and-visible, permanently**, makes declaring a check you never write
  completely free — no cost, ever, for adding an assertion whose script doesn't exist. That
  is precisely the incentive that produced 7-of-9 in the first place. A visible count nobody
  is accountable for only grows.

**The ratchet**: `contracts/checks/_shared/missing-baseline.json` commits TODAY's missing
count (plus the specific ids) as a baseline. CI fails when a fresh run's missing count
EXCEEDS the baseline, passes at or below it. Existing debt is tolerated (nobody has to fix
7-of-9 tonight to unblock CI); new debt is impossible (a freshly-added missing assertion
pushes the count over baseline and fails the build); and the ratchet tightens itself with no
maintenance burden — every time someone actually writes one of the absent scripts, the next
baseline regeneration records a smaller number, and the bar for "acceptable" drops
permanently.

**Self-consistency against the "baseline of 999" attack.** A hand-typed baseline number
would satisfy a bare `count is an integer` check while completely disabling the ratchet —
the same vacuity shape as `contract-f2.yaml`'s old A13. The baseline file must also carry
`missingAssertionIds`, and `count` must equal that array's length with no duplicates — a
number with no matching id list cannot be invented, only produced by an actual run. Beyond
that, `--verify-baseline` re-runs the suite and confirms every listed id is STILL genuinely
classified "missing" today — a baseline can't silently go stale by listing ids that have
since been fixed (which would let coverage regress without the ratchet ever tightening back
up as a self-correction).

**Fail closed, deliberately, not by accident.** A missing or corrupt baseline file must
never silently mean "unlimited" — checked with a genuine negative control: this feature's
own A28 was caught, during architect verification, making the identical vacuity mistake it
exists to prevent. A bare `! node run_contract_suite.mjs ... > /dev/null 2>&1` reads as
"pass" if the script simply doesn't exist yet (a generic "Cannot find module" crash is also
a nonzero exit) — that's a coincidental crash, not proof the fail-closed path works. Fixed to
require the runner's own (unsuppressed) stderr name the specific failure ("baseline" plus
"not found" for a missing path, "baseline" plus "invalid"/"parse" for corrupt JSON) — a
generic startup crash can no longer be mistaken for the deliberate fail-closed behavior.
Verified in both directions against throwaway fake runners in `.tmp/sandbox/`: a runner that
crashes for an unrelated reason correctly fails this assertion; a runner that fails closed
properly correctly passes it.

**Visibility even on a passing run.** A count alone tells nobody which coverage is
imaginary. The CI job's runner step must print every currently-missing assertion's id in its
own (unsuppressed) output, whether the job passes or fails — so a passing CI run still shows,
by name, exactly which checks aren't real yet.

**Known, accepted limitation: variable-interpolated check-script paths are printed but NOT
gated (added 2026-09-08, after a QA-planted probe).** The runner classifies an assertion as
`missing` only when it can resolve the referenced script path literally. A path assembled by
the shell — `F=x; node "contracts/checks/some-dir/${F}.mjs"` — cannot be resolved statically,
so it is deliberately excluded from the missing count. That exclusion is not optional: two
assertions in `contracts/contract-show-visitor-info.yaml` (A70, A73) legitimately loop over
check scripts this way, against files that really do exist and that the loop existence-checks
itself, and counting them as missing would make CI red on correct contracts. But QA proved the
exclusion also created a permanent blind spot: a probe assertion whose interpolated path
pointed at a genuinely absent script was reported **nowhere at all** in corpus/ratchet mode —
not `missing`, not `fail`, silently bucketed as `not-evaluated`, which nothing gates on. A
declared check that could never run was invisible to CI forever. The fix makes the debt
visible without making it gate: both `--list-missing` and `--check-ratchet` now print an
`unresolvable:` bucket naming every such assertion and path, annotated with whether the
literal prefix directory before the `$` actually exists (if it does not, no expansion can
ever resolve to a real file; if it does, the reference may be a legitimate loop and the
runner says so rather than guessing). This bucket is **excluded from the ratchet's fail
condition on purpose** — gating it would fire on show-visitor-info's legitimate loops, the
exact false positive the exclusion exists to prevent. So this is a reported, human-read
signal, not an enforced one: a dead interpolated reference is now impossible to miss in the
CI log, but still possible to ignore. Shell *globs* (`check-*.mjs`) are excluded from the
missing count for the same reason and are **not** reported in this bucket either — widening
the bucket beyond the interpolation case QA actually probed was not taken on here. That is
the same shape of hole, stated plainly rather than papered over, and a live instance has
since been traced (`contract-show-visitor-info.yaml` A76 loops over a glob and is reported
nowhere today) and logged as a P2 in `backlog.md` — logged, deliberately not fixed here.
Closing either properly means resolving the reference the way the shell would, which is a
different piece of work with its own contract. The behaviour described here is itself
runtime-pinned, so it cannot silently drift back out: contract-f7.yaml A32 (the bucket is
printed by both `--list-missing` and `--check-ratchet`) and A33 (a non-empty bucket still does
not make the ratchet exit nonzero) both run
`contracts/checks/ticketing-complete-f7/verify_unresolvable_bucket.mjs`, in `print` and
`not-gated` mode respectively — the enforcement is there to be found, not just this prose.
