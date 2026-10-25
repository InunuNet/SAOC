# harness-gate-hooks goldens

Feature M1-F1. Unpin `execution/contract.py` from `.agent/no-update` by moving its two local gate
behaviours (dataset-residue guard, verification-triad coverage preflight) into Athanor 3.8.68
project-owned `gate_hooks`, declare the two triad kinds as project kinds, install the stock gate,
and prove the stock gate still blocks what the pinned copy blocked.

Base commit: `5165668d` (Athanor 3.8.68 already committed on `chore/harness-3.8.66`).

## Files

| golden | role |
|---|---|
| `registry.expected.json` | exact expected `.agent/contract_kinds.json` (compared semantically with `execution/checks/json_equal.py`) |
| `scenario-matrix.json` | oracle for the proof runner: 16 scenarios, expected exit code, expected `--report-json` phases, required and forbidden stdout |
| `fixtures/*.yaml` | throwaway contracts the runner copies into a fixture project (`${SANDBOX}` / `${REPO}` tokens are substituted at copy time) |
| `fixtures/stubs/*.sh` | stub scripts: `pass.sh` exit 0, `fail.sh` exit 1, `err.sh` exit 2, `linter_oob.sh` exit 5 |
| `harness-untouched.allowlist.txt` | the only harness-owned paths this feature may change versus the base commit |

## Where the new SAOC files live, and why

`.agent/update-manifest.yaml` marks `execution/` HARNESS wholesale, and `scripts/checks/triad-baseline-exempt.txt`
already records the project's decision to keep project data out of it. So:

- `scripts/gate-hooks/residue_hook.py` and `scripts/gate-hooks/triad_hook.py` (project-owned `scripts/`, not in the manifest).
- `scripts/gate-hooks/checks/prove_gate_hooks.py` and `scripts/gate-hooks/checks/verify_harness_untouched.sh`.
- `.agent/contract_kinds.json` (WORKSPACE per the directive; updates never touch it).
- `docs/gate-hooks.md` (project doc).

Unchanged and still where they are: `execution/verify_triad_coverage.py` (linter),
`execution/triad-baseline-exempt.{txt,sha256}`, `execution/browser_deployed_check.sh`, `execution/gws_inbox_check.sh`.
Existing SAOC files in `execution/` have survived every update so far (the updater only removes files Athanor itself
shipped and later deleted), so they stay put; moving them is out of scope and would break the 100+ contracts that
name them. Four existing proof scripts in `execution/checks/` are rewritten in place (see below). Hook files are
executable (`chmod +x`, shebang `#!/usr/bin/env python3`); the stock gate execs them directly.

## Hook contract (what dev implements)

Stock semantics (from `template/execution/contract.py`): exit 0 clean, 1 finding, anything else, a timeout or a
spawn failure is an infrastructure error. Hook cwd is the project root (nearest ancestor of the contract holding
`.agent/`). `{contract}` is substituted as an absolute path. stdout and stderr are printed by the gate.

Both wrappers derive `REPO_ROOT` from their own location (`Path(__file__).resolve().parents[2]`), never from cwd,
so a fixture project (cwd elsewhere) still finds the scanner, the linter and the real node_modules.

### residue_hook.py (no arguments; registered as `residue-pre` and `residue-post`)
- Run, with cwd `REPO_ROOT`: `node --import tsx/esm scripts/scan-dataset-residue.ts`, plus `--fixture <value>` when env
  `CONTRACT_GATE_RESIDUE_FIXTURE` is set (identical invocation to the pinned copy; fixture paths resolve against `REPO_ROOT`).
  Internal subprocess timeout 120s (registry timeout 300s is the outer bound).
- Forward the scanner's stdout and stderr.
- Scanner exit 0: exit 0.
- Scanner exit nonzero AND its stdout contains the exact marker `FAIL: found`: print a banner containing `RESIDUE ALERT`, exit 1.
- Scanner exit nonzero without the marker, a timeout, or a failure to spawn: print a banner containing `RESIDUE GUARD ERROR`, exit 2.
  (The scanner exits 1 for both a finding and a crash; the marker is the only ground truth.)

### triad_hook.py (argument: contract path; registered as `triad-coverage`, pre, closed)
Port `_run_triad_coverage_preflight` + `_triad_contract_is_grandfathered` + the baseline loaders from the pinned
`execution/contract.py` (lines ~858-1049) with the exit codes remapped:
- Linter = env `TRIAD_LINTER_SCRIPT_OVERRIDE` else `REPO_ROOT/execution/verify_triad_coverage.py`, invoked by its own path (not via
  `sys.executable`, so a bash stub works), timeout 30s, called with the contract path.
- Linter exit 0 (PASS or EXEMPT): print its output, exit 0. The baseline is NOT read on this path.
- Linter exit outside {0, 1}, missing script, spawn failure, timeout: print `TRIAD PREFLIGHT ERROR`, exit 2.
- Linter exit 1: consult the baseline.
  - Baseline file = env `TRIAD_BASELINE_FILE` else `REPO_ROOT/execution/triad-baseline-exempt.txt`; pin file = env
    `TRIAD_BASELINE_HASH_FILE` else `REPO_ROOT/execution/triad-baseline-exempt.sha256`. Env replaces, never unions.
  - Missing baseline file means empty baseline (not an error). Unreadable (`OSError`, `UnicodeDecodeError`, a directory): print
    `TRIAD PREFLIGHT ERROR`, exit 2. Same for an unreadable pin file, but only once the contract is found listed.
  - The contract's key is its path relative to cwd (the project root), e.g. `contracts/c5-submit-event.yaml`.
  - Grandfathered iff key is listed AND pinned AND `sha256(file bytes at cwd/key)` equals the pin. Then print a line containing
    `grandfathered`, exit 0.
  - Otherwise print `TRIAD PREFLIGHT BLOCKED`, exit 1.
- `#`-comments and blank lines are ignored in both files; pin lines are `<sha256>  <path>`. Same parsing as the pinned copy.
- No traceback may ever escape: every I/O path is caught and mapped to exit 2.

### Registry
Exactly `registry.expected.json`: order matters (residue pre, then triad pre, then residue post).
`kinds` carries the two triad kinds with the pinned defaults (`execution/<kind>.sh`, 200s). `codex_qa` is a built-in; do not register it.

## Runner contract: `scripts/gate-hooks/checks/prove_gate_hooks.py <scenario>`

Exit 0 every expectation met; exit 1 an expectation mismatch (print which); exit 2 usage/harness error (unknown scenario,
missing golden). The runner reads `scenario-matrix.json` and never embeds expectations.

Per scenario:
1. Fixture project `REPO/.tmp/sandbox/gate-hooks-proof/<scenario>/` (recreated each run; removed on success with
   `execution/safe_delete.py`): an empty `.agent/` dir; `.agent/contract_kinds.json` generated from the REAL
   `.agent/contract_kinds.json` with every relative `command[0]` rewritten to an absolute path under `REPO`; `stubs/` copied from
   `goldens/fixtures/stubs/`; the scenario contract copied to `c.yaml` with `${SANDBOX}` and `${REPO}` substituted.
2. `prepare` steps (`copy`) run. Env = caller env minus every `TRIAD_*` and `CONTRACT_GATE_RESIDUE_FIXTURE`, plus
   `CONTRACT_GATE_RESIDUE_FIXTURE` defaulting to `defaults.residue_fixture` (so NO scenario ever touches live Sanity), plus the
   scenario `env` (tokens substituted).
3. `triad_baseline` mode, written under the sandbox, sets `TRIAD_BASELINE_FILE` / `TRIAD_BASELINE_HASH_FILE`; the listed key is `c.yaml`:
   `empty` (empty files), `listed_pinned` (listed, pin = sha256 of c.yaml), `listed_pinned_then_edited` (as previous, then append a
   comment line to c.yaml), `listed_unpinned` (listed, empty pin file), `dir` (baseline file is a directory), `bad_utf8` (baseline
   file is the bytes `ff fe fd`), `hash_dir` (listed, pin file is a directory).
4. Run `python3 REPO/execution/contract.py gate SANDBOX/c.yaml --phase 4 --run-checks --report-json SANDBOX/report.json` with cwd `REPO`.
5. Check `expect`: `exit`; every entry of `phases` is a subset match against the report phase with the same `phase` string; if
   `no_phase_prefix` is set, no report phase starts with it; `overall`; every `stdout_contains` substring present in stdout+stderr and every
   `stdout_absent` substring absent.
6. Negative control: if env `GATE_HOOKS_PROOF_NEUTER=1`, step 1 replaces every hook command in the generated registry with
   `["/usr/bin/true"]` (clean, exit 0) before running. The blocking scenarios must then exit 1 (mismatch). This is what makes the
   proof non-vacuous: it shows the assertion goes red when the hooks do nothing.

`verify_harness_untouched.sh`: `git diff --name-only 5165668d -- execution template init.sh Makefile .claude/hooks .agent/agents .agent/rules .agent/skills .agent/workflows`
minus the lines in `harness-untouched.allowlist.txt` must be empty; exit 1 and list offenders otherwise. Staged and unstaged
changes count (diff against the base commit, not HEAD).

## Existing proofs to rewrite in place (not delete)

They assert the pinned gate's custom exit codes (RESIDUE 4, TRIAD 6, TRIAD error 7) or call pinned-only internals. Rewrite each to prove
the same behaviour through the stock gate plus the hooks, with the stock semantics (block = exit 1 finding / exit 2 infrastructure):
- `execution/checks/verify_gate_residue_preflight.py` (dirty blocks before any assertion, clean proceeds, crash fails open)
- `execution/checks/verify_f2_gate_enforcement.sh` (not baselined blocks, baselined unedited warns, baselined then edited blocks)
- `execution/checks/verify_f2_triad_failclosed.sh` (broken linter, missing linter: closed)
- `execution/checks/verify_f2_baseline_loading_failclosed.sh` (directory baseline, directory pins, invalid UTF-8: closed)
Run them from a fixture project (as the runner does) or against the real repo with env overrides, but they must pass under stock `contract.py`.
Dependency scan result (grep over `execution/`, `scripts/`, `.github/`, `contracts/`, `package.json`, `docs/`): these four are the ONLY
consumers of the custom codes. `.github/workflows/*` never calls `contract.py`. `scripts/checks/gate-m1.sh` only exports
`TRIAD_BASELINE_FILE` / `TRIAD_BASELINE_HASH_FILE` and runs `mission.py gate`; it keeps working because the hook inherits that env.

## Accepted behavioural differences (stock semantics)

1. Residue finding exits the gate with 1 (was 4); triad finding exits 1 (was 6); triad infrastructure error exits 2 (was 7).
2. A failing `browser_deployed_check` / `gws_inbox_check` in a specific-phase gate exits 2 (the pinned copy exited 1); only `codex_qa`
   findings map to 1 in the stock gate.
3. Residue and triad findings are now recorded in `--report-json` as phases `hooks-pre` / `hooks-post`.
4. Stock hooks run only after the contract validates and `gate` preflight passes; they do not run for `validate`, `check` or `report`.
5. Stock `validate` is stricter than the pinned copy. Measured on 2026-10-25 with the registry in place: 17 more completed-mission
   spec contracts fail validate than before (29 vs 12 of 263 under `.agent/memory/project/specs/`), and 20 of 104 under `contracts/`
   fail `validate --strict` (schema drift: unknown top-level keys, missing `created_at`, no `command:`). `verify_all_contracts_validate.py`
   was already red under the pinned copy (12 failures); it gets redder. Not fixed here (retiring or repairing historic contracts is a
   separate decision). Any contract an agent gates NEXT must validate; this feature's own contract is checked by A8.

## Baseline-red: how every assertion fails before the change

State before: pinned `execution/contract.py` listed in `.agent/no-update`, no `.agent/contract_kinds.json`, no `scripts/gate-hooks/`,
no `docs/gate-hooks.md`, four proof scripts asserting the old codes.

| id | red before because |
|---|---|
| A1 | `execution/contract.py` is still listed in `.agent/no-update` |
| A2 | the pinned file differs from `template/execution/contract.py` (cmp exit 1; 1230 vs 2230 lines) |
| A3 | `.agent/contract_kinds.json` does not exist (json_equal raises) |
| A4, A5 | the hook scripts do not exist |
| A6, A7 | these exist today; they are regression guards, green before and after (they pin that dev did not move the kind scripts) |
| A8 | green before and after (the contract validates under the pinned copy); after the swap it proves the stock validator accepts it |
| A10-A25 | runner script does not exist (exit 2). Behaviourally, even with the runner: the pinned gate does not know `--report-json` at all (verified 2026-10-25: argparse usage error, exit 2, no report written), so every scenario fails before reaching a hook |
| A30-A39 | the neutered runs: red before because the runner is missing exits 2, and the control requires exactly 1. After the change they are green only if the hooks are what blocks (neutered hooks let the gate pass, so the scenario expectation mismatches, exit 1) |
| A40-A43 | NOT red at base: the four legacy proofs pass under the pinned gate (marked `nonvacuous: false`, as are A6, A7, A8, A48). They guard that the rewritten proofs keep passing under the stock gate; they go red the instant the pin is dropped without rewriting them (they assert exit 4/6/7). Blocking-behaviour non-vacuity is carried by A10-A39. A grep for the old constants is deliberately NOT an assertion: stock `validate --strict` rejects grep-over-verifier-source as self-referential |
| A45, A46 | docs not written |
| A47 | red if dev edits any harness file other than the allowlist (e.g. hand-patches `execution/contract.py`) |
| A48 | green before and after: the grandfather baseline files are unchanged versus base (guards against editing the baseline to make a scenario pass) |
| A49 | the real-baseline smoke: the hook does not exist before; after, `contracts/c5-submit-event.yaml` (listed and pinned in the real baseline, unedited, linter exit 1) must report `grandfathered` |

Non-vacuity of the negative scenarios is A30-A39 (neutered hooks) and nothing else; do not weaken them.

## Known: stock validate stricter

Stock validate is stricter than the pinned copy: 29/263 spec contracts and 20/104 `contracts/` files fail. Not this feature's scope; recorded as a backlog item by the lead.
