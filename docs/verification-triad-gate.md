# Verification Triad Gate

Mission `verification-triad-gate`. M1/F1 commits `6615513a`, `f8c8dd7a`. M2/F2 (enforcement —
see below) closed the mechanism gap M1 deliberately left open.

## Why this exists

On 2026-09-01, a wrong `SITE_URL` shipped a live vendor email whose links pointed at a
`*.hosted.app` origin instead of `beta.saoc.co.za`. The defect reached a **10/10 green gate**
with **five clean Codex GPT-5.5 passes**, **zero deploys**, and **zero real browser or inbox
verification**. Every check that ran — the contract's shell assertions and every Codex review —
verified that the emailed link was *constructed correctly from* `SITE_URL`. None of them could
see that `SITE_URL` itself held the wrong value, because none of them ever fetched a real page
or opened a real email.

`.claude/rules/workflow.md` responded by making a three-layer verification triad mandatory for
every UI/workflow mission:

1. **Codex GPT-5.5 adversarial review** (`execution/codex_qa.sh`) — already a first-class
   contract assertion kind (`codex_qa`) before this mission.
2. **BrowserAgent against the deployed site** (`beta.saoc.co.za`, never a `*.hosted.app` /
   `*.run.app` origin).
3. **`gws` CLI, read-only, against the real inbox** — proves an email's *rendered* contents
   (links, addresses, QR codes) are correct in a real client.

Layers 2 and 3 existed only as a process rule — nothing in the contract gate could tell whether
they had actually run. This mission adds `browser_deployed_check` and `gws_inbox_check` as
sibling assertion kinds to the already-working `codex_qa` kind, plus a coverage linter, so a
contract *can* declare that all three layers ran and have that declaration mechanically checked.

**Correction to a stale backlog claim:** the backlog previously said this project "pulled
`codex_qa.sh` but never wired the assertion-kind side in." That was wrong — `codex_qa` was
already a complete, working assertion kind end-to-end in `execution/contract.py` before this
mission started. The actual gap this mission closed was narrower: add the two *sibling* kinds in
the same shape, not build the mechanism from scratch.

## How to use the two new kinds in a contract

Both kinds are declared exactly like `codex_qa`, inside an `assertions: {checks: [...]}` block
(`execution/contract.py`'s checks-dict normalisation, ~line 152):

```yaml
assertions:
  phase: 4
  checks:
    - id: A10
      description: BrowserAgent drove the live vendor flow against beta.saoc.co.za
      type: browser_deployed_check
      target: .agent/memory/scratch/vendor-flow-browser-manifest.json
      required: true

    - id: A11
      description: gws confirmed the vendor confirmation email rendered correctly in a real inbox
      type: gws_inbox_check
      target: .agent/memory/scratch/vendor-flow-gws-manifest.json
      required: true
```

`target` is a path to a **manifest JSON file** — the same convention `codex_qa` uses for a file
path or prompt string. Neither wrapper script can itself drive a browser or hold a live Gmail
session (`contract.py` only subprocess-invokes them); the manifest is written separately, by the
orchestrator dispatching a BrowserAgent or `gws` step as it does today, and records concrete,
checkable facts about that run — not a bare "I did it" claim.

### `browser_deployed_check` manifest shape

Required fields, verified by `execution/browser_deployed_check.sh <manifest.json>`:

| Field | Checked against |
|---|---|
| `origin` | Denylist (`*.hosted.app`, `*.run.app`) checked **first**, then must equal the allowlisted deployed origin (`BROWSER_CHECK_DEPLOYED_ORIGIN`, default `https://beta.saoc.co.za`) |
| `path_tested` | Concatenated with `origin` and re-fetched live with `curl` |
| `screenshot_path` | Resolved against the manifest's own path and its parent dir; must exist and be non-empty |
| `commit_sha` | Must equal `git rev-parse HEAD` at verification time |
| `timestamp` | Must be a valid ISO-8601 timestamp within the freshness window |
| `http_status` | Must be numeric; the *live* re-fetch must return the same status, and that status must be 2xx (no soft-passing 3xx) |

### `gws_inbox_check` manifest shape

Required fields, verified by `execution/gws_inbox_check.sh <manifest.json>`:

| Field | Checked against |
|---|---|
| `gws_subcommand` | Must equal the literal string `mail read` — anything else fails |
| `message_id` | Must be present; passed as the only manifest-derived value into a fixed `gws gmail users messages get` call for the live re-check |
| `timestamp` | Must be a valid ISO-8601 timestamp within the freshness window |

Both scripts do two things, not one: **structural verification** of the manifest's own fields,
and an **independent re-check at gate time** (a live `curl` fetch, or a live read-only `gws`
lookup) — so the gate is never purely trusting the agent's self-report. This proves the claimed
target currently exists and is live; it does not prove the *original* browser/gws run actually
drove that specific interaction pixel-for-pixel (see Limitations below).

### Exit-code contract

Both scripts mirror `codex_qa.sh`'s contract exactly, so `contract.py`'s existing dispatch and
gate-routing logic needed zero new gate-logic changes to support them:

- **exit 0** — PASS. Manifest structurally valid and the live re-check confirmed it.
- **exit 1** — FAIL, a genuine verified finding (forbidden origin, stale `commit_sha` or
  timestamp, missing screenshot, non-read-only `gws_subcommand`, missing `message_id`, a live
  re-fetch returning a non-2xx or mismatched status, a live `gws` lookup erroring). Routed by
  `contract.py`'s `gate_codex_qa_failure` attribute (name predates the two sibling kinds; it now
  covers all three `TRIAD_ASSERTION_KINDS`) to the dedicated **BLOCKED** verdict — gate exit code
  1, not the generic exit code 2 every other assertion failure produces — so a real cross-layer
  finding is never confused with routine flakiness.
- **exit 2** — wrapper/usage error: manifest missing or unparseable, or a required tool
  (`python3`, `git`, `curl` for the browser check; `python3`, `gws` for the inbox check when live
  re-check is enabled) is unavailable. Routed to the generic BLOCKED/inconclusive path, never
  read as a passed check and never read as "the feature is broken."

## Environment overrides and their real defaults

| Variable | Default | Meaning |
|---|---|---|
| `BROWSER_CHECK_MAX_AGE_SECONDS` | `14400` (4h) | Freshness window for a browser-check manifest's `timestamp` |
| `GWS_CHECK_MAX_AGE_SECONDS` | `14400` (4h) | Freshness window for a gws-check manifest's `timestamp` |
| `GWS_CHECK_LIVE_RECHECK` | `1` (on) | Whether the gws script performs the live `gws gmail users messages get` re-check |
| `BROWSER_CHECK_DEPLOYED_ORIGIN` | `https://beta.saoc.co.za` | The allowlisted origin a manifest's `origin` must match |

**These defaults are the real production behaviour, full stop.** The 4-hour window is
deliberately strict — long enough to survive a normal QA pass, short enough that a screenshot or
inbox lookup from a prior day or session cannot be replayed as fresh evidence for today's diff.

The test harness (`execution/checks/verify_browser_deployed_check_discriminator.py` and
`verify_gws_inbox_check_discriminator.py`) injects **generous overrides for specific fixture
cases only** — a widened `BROWSER_CHECK_MAX_AGE_SECONDS`/`GWS_CHECK_MAX_AGE_SECONDS` computed
from the golden "good" fixture's own recorded age (so the fixture doesn't silently start failing
as the calendar moves on), and `GWS_CHECK_LIVE_RECHECK=0` for the synthetic-message-id structural
fixtures (which use IDs that were never going to resolve against a real inbox by design). Every
other fixture case — including the stale-timestamp ones — still runs under the real, tight
defaults. **This distinction — loosened test injection vs. tight production default — is the
whole point of these two variables, and an earlier pass in this same mission got it backwards
twice** (shipping a 7-day production default, and a live-recheck default of off) before Codex
GPT-5.5 review caught both.

## M2/F2 — the linter is now enforced on every gate run

M1 shipped the two assertion kinds and the coverage linter (`execution/verify_triad_coverage.py`)
as a correct but voluntary mechanism — nothing forced a contract to declare the triad, so a
UI/workflow contract could still reach a fully green gate with zero browser check and zero inbox
check, exactly as before the SITE_URL incident. **M2/F2 closes that gap.** `execution/contract.py`'s
`gate_cmd()` now runs a triad-coverage preflight, unconditionally, on every gate invocation — a
UI/workflow contract cannot reach a green gate without declaring all three triad kinds unless it
is explicitly grandfathered (see Rollout below).

### Where it's wired, and why there

The preflight lives inside `gate_cmd()` itself (`execution/contract.py:1107` onward), called via
`_run_triad_coverage_preflight()` after `_preflight_residue_guard()` and before `_gate_dispatch()`
— i.e. before any assertion phase executes, regardless of `--phase` or `--run-checks`. This is
deliberate: `execution/skills/quick_gate.sh`, `execution/gate_sweep.py`,
`execution/improvement_loop.sh`, and `execution/mission.py`'s `cmd_gate` all converge on one
subprocess call, `python3 execution/contract.py gate ...` — `gate_cmd()` is the *only* choke
point that covers all four callers. Wiring the preflight into `quick_gate.sh` alone (F2's
original working title) would have been bypassable three separate ways, by any caller that
invokes `contract.py gate` directly.

### Exit codes

Two new codes, distinct from each other and from the residue guard's 4/5:

| Code | Meaning |
|---|---|
| `TRIAD_ENFORCEMENT_EXIT_CODE = 6` | Confirmed UI/workflow contract, missing one or more triad kinds, not grandfathered. The gate is correctly blocking real noncompliance. |
| `TRIAD_PREFLIGHT_ERROR_EXIT_CODE = 7` | The triad preflight itself couldn't run (linter missing, linter exited an out-of-contract code, or the baseline/hash-pin files couldn't be read). Infrastructure failure, not a verdict on the contract. |

A caller can always tell "confirmed noncompliant" (6) apart from "preflight infrastructure
error" (7) apart from "dataset residue" (4/5) — no exit code is ever asked to carry two meanings.

### Fail-closed — deliberately the opposite of its neighbour

The dataset-residue guard sitting right before this preflight in `gate_cmd()` fails **open** on
its own infrastructure error (`RESIDUE_SCAN_ERROR_EXIT_CODE`), because it depends on a live
network call to Sanity shared across every concurrent gate, and transient blips there are
routine noise not worth blocking unrelated work over.

The triad preflight fails **closed** instead. `verify_triad_coverage.py` is pure local file read
plus regex — no subprocess of its own, no network — so if it's missing, or exits any code
outside its documented 0/1/2 contract, that's a real code regression, not noise. This project's
own headline defect for this mission (`browser_deployed_check.sh` returning PASS when `curl` was
missing, caught during F1) is exactly a check silently degrading to "proceed" when its tool was
unavailable — failing open here would let that same defect recur one layer up, in the mechanism
built specifically to prevent it. **A future reader should not "fix" this asymmetry to match the
residue guard — the two checks have different failure profiles by design, and matching them
would reintroduce the exact bug this mission exists to close.**

This fail-closed behaviour also covers baseline/hash-pin file loading, not only the linter
subprocess itself: pointing `TRIAD_BASELINE_FILE` or `TRIAD_BASELINE_HASH_FILE` at a directory,
or a file containing invalid UTF-8, exits 7 with a named, actionable message — never a raw Python
traceback, never a silent pass.

### Rollout — 32 pre-existing contracts grandfathered, not permanently

Wiring the preflight in retroactively would have turned much of the existing suite red overnight
(most pre-M2 contracts declare no triad kinds at all). Rather than exempting UI/workflow
contracts as a category, F2 grandfathers a fixed, named list: `execution/triad-baseline-exempt.txt`
(one repo-relative contract path per line, `#`-comments and blanks ignored), paired with
`execution/triad-baseline-exempt.sha256` (one `<sha256>  <path>` line per baselined contract,
generated in the same commit).

The grandfather is **content-pinned, not path-pinned**: at gate time, `contract.py` re-derives
the live sha256 of a baselined contract file and compares it to the pinned hash.

- Hash matches → the grandfather holds, the preflight does not block.
- Hash doesn't match (the contract was edited since baselining) → enforcement **re-arms** for
  that path. The edit forfeits the grandfather; it does not carry it forward automatically.

This is deliberate: a bare path-list exemption that survived arbitrary future edits would let
someone materially change a UI contract's behaviour while keeping it permanently exempt from the
mission's headline requirement. A right (the exemption) is not a practice that outlives the state
it was granted for. The baseline mechanism only ever applies to the linter's FAIL case (confirmed
UI/workflow, missing kinds) — the linter's own EXEMPT classification (non-UI contracts) is never
subject to it at all, so the ~69 of 101 contracts that already pass or don't need to see zero
added noise.

Env seams for testing/overriding this mechanism: `TRIAD_BASELINE_FILE`, `TRIAD_BASELINE_HASH_FILE`,
`TRIAD_LINTER_SCRIPT_OVERRIDE` (points the preflight at a different linter binary — used by the
fail-closed test fixtures, not intended for production use).

### Linter shape-handling fixes (found by Codex, after the board was already green — twice)

Two rounds of Codex GPT-5.5 review found real defects in `verify_triad_coverage.py`'s shape
classification after F2's own gate was already 9/9 and then 11/11 green. Both are documented here
because they are exactly the "assertion satisfiable by shape, not truth" defect class this project
tracks — a future editor of the linter should know these boundaries were hit on purpose, not
guessed at:

- **`phases_raw` → `phases`.** An author-written contract in the raw `phases: {...}` dict shape
  was invisible to the linter (it read a normalisation-only key that doesn't exist until
  `contract.py` itself processes the file) and was misclassified as non-UI. Fixed by reading the
  raw `phases:` key directly.
- **Tri-state shape signal.** `assertion_kind()` must distinguish three shapes — checks-dict,
  plain-list, phases-dict — because `contract.py` only ever synthesizes a top-level `kind` field
  into `verify.kind` for phases-dict items, and only when that item's `verify` is absent or a bare
  string. Crediting top-level `kind` for *both* list and phases shapes (fixing too broadly) would
  let a plain-list item's decorative `kind:` masquerade as coverage the gate never actually
  executes as that kind; crediting it for *neither* (fixing too narrowly) falsely blocks a
  genuinely compliant phases-dict contract at exit 6.
- **Mixed-shape masquerade — a regression the first fix introduced.** `contract.py:131-132`
  discards `phases:` entries entirely when a truthy top-level `assertions:` list is also present
  (its own real execution behaviour) — but the newly-fixed linter credited those discarded
  `phases:` entries anyway. A contract could carry one bare, uncovered shell check in
  `assertions:` plus a fully triad-compliant but entirely decorative `phases:` block and still
  earn a green PASS from the linter, while the real gate executed zero triad checks. Fixed by
  mirroring `contract.py`'s exact `not assertions` condition (including the edge case that an
  explicit `assertions: []` is falsy too, and must still credit the `phases:` branch).

## What these checks CANNOT prove

Per this project's standing rule (name the limitation, don't paper over it):

- **The `app/`-substring classifier is trivially, silently dodgeable — this is the largest
  remaining gap, and it applies even now that enforcement is wired in.**
  `is_ui_workflow_contract()` keys purely on the literal substring `app/` appearing in an
  assertion's command/cmd/target text. A contract whose only assertion is
  `curl -sf https://saoc.co.za/national-show | grep -q "National Show"` — a genuine deployed-page
  check, checking exactly the kind of thing this mission's headline incident needed caught —
  contains no literal `app/` anywhere and classifies **EXEMPT**, skipping the triad requirement
  entirely, with no warning. Confirmed independently by both `@qa` and Codex. This means "no
  contract can reach a green gate without the triad" is true only for contracts written in one
  particular style (naming a repo-relative file path); a contract written against a URL, a
  Firestore collection name, or a component name instead slips through. Disclosed in the linter's
  own docstring as a known limitation, not a silently-dropped requirement, but it is a real,
  demonstrated gap in the mechanism this mission exists to build. Not fixed by F2; not yet
  scheduled.
- **`template/execution/` carries a parallel copy of `contract.py` that does not inherit this
  preflight.** `template/` is this project's seed copy of the upstream Athanor harness, not a
  second production gate path for SAOC's own contracts — out of scope by deliberate decision, not
  an oversight. Any contract gated through `template/execution/contract.py` (if ever invoked)
  runs with zero triad enforcement. Tracked in `.agent/memory/project/backlog.md` as an upstream
  PR to InunuNet/Athanor, per this project's standing convention
  (`feedback_harness_issues_pr_upstream`) — fix locally is not an option here because `template/`
  is meant to track upstream, not diverge from it.
- **Gate runs can mutate live content.** At least one contract in this repo
  (`contracts/cms-loop-f1-cdn-purge.yaml`, assertion A1) re-invokes a script that writes a
  sentinel value into `aboutPage.boardIntroText` on the real, live Sanity dataset as part of its
  own verification, with fallible cleanup. This is unrelated to the triad preflight itself, but
  worth knowing before gating any `cms-loop` contract casually — it poisoned the live dataset
  during this mission and required a manual restore.
- **`phases:`-dict-shaped contracts are invisible to the linter.** ~~`verify_triad_coverage.py`'s
  `iter_assertions_with_shape()` also reads `contract.get("phases_raw")`, but that key only
  exists *after* `execution/contract.py`'s own internal normalisation — a standalone run of the
  linter against an author-written contract in the `phases:` dict shape never populates it, so
  such a contract is invisible to the linter entirely.~~ **Fixed by M2/F2** — see "Linter
  shape-handling fixes" above. Retained here, struck through, so a reader who remembers this
  limitation from M1 can confirm it's closed rather than wondering if it was missed.
- **One unwrapped file read in the baseline-grandfather path, low severity, not reachable in
  practice today.** `_triad_contract_is_grandfathered()`'s own `full_path.read_bytes()` call
  (hashing the *gated contract's own file* to compare against its pinned hash — not the
  baseline/hash-pin list files, which are wrapped) has no try/except around it. In isolation this
  raises rather than exiting 7. In the real `gate_cmd()` entry point, though, `load_contract()`
  already opens and successfully parses this exact same path earlier in the same call, before the
  triad preflight ever runs — so the only way to reach this unwrapped read with a *now-bad* path
  is a TOCTOU race (the file changing on disk between `load_contract()`'s read and the preflight's
  read, moments later, in the same process). Recorded here as defence-in-depth debt, not a live
  defect, so it isn't rediscovered as new.
- **No pixel-level screenshot diff.** The browser check confirms a screenshot file exists and is
  non-empty, and that the recorded origin/path independently returns a matching live HTTP status
  — it does not hash or diff the screenshot's *content* against what the page renders today. A
  manifest could point `screenshot_path` at an unrelated non-empty file and still pass. Closing
  this needs a follow-up (a content-hash pinned to a fresh Playwright render at check time) —
  out of scope for this mission.
- **The read-only guard on `gws_inbox_check.sh` is static/structural, not a sandbox.** It proves
  the script's own source contains no write-verb subcommand token and builds no dynamic argv from
  manifest content — not that the running process is contained. The documented bound of this
  static check is a maximum of 6 intervening tokens between `gws` and a verb on the same source
  line; a sufficiently obfuscated future edit (e.g. a base64-encoded subcommand string) could
  defeat it. Mitigation is ordinary code review on any change to this file, same as any other
  security-relevant script.
- **A missing wrapper script raises `FileNotFoundError`, not a clean exit 2.** Both new scripts
  mirror the pre-existing `codex_qa.sh` dispatch pattern in `contract.py`, including this gap —
  if `execution/browser_deployed_check.sh` or `execution/gws_inbox_check.sh` itself is missing
  (not just its manifest), the subprocess call raises rather than degrading to the documented
  exit-2 BLOCKED path. Pre-existing behaviour, not introduced by this mission, and not yet fixed
  for any of the three triad kinds.

## History — three Codex GPT-5.5 rounds FAILed this feature's own gate

A reader deciding whether to trust a green gate should know this feature's own gate was green
and wrong three times before it was actually correct:

- **Round 1** (4 findings) — production freshness default was 7 days, not the intended 4 hours,
  effectively meaning the test-harness override *was* the production behaviour rather than a
  loosening of it; `GWS_CHECK_LIVE_RECHECK` defaulted off, so Layer 3 never touched a real inbox
  by default; a missing `curl` binary passed silently instead of exiting 2; the coverage linter
  keyed on a bare `kind:` field that `contract.py` doesn't actually read in the shape being
  checked.
- **Round 2** (3 findings) — the live browser re-check accepted any 2xx without comparing it to
  the manifest's own claimed `http_status`, letting a manifest's claim silently drift from what
  is live today; the read-only guard didn't cover the API-style `gws gmail users messages <verb>`
  invocation form, only the CLI-verb form; a bad fixture could fail for the *wrong* reason and
  still be graded as correctly rejecting it.
- **Round 3** (2 findings) — `assertion_kind()` credited a top-level `type:` field on *any*
  assertion shape, but `contract.py` only ever normalises `type:` into `verify.kind` inside the
  `assertions: {checks: [...]}` shape and only ever executes `verify.kind` at run time. A plain
  `assertions:` list could declare all three triad kinds via `type:`, pass the coverage linter,
  and have the gate execute those assertions as bare uncovered shell checks — the same defect
  class as round 1's bare-`kind:` bug, recurring one shape later. Fixed by tracking assertion
  provenance (`from_checks_shape`) through `iter_assertions_with_shape()` so top-level `type` is
  credited only for the one shape `contract.py` actually reads it in.

Each round caught a real defect that a 9/9 green gate was hiding at the time. See
`.agent/memory/scratch/2026-09-04-codex-f1-verification-triad-gate.md` and the mission file
(`.agent/memory/project/missions/2026-09-03-verification-triad-gate.md`) for full findings text.

## Reference

- Scripts: `execution/browser_deployed_check.sh`, `execution/gws_inbox_check.sh`,
  `execution/verify_triad_coverage.py`
- Discriminator/coverage checks: `execution/checks/verify_browser_deployed_check_discriminator.py`,
  `execution/checks/verify_gws_inbox_check_discriminator.py`,
  `execution/checks/verify_triad_kinds_declared.py`
- Dispatch/normalisation: `TRIAD_ASSERTION_KINDS` and the `elif kind == "browser_deployed_check"` /
  `elif kind == "gws_inbox_check"` blocks in `execution/contract.py`
- Enforcement preflight (M2/F2): `_run_triad_coverage_preflight()` and
  `_triad_contract_is_grandfathered()` in `execution/contract.py`, called from `gate_cmd()`
- Baseline/rollout: `execution/triad-baseline-exempt.txt`, `execution/triad-baseline-exempt.sha256`
- F2 fixture checks: `execution/checks/verify_f2_*.{py,sh}`
- Spec: `.agent/memory/project/specs/verification-triad-gate/goldens/README.md`
- Contracts: `.agent/memory/project/specs/verification-triad-gate/contract-f1.yaml`,
  `.agent/memory/project/specs/verification-triad-gate/contract-f2.yaml`
- Mission file: `.agent/memory/project/missions/2026-09-03-verification-triad-gate.md`
- QA report (M2/F2): `.agent/memory/scratch/qa-report-f2-triad-gate-wiring.md`
