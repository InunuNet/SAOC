# verification-triad-gate — golden spec (M1/F1)

## Backlog correction (read this first)

`.agent/memory/project/backlog.md` currently claims:

> this project pulled the script but never wired the assertion-kind side in

**That is stale/wrong.** `execution/contract.py` already implements `codex_qa` as a
first-class assertion kind end-to-end:

- normalisation of `type: codex_qa` checks into `verify.kind == "codex_qa"` (`execution/contract.py:152`)
- dispatch that shells out to `execution/codex_qa.sh <target>` and maps its exit
  code 0/1/2 to pass/fail/error (`execution/contract.py:368`)
- a dedicated BLOCKED verdict path, `args.gate_codex_qa_failure`, that distinguishes
  a genuine cross-model finding from an ordinary assertion failure or a wrapper/usage
  error (`execution/contract.py:517-631`), reflected in `gate`'s documented exit-code
  contract (module docstring, `execution/contract.py:1-23`: exit 1 = codex_qa BLOCKED,
  exit 2 = everything else)

So the real gap this mission closes is narrower than the backlog entry implies:
add **two sibling assertion kinds**, `browser_deployed_check` and `gws_inbox_check`,
in exactly the same shape as the already-working `codex_qa` kind — not build the
mechanism from scratch. Whoever picks up this contract should correct the backlog
entry's wording when this mission closes.

## What's already spec'd here vs. what @dev still implements

This architect pass could not touch `execution/contract.py` or write the product
sibling scripts (that's @dev's job against these goldens, per the mandatory chain —
architect returns decisions and golden fixtures, never code). What's delivered here:

- Seven browser-check fixtures + six gws-check fixtures under `goldens/fixtures/`
  (one "good", the rest each isolating exactly one rejection reason).
- Three discriminator-proving check scripts under `execution/checks/` that invoke
  the *not-yet-existing* sibling scripts against those fixtures and assert exit
  codes. **RED-verified against current code** — see evidence below. Once @dev
  implements the scripts per the spec below, these same checks (unmodified) go
  green, which is the actual proof the implementation matches spec, not just that
  a script exists.
- The contract (`contract-f1.yaml`) wiring those checks as phase-4 assertions.

@dev must implement, against these goldens only:
1. `execution/browser_deployed_check.sh <manifest.json>`
2. `execution/gws_inbox_check.sh <manifest.json>`
3. `execution/verify_triad_coverage.py <contract.yaml>` (the coverage linter)
4. The two new `elif kind == "browser_deployed_check":` / `elif kind == "gws_inbox_check":`
   dispatch blocks in `execution/contract.py`, mirroring the existing `codex_qa`
   block at line 368 almost verbatim (subprocess-run the sibling script against
   `verify.get("target")`, map exit 0/1/2 to pass/fail/error) — and the matching
   `type: browser_deployed_check` / `type: gws_inbox_check` normalisation branches
   near line 152.
5. Contract-authoring convention: `target` for these two kinds is a path to a
   manifest JSON file (analogous to how `codex_qa`'s `target` is a file path or
   prompt string) — see the `verify:` blocks in `FIXTURE_UI_COMPLIANT` inside
   `execution/checks/verify_triad_kinds_declared.py` for the exact shape.

## Design answers (the six questions this mission exists to settle)

### 1. What constitutes proof the layer actually ran?

Neither sibling script can *itself* drive a browser or hold a live Gmail session —
`execution/contract.py` invokes them as a subprocess, with no access to the Agent
tool. So the proof shape mirrors what's actually available: the BrowserAgent/gws
step (dispatched separately, by the orchestrator, as today) writes a **manifest
JSON artefact** recording concrete, checkable facts about the run it performed —
not a bare "I did it" claim:

- `browser_deployed_check` manifest: `origin`, `path_tested`, `screenshot_path`,
  `commit_sha`, `timestamp`, `http_status`. See `goldens/fixtures/browser_manifest_good.json`.
- `gws_inbox_check` manifest: `gws_subcommand`, `message_id`, `subject`, `from`,
  `recipient`, `timestamp`, `content_sha256`. See `goldens/fixtures/gws_manifest_good.json`.

The verification script then does two things, not one:
- **Structural verification** of the manifest's own fields (origin allowlist,
  screenshot file actually present and non-empty, message_id present).
- **Independent re-check at gate time** — re-fetch the recorded origin/path with
  a live HTTP request (browser check) or re-read the recorded `message_id` via a
  read-only `gws mail read` call (gws check) — so the gate isn't purely trusting
  the agent's self-report; it independently confirms the claimed evidence is still
  true right now. This is explicitly **not** proof of pixel-level browser
  interaction (a real screenshot diff is future work, noted as a limitation below)
  — it's proof the claimed target actually exists, is live, and is not a fabricated
  origin/message-id.

A script that exits 0 without touching either the fixture file or the network is
precisely the "vacuous assertion" defect class this project audits for. The
discriminator checks (`verify_browser_deployed_check_discriminator.py`,
`verify_gws_inbox_check_discriminator.py`) prove the eventual script cannot pass
that way, by asserting it independently *rejects* every fixture that isolates one
specific defect.

### 2. How is a stale artefact rejected?

Two independent binds, both required:
- **Commit binding**: `commit_sha` in the manifest must equal `git rev-parse HEAD`
  at verification time. A screenshot proving yesterday's code worked does not
  satisfy today's diff. See `browser_manifest_bad_stale_commit.json`.
- **Time binding**: `timestamp` must be within `max_age_seconds` (recommend
  default 4h — long enough to survive a normal QA pass, short enough that a
  screenshot from a prior day/session cannot be replayed) of "now" at gate time.
  See `browser_manifest_bad_stale_timestamp.json` / `gws_manifest_bad_stale_timestamp.json`.

Commit-binding alone is insufficient on a long-lived feature branch with no new
commits between two sessions; time-binding alone is insufficient if HEAD moves
after the evidence was captured. Both together close both gaps.

### 3. Origin enforcement for `browser_deployed_check`

Must **FAIL** (exit 1, not warn) on any manifest whose `origin` matches
`*.hosted.app` or `*.run.app` — that is the literal shape of the incident this
kind exists to prevent (see `browser_manifest_bad_hostedapp.json`,
`browser_manifest_bad_runapp.json`). Implement as an explicit denylist check
(reject if origin matches either pattern) **in addition to** an allowlist check
(origin must match the project's actual deployed public origin,
`https://beta.saoc.co.za`, sourced from a project constant — not hardcoded
inline in a way future origin changes silently bypass). Denylist-first ordering
matters: a future origin misconfiguration that happens to also match some looser
allowlist regex must still be caught by the explicit deny check.

### 4. `gws_inbox_check` must be structurally read-only

Guaranteed two ways, both checked structurally (not just by today's fixture
behaviour) in `verify_gws_inbox_check_discriminator.py`'s
`check_structural_readonly_guard()`:

- **Hardcoded subcommand allowlist**: the script's own source must never contain
  a `gws mail send|reply|delete|trash|forward|draft|modify|remove` token — i.e.
  the script is not merely *told* to avoid write calls, it is *incapable* of
  making one because that code path doesn't exist in the script at all.
- **No dynamic argv construction from manifest content**: the script must not
  `eval` or otherwise build a `gws` command line from a string extracted out of
  the (attacker-or-corruption-controllable) manifest JSON. If it did, a malformed
  manifest could choose the subcommand at runtime and the "hardcoded allowlist"
  guarantee would only be as strong as trusting the manifest — which is exactly
  what this kind exists to *not* do. The only manifest field the script may use
  is `message_id`, passed as a single opaque argument to a fixed, literal
  `gws mail read` invocation.

This is a static/structural guarantee, not a sandbox — see Limitations below for
what it does not catch.

### 5. Which contracts must carry all three kinds, and how enforced

`execution/verify_triad_coverage.py <contract.yaml>` (spec'd, not yet built —
see `verify_triad_kinds_declared.py`'s three fixtures for the exact input/output
contract): classifies a contract as "UI/workflow" if any assertion's `command` or
`target` string contains an `app/`-rooted path, and if so requires at least one
assertion of each of `codex_qa`, `browser_deployed_check`, `gws_inbox_check` kind
somewhere in that contract. Exit 0 = compliant or exempt (non-UI), exit 1 = UI
contract missing one or more triad kinds, matching this project's other linters'
exit-code convention (`verify_backlog_hygiene_gate_blocks_stale.sh` et al.).

**Honest limitation** (must ship in the linter's own docstring, not just here):
this is a string-matching heuristic over assertion command/target text, not
semantic analysis of what the feature actually touches.
- False negative: a UI contract whose assertions only reference a Firestore
  collection name or an API route with no literal `app/` substring is invisible
  to this linter and will not be flagged.
- False positive: a non-UI contract whose shell command happens to contain the
  substring `app/` unrelated to the Next.js route tree (e.g. inside a quoted
  string or comment) gets misclassified as UI/workflow.
This heuristic catches the common, obvious case (a contract asserting against
`app/(marketing)/...` or `app/api/...` paths, which is how virtually every UI/
workflow contract in this repo is already written) and is meant as a backstop
against a mission simply forgetting the rule — not a formal proof of coverage.
Architect/orchestrator judgement (per `workflow.md`'s existing chain) remains the
primary enforcement; this linter is the automated second check per this project's
"code verifies code" mandate.

### 6. Graceful degradation — BLOCKED vs. FAIL vs. silent PASS

Both sibling scripts must reuse `codex_qa.sh`'s exact exit-code contract, because
`execution/contract.py`'s dispatch/gate logic already knows how to route it
correctly with zero new gate-logic changes:

- **exit 0** — verified pass.
- **exit 1** — verified FAIL: the evidence exists and was checked, and a real
  check failed (forbidden origin, stale binding, write-verb subcommand, etc).
  Contract.py's existing `gate_codex_qa_failure`-style routing (generalise the
  attribute name, or add two parallel attributes — @dev's call, document either
  way) must route this to the same BLOCKED verdict treatment codex_qa gets, not
  a generic assertion failure, so a real adversarial finding is never confused
  with routine flakiness.
  - `gws` CLI missing → exit 2, evidence names the missing binary
  - browser tooling / manifest never produced (BrowserAgent step never ran or
    never wrote its artefact) → exit 2
  - `codex` missing already handled by existing `codex_qa.sh`
  A tool-missing or manifest-absent state must **never** be silently treated as
  pass. It must also never be silently treated as a "real finding" FAIL — that
  would make an infrastructure outage read as "the feature is broken," which is
  its own false-alarm failure mode. Exit 2 keeps it in the same "inconclusive,
  not a QA fail" bucket `execution/contract.py`'s existing `codex_qa` error path
  already documents (`execution/contract.py:387`, `:390`).

## RED evidence (captured, real exit codes, against current code as of this pass)

```
$ python3 execution/checks/verify_browser_deployed_check_discriminator.py; echo $?
  FAIL execution/browser_deployed_check.sh exists  missing ... -- not yet implemented by @dev
  [... 6 fixture cases FAIL, each because the script doesn't exist yet ...]
  FAIL missing-manifest path -> exit 2 (usage error, not silent pass)
1

$ python3 execution/checks/verify_gws_inbox_check_discriminator.py; echo $?
  FAIL execution/gws_inbox_check.sh exists  missing ... -- not yet implemented by @dev
  [... 4 fixture cases + 2 structural-guard cases + missing-manifest case FAIL ...]
1

$ python3 execution/checks/verify_triad_kinds_declared.py; echo $?
  FAIL execution/verify_triad_coverage.py exists  missing ... -- not yet implemented by @dev
  [... 3 fixture-contract cases FAIL ...]
1

$ grep -n "browser_deployed_check" execution/contract.py; echo "grep exit: $?"
grep exit: 1
$ grep -n "gws_inbox_check" execution/contract.py; echo "grep exit: $?"
grep exit: 1
```

All five assertions genuinely fail against unmodified current code — none is
satisfiable by doing nothing. See `contract-f1.yaml` assertions A1-A9 for the
full mapping (A1/A2 are the two RED grep checks above; A3-A9 exercise the three
Python discriminator/linter checks, which subsume the exit-code detail shown
here per-case).

## Upstream — what's PR-able to InunuNet/Athanor vs. SAOC-specific

Per the standing rule (harness improvements get fixed locally *and* proposed
upstream — precedent `InunuNet/Athanor#1357` shipped `codex_qa.sh` + the
`codex_qa` assertion kind):

**Generic, PR-able as-is:**
- The `browser_deployed_check` / `gws_inbox_check` *mechanism*: manifest-artefact
  + structural-verification + independent-re-check pattern, the commit/time
  dual-binding staleness guard, and the exit 0/1/2 contract mirroring `codex_qa`.
- `execution/verify_triad_coverage.py`'s classify-by-path-substring +
  require-declared-kinds mechanism, parameterised by which kinds are "required"
  (a project without a `gws`-equivalent tool shouldn't be forced to adopt this
  literal kind name).

**SAOC-specific, must NOT go upstream as-is:**
- The hardcoded deployed origin `beta.saoc.co.za` and the `*.hosted.app`/
  `*.run.app` denylist (Firebase App Hosting / Cloud Run artifacts specific to
  this project's hosting choice) — upstream version needs this as a project-level
  config value, not a literal.
- The `gws` CLI dependency itself — upstream needs this behind a pluggable
  "mailbox read-only verifier" interface, since not every downstream project has
  `gws` (or any mail tool) installed.

## Known limitations (ship these honestly, don't discover them in production)

- Independent re-check at gate time proves the claimed origin/message currently
  exists and is live — it does not prove the *original* browser/gws run actually
  drove that specific interaction (no pixel-level screenshot diff, no proof the
  screenshot file's *content* matches what a real render of that page produces
  today). A sufficiently motivated bad actor with write access to the manifest
  and a stale-but-still-live screenshot could still fabricate a pass. Closing
  this fully needs a follow-up (screenshot content-hash pinned to a fresh
  Playwright render at check time) — out of scope for this mission.
- The read-only structural guard is static analysis of the script's own source,
  not a runtime sandbox. A sufficiently obfuscated future edit to the script
  (e.g. base64-encoded subcommand string) could defeat the token grep. This is
  a real gap; mitigation is code review on any change to
  `execution/gws_inbox_check.sh`, same as any other security-relevant file.
- The triad-coverage linter's path-substring heuristic (see design answer 5) has
  documented false-negative and false-positive shapes above.

## M2/F2 addendum -- wiring the linter into the real gate path

F1 built `verify_triad_coverage.py` but nothing forced any contract to run it.
F2 (`contract-f2.yaml`) closes that: the linter runs as a real preflight inside
`execution/contract.py`'s `gate_cmd()`, after the dataset-residue preflight and
before `_gate_dispatch()`, for all four real gate entry points (see
`.agent/memory/scratch/research-f2-triad-gate-wiring.md`). Full decisions and
rationale live in `contract-f2.yaml`'s `goal:` field; summary:

- **Fail-closed** on a triad-linter infra error (`TRIAD_PREFLIGHT_ERROR_EXIT_CODE`
  = 7) -- deliberately the opposite of the residue guard's fail-open precedent,
  because the linter has zero external dependencies and this mission's whole
  point is not repeating F1's "missing tool silently degrades to PASS" defect.
- **Rollout via a hashed baseline**: `execution/triad-baseline-exempt.txt`
  (plain path list, reused as-is from the prior architect pass) grandfathers
  the 32 pre-existing noncompliant contracts; `execution/triad-baseline-exempt.sha256`
  pins each one's content, so an edit to a baselined contract re-arms
  enforcement instead of exempting it forever. `TRIAD_ENFORCEMENT_EXIT_CODE`
  = 6 for a confirmed, non-grandfathered noncompliant contract.
- **`phases_raw`/`phases` classification fix**: a contract authored entirely
  in the raw `phases: {...}` dict shape is no longer invisible to the linter
  (was silently `EXEMPT`; must now correctly `PASS`/`FAIL`).
- **`template/execution/` is out of scope** for this feature -- it is this
  project's seed copy of the upstream Athanor harness, not a second
  production gate path. Flagged as an upstream-PR item, not silently dropped.

New goldens: `f2_broken_linter_stub.sh` (infra-error fixture, exits 9). New
checks: `verify_f2_baseline_hash_consistency.py`, `verify_f2_preflight_ordering.py`,
`verify_f2_gate_enforcement.sh` (real `contract.py gate` subprocess calls, three
baseline scenarios), `verify_f2_triad_failclosed.sh`. All were run against the
current, unimplemented gate path and fail RED for the intended reason (missing
wiring/files), never a crash -- see the architect's report for the captured
transcript.
