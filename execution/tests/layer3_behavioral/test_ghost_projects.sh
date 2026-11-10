#!/usr/bin/env bash
# Ghost project discovery runner — runs run_tests.sh in every ghost project directory.
# Usage: bash execution/tests/layer3_behavioral/test_ghost_projects.sh
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
GHOST_ROOT="$REPO_ROOT/execution/tests/ghost-project"

PASS=0; FAIL=0; SKIP=0
WIN_SKIP=""

# Native Windows python writes CRLF and cp1252 to pipes, so every ghost's LF/UTF-8 fixture
# comparison failed (Athanor Win 2026-11-07: 6/43). Ghosts get LF, UTF-8 stdio there.
case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
        SHIM_DIR="$REPO_ROOT/.tmp/sandbox/ghost-win-shim"
        mkdir -p "$SHIM_DIR"
        printf '%s\n' 'import sys' \
            'for _s in (sys.stdout, sys.stderr):' \
            '    if hasattr(_s, "reconfigure"):' \
            '        _s.reconfigure(newline="\n")' > "$SHIM_DIR/sitecustomize.py"
        export PYTHONPATH="$SHIM_DIR${PYTHONPATH:+:$PYTHONPATH}"
        export PYTHONUTF8=1
        # Ghosts that need what Windows does not give an unprivileged user.
        WIN_SKIP="argus:os.symlink needs SeCreateSymbolicLinkPrivilege (Developer Mode)
escrow:reads /proc/self/fd/0, which Windows has no equivalent of"
        ;;
esac

for test_script in "$GHOST_ROOT"/*/tests/run_tests.sh; do
    [ -f "$test_script" ] || continue
    project="$(basename "$(dirname "$(dirname "$test_script")")")"
    printf "  [ghost/%s] " "$project"
    reason="$(printf '%s\n' "$WIN_SKIP" | sed -n "s/^$project://p")"
    if [ -n "$reason" ]; then
        echo "SKIP on Windows: $reason"
        ((SKIP++))
        continue
    fi
    if bash "$test_script" > /tmp/ghost_${project}.log 2>&1; then
        echo "PASS"
        ((PASS++))
    else
        echo "FAIL"
        ((FAIL++))
        tail -10 /tmp/ghost_${project}.log
    fi
done

echo ""
echo "----------------------------"
echo "Results: $PASS passed, $FAIL failed, $SKIP skipped"

[ "$FAIL" -eq 0 ]
