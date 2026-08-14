#!/usr/bin/env bash
# verify_f1_no_regression.sh -- golden-file regression check for mission
# verification-integrity F1 (GH #1322): distinct SKIP status for contract.py
# kind:shell assertions, gate-level skip blocking, and per-check required:true.
#
# Two scenarios, both old-vs-new (pre-patch HEAD contract.py vs the patched
# working-tree contract.py) comparisons against REAL, pre-existing contracts:
#
#   (default / argless -- A9) running `gate --phase 4 --run-checks` for the
#     CURRENT working-tree (patched) execution/contract.py against 2
#     known-stable pre-existing real contracts
#     (harness-integrity-hardening/contract-f3.yaml,
#     enforce-contract-gate/contract-f1.yaml -- neither uses exit-77 or
#     skip-producing kinds) must produce the IDENTICAL exit code as running
#     the pre-patch execution/contract.py (git show HEAD:execution/contract.py)
#     against the same two contracts -- proves the fix introduces no
#     unintended verdict change for ordinary all-pass contracts.
#
#   validate_parity_full_corpus -- A10: old-vs-new `validate --strict` parity
#     across the FULL contract corpus (all .agent/memory/project/specs/**/
#     contract*.yaml files, ~173 as of this investigation). `validate` only
#     parses+reports and never executes check commands, so -- unlike A9,
#     which runs real check-script commands via `gate --run-checks` and must
#     stay narrow -- this can safely span the whole corpus. Parity is
#     RELATIVE: if old and new both exit nonzero (invalid) for a contract,
#     that IS parity, not a failure -- 18 of 173 contracts are already known
#     to fail --strict under HEAD for reasons unrelated to this feature. Only
#     a DIVERGENCE (one valid, one invalid, or a changed assertion count for
#     a jointly-valid contract) fails. On divergence, the specific contract
#     path(s) and old-vs-new output are printed.
#
# Sandbox isolation: both scenarios run inside a symlink-mirror of the repo
# (so relative check-command paths like "execution/checks/..." still
# resolve for A9's real check-script commands) that:
#   - substitutes execution/contract.py explicitly per sandbox (old vs new)
#   - gives .agent/memory/scratch/contract-results a FRESH, EMPTY, real
#     directory in each sandbox -- never linked to the real repo's, so no
#     run here can write into or delete anything under the real
#     .agent/memory/scratch/contract-results/ for ANY slug
#   - deliberately OMITS .git entirely (not symlinked, not copied). Some
#     real contracts' assertions shell out to `git diff` etc.; multiple
#     agents may be running concurrent git operations against the live repo
#     in this session, and even read-only git commands can transiently write
#     .git/index.lock. Rather than touch the live .git at all, those
#     specific assertions simply fail identically (missing repo context) in
#     BOTH the old and new sandbox -- which still correctly detects any
#     divergence between old and new, the actual thing A9/A10 test for.
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CASE="${1:-}"

# ---------------------------------------------------------------------------
# Symlink-mirror $REPO_ROOT into $1, except:
#   - .git is omitted entirely (see header comment)
#   - execution/contract.py is left OUT of the mirror (caller supplies old
#     or new explicitly into each sandbox after mirroring)
#   - .agent/memory/scratch/contract-results is a fresh, empty, real
#     directory -- never linked to the real repo's
# ---------------------------------------------------------------------------
mirror_scratch() {
  local dest="$1" src="$2"
  mkdir -p "$dest"
  local entry base
  if [ -d "$src" ]; then
    while IFS= read -r -d '' entry; do
      base="$(basename "$entry")"
      if [ "$base" = "contract-results" ]; then
        continue  # never link the real one -- fresh empty dir created below
      fi
      ln -s "$entry" "$dest/$base"
    done < <(find "$src" -mindepth 1 -maxdepth 1 -print0)
  fi
  mkdir -p "$dest/contract-results"
}

mirror_agent_memory() {
  local dest="$1" src="$2"
  mkdir -p "$dest"
  local entry base
  while IFS= read -r -d '' entry; do
    base="$(basename "$entry")"
    if [ "$base" = "scratch" ]; then
      mirror_scratch "$dest/scratch" "$entry"
    else
      ln -s "$entry" "$dest/$base"
    fi
  done < <(find "$src" -mindepth 1 -maxdepth 1 -print0)
}

mirror_agent() {
  local dest="$1" src="$2"
  mkdir -p "$dest"
  local entry base
  while IFS= read -r -d '' entry; do
    base="$(basename "$entry")"
    if [ "$base" = "memory" ]; then
      mirror_agent_memory "$dest/memory" "$entry"
    else
      ln -s "$entry" "$dest/$base"
    fi
  done < <(find "$src" -mindepth 1 -maxdepth 1 -print0)
}

mirror_execution() {
  local dest="$1" src="$2"
  mkdir -p "$dest"
  local entry base
  while IFS= read -r -d '' entry; do
    base="$(basename "$entry")"
    if [ "$base" = "contract.py" ]; then
      continue  # caller substitutes old/new explicitly
    fi
    ln -s "$entry" "$dest/$base"
  done < <(find "$src" -mindepth 1 -maxdepth 1 -print0)
}

mirror_repo() {
  local dest="$1"
  mkdir -p "$dest"
  local entry base
  while IFS= read -r -d '' entry; do
    base="$(basename "$entry")"
    case "$base" in
      .git)
        continue  # never link the live .git -- see header comment
        ;;
      .agent)
        mirror_agent "$dest/.agent" "$entry"
        ;;
      execution)
        mirror_execution "$dest/execution" "$entry"
        ;;
      *)
        ln -s "$entry" "$dest/$base"
        ;;
    esac
  done < <(find "$REPO_ROOT" -mindepth 1 -maxdepth 1 -print0)
}

case "$CASE" in
  ""|a9_default)
    OLD_SANDBOX="$(mktemp -d)"
    NEW_SANDBOX="$(mktemp -d)"
    mirror_repo "$OLD_SANDBOX"
    mirror_repo "$NEW_SANDBOX"
    git -C "$REPO_ROOT" show HEAD:execution/contract.py > "$OLD_SANDBOX/execution/contract.py"
    cp "$REPO_ROOT/execution/contract.py" "$NEW_SANDBOX/execution/contract.py"

    CONTRACTS=(
      ".agent/memory/project/specs/harness-integrity-hardening/contract-f3.yaml"
      ".agent/memory/project/specs/enforce-contract-gate/contract-f1.yaml"
    )

    FAILED=0
    for c in "${CONTRACTS[@]}"; do
      OLD_OUT="$(cd "$OLD_SANDBOX" && python3 execution/contract.py gate "$c" --phase 4 --run-checks 2>&1)"
      OLD_RC=$?
      NEW_OUT="$(cd "$NEW_SANDBOX" && python3 execution/contract.py gate "$c" --phase 4 --run-checks 2>&1)"
      NEW_RC=$?
      if [ "$OLD_RC" != "$NEW_RC" ]; then
        echo "FAIL: exit-code divergence for $c -- old(HEAD)=$OLD_RC new(working-tree)=$NEW_RC" >&2
        echo "--- OLD output ---" >&2
        echo "$OLD_OUT" >&2
        echo "--- NEW output ---" >&2
        echo "$NEW_OUT" >&2
        FAILED=1
      fi
    done

    rm -rf "$OLD_SANDBOX" "$NEW_SANDBOX"
    if [ "$FAILED" != "0" ]; then
      exit 1
    fi
    echo "PASS: a9_default -- old(HEAD) and new(working-tree) contract.py agree on exit code for both real contracts (no unintended verdict change)"
    ;;

  validate_parity_full_corpus)
    # `validate` never touches RESULTS_DIR or any other filesystem state
    # besides reading the contract file itself (confirmed: validate_cmd has
    # no write path at all) -- so, unlike A9's `gate --run-checks`, this
    # scenario needs no sandbox mirroring and can run directly against the
    # real repo tree read-only. To stay well under the default per-check
    # 60s timeout across ~173 contracts, this loads old(HEAD) and
    # new(working-tree) contract.py as in-process Python modules once each
    # (via importlib) and calls validate_cmd() directly per file, instead of
    # spawning 2 subprocess python3 interpreters per contract (~350 spawns)
    # -- same validate_cmd code path and same pass/fail semantics, just
    # without per-file interpreter-startup overhead.
    OLD_CONTRACT_DIR="$(mktemp -d)"
    OLD_CONTRACT_PY="$OLD_CONTRACT_DIR/contract_old.py"
    git -C "$REPO_ROOT" show HEAD:execution/contract.py > "$OLD_CONTRACT_PY"

    RESULT="$(python3 - "$OLD_CONTRACT_PY" "$REPO_ROOT/execution/contract.py" "$REPO_ROOT/.agent/memory/project/specs" <<'PYEOF'
import argparse
import contextlib
import importlib.util
import io
import sys
from pathlib import Path


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def run_validate(mod, path):
    buf = io.StringIO()
    ns = argparse.Namespace(contract=str(path), strict=True)
    rc = 0
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        try:
            mod.validate_cmd(ns)
        except SystemExit as e:
            code = e.code
            rc = 0 if code is None else (code if isinstance(code, int) else 1)
    return rc, buf.getvalue()


old_path, new_path, specs_root = sys.argv[1], sys.argv[2], sys.argv[3]
old_mod = load_module(old_path, "f1_contract_old")
new_mod = load_module(new_path, "f1_contract_new")

diverged = []
count = 0
for p in sorted(Path(specs_root).rglob("contract*.yaml")):
    count += 1
    old_rc, old_out = run_validate(old_mod, p)
    new_rc, new_out = run_validate(new_mod, p)
    both_valid = (old_rc == 0 and new_rc == 0)
    if both_valid:
        if old_out != new_out:
            diverged.append((str(p), old_rc, new_rc, old_out, new_out))
    elif (old_rc == 0) != (new_rc == 0):
        diverged.append((str(p), old_rc, new_rc, old_out, new_out))
    # both nonzero (both invalid) is parity -- not a divergence

print(f"COUNT={count}")
for path, old_rc, new_rc, old_out, new_out in diverged:
    print(f"DIVERGE_PATH={path}")
    print(f"DIVERGE_RC old={old_rc} new={new_rc}")
    print("OLD_OUT_START")
    print(old_out)
    print("OLD_OUT_END")
    print("NEW_OUT_START")
    print(new_out)
    print("NEW_OUT_END")

sys.exit(1 if diverged else 0)
PYEOF
)"
    PY_RC=$?
    rm -rf "$OLD_CONTRACT_DIR"

    echo "$RESULT"
    COUNT="$(echo "$RESULT" | grep -m1 '^COUNT=' | cut -d= -f2)"

    if [ -z "$COUNT" ] || [ "$COUNT" -lt 100 ]; then
      echo "FAIL: only found ${COUNT:-0} contract*.yaml files under specs/ -- expected ~173, corpus discovery is broken" >&2
      exit 1
    fi

    if [ "$PY_RC" != "0" ]; then
      echo "FAIL: validate --strict parity diverged (old(HEAD) vs new(working-tree)) for the DIVERGE_PATH entries above" >&2
      exit 1
    fi

    echo "PASS: validate_parity_full_corpus -- $COUNT contracts, old(HEAD) and new(working-tree) contract.py agree on every one (pre-existing invalids agree as invalid, no new divergence)"
    ;;

  *)
    echo "FAIL: unknown case '$CASE' (expected ''|a9_default|validate_parity_full_corpus)" >&2
    exit 1
    ;;
esac
