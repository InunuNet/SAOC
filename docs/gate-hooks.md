# Gate hooks

Mission `harness-gate-hooks`, feature M1-F1. SAOC no longer pins `execution/contract.py`. The two
local behaviours the pinned copy added to `gate` now run as project-owned `gate_hooks` of the stock
Athanor gate (Athanor 3.8.69), and the two triad assertion kinds are registered as project kinds.
Nothing here extends the pinned behaviour; the hooks port it.

## What exists

| File | Role |
|---|---|
| `.agent/contract_kinds.json` | The registry the stock gate reads: two project kinds and three gate hooks. Project-owned; updates never touch it. |
| `scripts/gate-hooks/residue_hook.py` | Dataset-residue guard, registered as `residue-pre` and `residue-post`. |
| `scripts/gate-hooks/triad_hook.py` | Verification-triad coverage preflight, registered as `triad-coverage`. |
| `scripts/gate-hooks/checks/verify_registry_present.py` | Registry tripwire (see below). |
| `scripts/gate-hooks/checks/prove_gate_hooks.py` | Scenario runner for the proof (reads the oracle in the spec goldens). |
| `scripts/gate-hooks/checks/verify_harness_untouched.sh` | Fails if a harness-owned path changed versus base commit `5165668d` outside the allowlist. |
| `scripts/gate-hooks/checks/fixture_project.sh` | Sourced helper that builds a throwaway project with an absolute-path copy of the registry. |
| `execution/checks/verify_gate_residue_preflight.py`, `verify_f2_gate_enforcement.sh`, `verify_f2_triad_failclosed.sh`, `verify_f2_baseline_loading_failclosed.sh` | The four legacy proofs, rewritten in place to prove the same behaviour through the stock gate plus the hooks. |

Unchanged and still in `execution/`: `verify_triad_coverage.py` (the linter),
`triad-baseline-exempt.txt` / `.sha256`, `browser_deployed_check.sh`, `gws_inbox_check.sh`.

## Registry

| Entry | Type | Stage | on_error | Timeout |
|---|---|---|---|---|
| `browser_deployed_check` | kind, `execution/browser_deployed_check.sh` | | | 200s |
| `gws_inbox_check` | kind, `execution/gws_inbox_check.sh` | | | 200s |
| `residue-pre` | hook, `residue_hook.py` | pre | open | 300s |
| `triad-coverage` | hook, `triad_hook.py {contract}` | pre | closed | 30s |
| `residue-post` | hook, `residue_hook.py` | post | open | 300s |

`codex_qa` is a built-in kind and is not registered. Pre hooks run once before any assertion; post
hooks run once after the phases, even when an assertion failed. The hook's cwd is the project root
(the nearest ancestor of the contract holding `.agent/`).

## Registry tripwire

The stock gate treats a missing or unreadable `.agent/contract_kinds.json` as "no hooks" and
proceeds, which would silently disable both guards. `verify_registry_present.py [registry-path]`
exits 0 only if the file exists, parses as a JSON object, and its `schema`, `kinds` and `gate_hooks`
each equal those of `registry.expected.json` with plain `==`: same order, same count, every field
including `timeout_seconds`. Matching by name would let a duplicate, a malformed entry or a shortened
timeout through while the stock gate runs no hooks or lets scans time out and fail open. Other
top-level keys are ignored, as the stock gate ignores them. A violation prints the first differing
path (for example `gate_hooks[0].timeout_seconds`) and exits 1; a usage error exits 2. CI runs it in
the `dataset-residue-guard` job of `.github/workflows/ci.yml`, before the live scan.

## Infrastructure failures never exit 1

Exit 1 from a hook means a confirmed finding and nothing else. Both hooks capture subprocess output
as bytes; output that is not valid UTF-8 is an infrastructure error, and the exit code of such a run
is not trusted. Each hook's `main()` also catches any unexpected exception, prints the matching
banner (`RESIDUE GUARD ERROR` / `TRIAD PREFLIGHT ERROR`) and exits 2. So the residue hook fails
open (warning, gate continues) and the triad hook fails closed (gate exits 2).

Test-only: `RESIDUE_SCANNER_OVERRIDE` names an executable run in place of the node scanner, with the
same arguments (`--fixture <x>` when `CONTRACT_GATE_RESIDUE_FIXTURE` is set). Real runs never set it.

## residue-pre / residue-post

Runs `node --import tsx/esm scripts/scan-dataset-residue.ts` from the repo root (located from the
hook's own path, not cwd), adding `--fixture <value>` when `CONTRACT_GATE_RESIDUE_FIXTURE` is set
(test-only; real runs never set it). The scanner exits 1 for both a finding and a crash, so the
stdout marker `FAIL: found` is the only ground truth.

| Scanner result | Hook prints | Hook exit | Gate result |
|---|---|---|---|
| exit 0 | scanner output | 0 | proceeds |
| nonzero, stdout has `FAIL: found` | `RESIDUE ALERT` | 1 | pre: gate exits 1 before any assertion. post: gate exits 1 if it would otherwise be 0 |
| nonzero without the marker, invalid UTF-8 output, timeout (120s), or spawn failure | `RESIDUE GUARD ERROR` | 2 | `on_error: open`: warning, gate continues |

## triad-coverage

Takes the contract path. Runs `execution/verify_triad_coverage.py` (or
`TRIAD_LINTER_SCRIPT_OVERRIDE`) by its own path with a 30s timeout.

- Linter exit 0 (PASS or EXEMPT): hook exits 0; the baseline is never read.
- Linter exit outside 0/1, missing script, spawn failure, timeout or invalid UTF-8 output: `TRIAD PREFLIGHT ERROR`, exit 2.
- Linter exit 1: the baseline is consulted. Baseline file is `TRIAD_BASELINE_FILE` else
  `execution/triad-baseline-exempt.txt`; pin file is `TRIAD_BASELINE_HASH_FILE` else
  `execution/triad-baseline-exempt.sha256`. An env override replaces the default. A missing baseline
  file is an empty baseline; an unreadable one (directory, invalid UTF-8) is `TRIAD PREFLIGHT ERROR`,
  exit 2, and so is an unreadable pin file once the contract is found listed.
  - The contract is grandfathered only if its path relative to the project root is listed, pinned,
    and the sha256 of its bytes equals the pin. The hook prints a line containing `grandfathered`
    and exits 0.
  - Otherwise `TRIAD PREFLIGHT BLOCKED`, exit 1.

Because the registry sets `on_error: closed`, exit 2 blocks the gate.

## Exit codes: what changed from the pinned gate

| Situation | Pinned gate | Stock gate + hooks |
|---|---|---|
| Residue finding | 4 | 1 |
| Triad finding | 6 | 1 |
| Triad infrastructure error | 7 | 2 |
| Failing `browser_deployed_check` / `gws_inbox_check` in a specific-phase gate | 1 | 2 (only `codex_qa` findings map to 1) |

Also different under the stock gate:

- Hook findings and errors are recorded in `--report-json` as phases `hooks-pre` / `hooks-post`.
- Hooks run only after the contract validates and the gate preflight passes; they do not run for
  `validate`, `check` or `report`.
- Stock `validate` is stricter than the pinned copy. Contracts that passed before can now fail it
  (measured 2026-10-25: 29 of 263 spec contracts, and 20 of 104 under `contracts/` fail
  `validate --strict`). Not repaired here. A contract you gate next must validate.
- `scripts/checks/gate-m1.sh` keeps working: it only exports `TRIAD_BASELINE_FILE` /
  `TRIAD_BASELINE_HASH_FILE`, which the hook inherits.

## Proof

`python3 scripts/gate-hooks/checks/prove_gate_hooks.py <scenario>` builds a fixture project under
`.tmp/sandbox/gate-hooks-proof/<scenario>/`, runs the stock gate there with
`CONTRACT_GATE_RESIDUE_FIXTURE` forced to a local fixture (no scenario touches live Sanity or the
network), and checks the exit code, the report phases and the output against
`.agent/memory/project/specs/harness-gate-hooks/goldens/scenario-matrix.json`. Exit 0 matched, 1
mismatch, 2 usage or harness error.

`GATE_HOOKS_PROOF_NEUTER=1` replaces every hook with `/usr/bin/true`. Under it a blocking scenario
must mismatch (runner exit 1); that is the evidence the hooks, not something else, do the blocking.
The mission contract's A30-A39 run exactly that.
