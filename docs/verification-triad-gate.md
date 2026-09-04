# Verification Triad Gate

Mission `verification-triad-gate`, M1/F1. Commits `6615513a`, `f8c8dd7a`.

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

## What these checks CANNOT prove

Per this project's standing rule (name the limitation, don't paper over it):

- **The coverage linter is not wired into any gate path. This is the mission's headline
  requirement and it is NOT delivered.** `execution/skills/quick_gate.sh:57` and
  `execution/contract.py`'s `gate_cmd` (~line 926) never invoke
  `execution/verify_triad_coverage.py`. The two new assertion kinds are enforced *once a contract
  declares them* — nothing yet forces any contract to declare them. A future UI/workflow contract
  can still reach a fully green gate with no browser check and no inbox check, exactly as before
  the SITE_URL incident, unless whoever writes that contract volunteers the linter as one of its
  own assertions. Wiring this in is deferred as M2 (see the mission file) because it applies
  retroactively to every existing contract in the repo — most of which declare no triad kinds —
  and risks turning the whole suite red without `@architect` scoping first. **Do not read this
  doc as "the triad is enforced." It is available and correct; declaring it is still voluntary.**
- **`phases:`-dict-shaped contracts are invisible to the linter.** `verify_triad_coverage.py`'s
  `iter_assertions_with_shape()` also reads `contract.get("phases_raw")`, but that key only
  exists *after* `execution/contract.py`'s own internal normalisation — a standalone run of the
  linter against an author-written contract in the `phases:` dict shape never populates it, so
  such a contract is invisible to the linter entirely. This is a false-negative (the linter says
  nothing, rather than falsely certifying compliance), so it is lower-severity than a false
  pass, but it means real coverage is narrower than the linter's exit code implies.
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
- Spec: `.agent/memory/project/specs/verification-triad-gate/goldens/README.md`
- Contract: `.agent/memory/project/specs/verification-triad-gate/contract-f1.yaml`
- Mission file: `.agent/memory/project/missions/2026-09-03-verification-triad-gate.md`
