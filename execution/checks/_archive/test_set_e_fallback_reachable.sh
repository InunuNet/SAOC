#!/usr/bin/env bash
# F3 — fixture test for verify_set_e_fallback_reachable.sh.
# Feeds the checker the PRE-FIX execution/repo_info.sh shape (must flag, exit 1)
# and the POST-FIX execution/get_repo_info.sh shape (must pass clean, exit 0).
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECKER="$SELF_DIR/verify_set_e_fallback_reachable.sh"

WORK_DIR="$(mktemp -d)"
cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

FAIL=0

# --- Case 1: pre-fix shape must be flagged (exit 1) ---
# NOTE: the unguarded assignment line is assembled from parts (not written as a
# literal `VAR=$(...)` line in this driver script) so that running the checker
# against execution/checks/ itself doesn't pick up this fixture text as a live hit.
PRE_FIX_DIR="$WORK_DIR/pre_fix/execution"
mkdir -p "$PRE_FIX_DIR"
DOLLAR='$'
cat > "$PRE_FIX_DIR/repo_info.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail

if command -v gh >/dev/null 2>&1; then
    if gh auth status >/dev/null 2>&1; then
        REPO_SLUG=${DOLLAR}(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
        if [ -n "\$REPO_SLUG" ]; then
            echo "\$REPO_SLUG"
            exit 0
        fi
    fi
fi

# Fallback to git remotes
if command -v git >/dev/null 2>&1; then
    echo "fallback"
    exit 0
fi

exit 1
EOF

OUTPUT=""
EXIT_CODE=0
OUTPUT="$(bash "$CHECKER" "$PRE_FIX_DIR")" || EXIT_CODE=$?

if [ "$EXIT_CODE" -ne 1 ]; then
    echo "FAIL: pre-fix fixture expected exit 1, got $EXIT_CODE" >&2
    FAIL=1
elif ! printf '%s' "$OUTPUT" | grep -q 'repo_info.sh:'; then
    echo "FAIL: pre-fix fixture output missing 'repo_info.sh:' line, got: $OUTPUT" >&2
    FAIL=1
else
    echo "PASS: pre-fix repo_info.sh shape flagged"
fi

# --- Case 2: post-fix shape (get_repo_info.sh reference) must pass clean (exit 0, no output) ---
POST_FIX_DIR="$WORK_DIR/post_fix/execution"
mkdir -p "$POST_FIX_DIR"
cat > "$POST_FIX_DIR/get_repo_info.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if command -v gh >/dev/null 2>&1; then
    if gh auth status >/dev/null 2>&1; then
        REPO_SLUG=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
        if [ -n "$REPO_SLUG" ]; then
            echo "$REPO_SLUG"
            exit 0
        fi
    fi
fi

# Fallback to git remotes
if command -v git >/dev/null 2>&1; then
    echo "fallback"
    exit 0
fi

exit 1
EOF

OUTPUT=""
EXIT_CODE=0
OUTPUT="$(bash "$CHECKER" "$POST_FIX_DIR")" || EXIT_CODE=$?

if [ "$EXIT_CODE" -ne 0 ]; then
    echo "FAIL: post-fix fixture expected exit 0, got $EXIT_CODE (output: $OUTPUT)" >&2
    FAIL=1
elif [ -n "$OUTPUT" ]; then
    echo "FAIL: post-fix fixture expected no output, got: $OUTPUT" >&2
    FAIL=1
else
    echo "PASS: post-fix get_repo_info.sh shape passes clean"
fi

# --- Case 3: QA's synthetic no-2>/dev/null example must be flagged (exit 1) ---
# This is the false-negative the checker previously missed: an unguarded
# VAR=$(...) with no stderr redirection is exactly as unreachable-fallback-
# prone as the 2>/dev/null shape, so it must be caught too.
# NOTE: like Case 1, the unguarded assignment line is assembled from parts
# so this driver file doesn't itself trip a live checker scan of execution/.
QA_FIXTURE_DIR="$WORK_DIR/qa_fixture/execution"
mkdir -p "$QA_FIXTURE_DIR"
cat > "$QA_FIXTURE_DIR/qa_example.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail

VAL=${DOLLAR}(false)
if [ -z "\$VAL" ]; then
    echo "fallback path"
fi
EOF

OUTPUT=""
EXIT_CODE=0
OUTPUT="$(bash "$CHECKER" "$QA_FIXTURE_DIR")" || EXIT_CODE=$?

if [ "$EXIT_CODE" -ne 1 ]; then
    echo "FAIL: QA synthetic fixture expected exit 1, got $EXIT_CODE" >&2
    FAIL=1
elif ! printf '%s' "$OUTPUT" | grep -q 'qa_example.sh:'; then
    echo "FAIL: QA synthetic fixture output missing 'qa_example.sh:' line, got: $OUTPUT" >&2
    FAIL=1
else
    echo "PASS: QA synthetic no-2>/dev/null fixture flagged"
fi

exit "$FAIL"
