#!/usr/bin/env bash
# verify_venv_python_resolution_1289.sh -- golden-file behavioral check for GitHub issue #1289.
#
# Bug: execution/contract.py's check_cmd() (and its identical twin in
# template/execution/contract.py -- NOT auto-synced with execution/, per the #1288 lesson,
# independently confirmed here to carry the identical vulnerable line) builds and runs
# `kind: shell` assertion commands via:
#   subprocess.run(actual_cmd, shell=True, capture_output=True, text=True,
#                   timeout=timeout, executable="/bin/bash")
# with NO env= override at all. This means bare `python3`/`pip` invocations inside an
# assertion's `cmd` string resolve via whatever PATH the shell that invoked `contract.py`
# itself happens to have -- NOT the target project's own `.venv`, even when
# `<project_root>/.venv/bin/python3` exists. A contract asserting installed-package state
# (e.g. a CVE-fix version bump) silently checks the WRONG interpreter when the invoking
# shell doesn't have the project's .venv activated, producing false negatives/positives
# unrelated to whether the actual fix is correct. Reproduced concretely downstream
# (Alembic): an assertion verifying an installed aiohttp CVE-fix version failed under
# system Python (old aiohttp) even though the project's own .venv had the fix and was what
# the live service actually ran.
#
# Fix contract (locked convention this script enforces): when constructing the environment
# for a `kind: shell` assertion's subprocess, if `<cwd>/.venv/bin/python3` exists (cwd =
# the directory contract.py is invoked from, the only "project root" signal available in
# the current CLI -- there is no --project-root flag), prepend `<cwd>/.venv/bin` to PATH
# in the subprocess's environment so bare `python3`/`pip` resolve to the venv's
# interpreter. This must NOT rewrite or substitute any interpreter path the assertion's
# own `cmd` string ALREADY hardcodes explicitly (e.g. `/usr/bin/python3` or any other
# fully-qualified path) -- only bare-name PATH resolution is affected. When no
# `.venv/bin/python3` exists under cwd, behavior must be completely unchanged: ambient
# PATH exactly as today, no env= override at all.
#
# This script drives the REAL execution/contract.py (or its template/ twin with
# --template) `check` subcommand end-to-end against isolated fixture projects containing
# their own `.venv/bin/python3` shim and a throwaway contract.yaml with a `kind: shell`
# assertion -- same fixture-isolation convention as
# execution/checks/verify_autonomy_type_guard_1288.sh -- so no real repo state, real
# .venv, or real Python environment is ever touched.
#
# Usage: verify_venv_python_resolution_1289.sh <case> [--template]
#   venv_bare_python_resolved   - GOLDEN / headline bug repro: fixture project has
#                                 .venv/bin/python3 with a package importable ONLY there
#                                 (not on ambient/system PATH). Assertion cmd is bare
#                                 `python3 -c "import goldenpkg_1289"`. Must resolve to
#                                 the .venv's python and PASS. Currently FAILS (ambient
#                                 PATH is used, package not found) -- must PASS after fix.
#   no_venv_ambient_unchanged  - REGRESSION GUARD: no .venv directory present at all.
#                                Bare `python3` assertion must behave exactly as today,
#                                using ambient PATH. PASSES both before and after the fix.
#   non_python_shell_unaffected - REGRESSION GUARD: .venv/bin/python3 IS present, but the
#                                assertion's cmd is a pure grep/test shell command that
#                                never invokes python3/pip at all. Must run correctly,
#                                completely unaffected by the fix. PASSES both before and
#                                after.
#   explicit_path_not_overridden - TRAP: .venv/bin/python3 IS present, but the assertion's
#                                cmd ALREADY hardcodes a fully-qualified interpreter path
#                                (e.g. /usr/bin/python3-golden-1289, a fixture stand-in for
#                                a system interpreter) rather than a bare `python3` name.
#                                The fix must NOT override or rewrite this explicit path --
#                                it must keep resolving to the explicitly-named interpreter,
#                                never redirected to .venv/bin. PASSES both before and after
#                                the fix (must never regress).
#
# Pass --template as a second argument to run the identical case against
# template/execution/contract.py instead of execution/contract.py (confirmed to carry the
# identical shell=True-with-no-env-override line and therefore in scope for the identical
# fix + identical golden coverage).
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CASE="${1:-}"
VARIANT="${2:-}"

if [ "$VARIANT" = "--template" ]; then
  TARGET="$REPO_ROOT/template/execution/contract.py"
else
  TARGET="$REPO_ROOT/execution/contract.py"
fi

if [ ! -f "$TARGET" ]; then
  echo "FAIL: target script not found: $TARGET" >&2
  exit 1
fi

WS="$(mktemp -d)"
cleanup() { /bin/rm -rf "$WS" 2>/dev/null || true; }
trap cleanup EXIT

RESULTS_REL=".agent/memory/scratch/contract-results"
mkdir -p "$WS/$RESULTS_REL"

write_contract() {
  # $1 = assertion cmd (already shell-escaped by caller)
  cat > "$WS/contract.yaml" <<EOF
schema: athanor.contract/v1
spec: golden-fixture-1289
created_at: "2026-07-09"
assertions:
  - id: A1
    description: golden fixture assertion for issue #1289
    verify:
      kind: shell
      cmd: ${1}
phases:
  - id: 1
    assertions: [A1]
EOF
}

run_check() {
  # Runs `contract.py check` FROM inside $WS (so any cwd-relative .venv detection in the
  # eventual fix sees $WS/.venv). contract.py ITSELF is invoked via an absolute interpreter
  # path (whatever the invoking session's python3 resolves to, which has pyyaml installed)
  # so parsing the contract works regardless of PATH scrubbing. The AMBIENT PATH handed to
  # that process -- and therefore inherited by check_cmd()'s shell=True subprocess, which
  # is the actual mechanism under test -- is scrubbed down to a minimal, deterministic
  # value that deliberately EXCLUDES $WS/.venv/bin, isolating the fixture from the real
  # invoking session's own ambient PATH (which may or may not already have some unrelated
  # .venv active).
  local real_python3
  real_python3="$(command -v python3)"
  ( cd "$WS" && env -i PATH="/usr/bin:/bin" HOME="$HOME" \
      "$real_python3" "$TARGET" check contract.yaml --assertion A1 )
}

case "$CASE" in

  venv_bare_python_resolved)
    # .venv/bin/python3 shim: only IT can "import goldenpkg_1289". Bare system python3 on
    # ambient PATH cannot.
    mkdir -p "$WS/.venv/bin"
    cat > "$WS/.venv/bin/python3" <<'SHIM'
#!/usr/bin/env bash
if [ "$1" = "-c" ]; then
  case "$2" in
    *goldenpkg_1289*) exit 0 ;;
  esac
fi
exec /usr/bin/python3 "$@"
SHIM
    chmod +x "$WS/.venv/bin/python3"
    write_contract 'python3 -c "import goldenpkg_1289"'
    if run_check; then
      echo "PASS: venv_bare_python_resolved -- bare python3 resolved to .venv, package found"
      exit 0
    else
      echo "FAIL: venv_bare_python_resolved -- bare python3 did not resolve to .venv's interpreter"
      exit 1
    fi
    ;;

  no_venv_ambient_unchanged)
    # No .venv at all. Assertion checks for a package that is NOT importable anywhere --
    # must fail exactly as today (ambient PATH, no .venv to prefer).
    write_contract 'python3 -c "import goldenpkg_1289"'
    if run_check; then
      echo "FAIL: no_venv_ambient_unchanged -- assertion unexpectedly passed with no .venv present"
      exit 1
    else
      echo "PASS: no_venv_ambient_unchanged -- ambient PATH used, behavior unchanged, no .venv to prefer"
      exit 0
    fi
    ;;

  non_python_shell_unaffected)
    # .venv/bin/python3 present, but assertion never touches python3/pip at all.
    mkdir -p "$WS/.venv/bin"
    cat > "$WS/.venv/bin/python3" <<'SHIM'
#!/usr/bin/env bash
exec /usr/bin/python3 "$@"
SHIM
    chmod +x "$WS/.venv/bin/python3"
    printf 'marker-1289-present\n' > "$WS/fixture_1289.txt"
    write_contract 'grep -q marker-1289-present fixture_1289.txt'
    if run_check; then
      echo "PASS: non_python_shell_unaffected -- pure grep assertion ran correctly, unaffected by .venv presence"
      exit 0
    else
      echo "FAIL: non_python_shell_unaffected -- pure grep assertion broke with .venv present"
      exit 1
    fi
    ;;

  explicit_path_not_overridden)
    # .venv/bin/python3 present (and would satisfy the bare-name case), but the
    # assertion's cmd already hardcodes a FULLY-QUALIFIED, different interpreter path.
    # That explicit path must keep being used verbatim -- never redirected to .venv.
    mkdir -p "$WS/.venv/bin" "$WS/fake_system_bin"
    cat > "$WS/.venv/bin/python3" <<'SHIM'
#!/usr/bin/env bash
# .venv's python3: WOULD find goldenpkg_1289 if bare `python3` were (wrongly) redirected here.
if [ "$1" = "-c" ]; then
  case "$2" in
    *goldenpkg_1289*) exit 0 ;;
  esac
fi
exec /usr/bin/python3 "$@"
SHIM
    chmod +x "$WS/.venv/bin/python3"
    cat > "$WS/fake_system_bin/python3-golden-1289" <<'SHIM'
#!/usr/bin/env bash
# Explicit fully-qualified fixture interpreter: does NOT have goldenpkg_1289 importable.
if [ "$1" = "-c" ]; then
  case "$2" in
    *goldenpkg_1289*) exit 1 ;;
  esac
fi
exit 0
SHIM
    chmod +x "$WS/fake_system_bin/python3-golden-1289"
    write_contract "$WS/fake_system_bin/python3-golden-1289 -c \"import goldenpkg_1289\""
    if run_check; then
      echo "FAIL: explicit_path_not_overridden -- explicit interpreter path was overridden/redirected to .venv"
      exit 1
    else
      echo "PASS: explicit_path_not_overridden -- explicit fully-qualified interpreter path honored as-is, not redirected"
      exit 0
    fi
    ;;

  *)
    echo "FAIL: unknown case '$CASE'" >&2
    echo "Usage: $0 <case> [--template]" >&2
    exit 1
    ;;
esac
