#!/usr/bin/env bash
# Regression test for the 2026-08-18 close-out sweep (commit 59e70a11):
# a mission close-out swept 17 unrelated dirty/untracked files -- including
# backlog.md, active.json, and reboot.md -- into the commit for a mission
# whose own features never touched them. See:
#   .agent/memory/project/specs/scoped-staging-commits/goldens/regression_2026_08_18_scenario.md
#
# Reproduces the exact scenario in an isolated throwaway git repo under
# mktemp -- NEVER touches the real Athanor working tree or index -- and
# asserts scoped_stage.py stages only the closing mission's own
# ledger-owned + always-owned paths, leaving all 17 unrelated files dirty.
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SELF_DIR/../.." && pwd)"
SCOPED_STAGE="$REPO_ROOT/execution/skills/lib/scoped_stage.py"

FIXTURE_ROOT="$(mktemp -d /tmp/f2-regression.XXXXXX)"
trap 'rm -rf "$FIXTURE_ROOT"' EXIT

PROJ="$FIXTURE_ROOT/proj"
mkdir -p "$PROJ"
( cd "$PROJ" && git init -q )

SLUG="model-env-integrity"
MISSION_PATH=".agent/memory/project/missions/${SLUG}.md"
SPEC_DIR=".agent/memory/project/specs/${SLUG}"

# --- ledger-owned paths: what F1-F3 actually touched, per the incident ---
LEDGER_PATHS=(
    "execution/skills/lib/verify_model_env_boot.py"
    "execution/init.sh"
    "${SPEC_DIR}/contract-f1.yaml"
    "${SPEC_DIR}/contract-f2.yaml"
    "${SPEC_DIR}/contract-f3.yaml"
)

# --- unrelated dirty paths: the 17 files that were NOT this mission's own,
# swept by the incident's unscoped `git add -A`. The 3 named in the live
# incident, plus 14 more to reach the full 17.
UNRELATED_PATHS=(
    "backlog.md"
    ".agent/memory/project/missions/active.json"
    ".agent/memory/project/handoff/reboot.md"
    ".agent/memory/project/specs/other-mission-a/contract-f1.yaml"
    ".agent/memory/project/specs/other-mission-b/contract-f1.yaml"
    ".agent/memory/scratch/unrelated-note-1.md"
    ".agent/memory/scratch/unrelated-note-2.md"
    "execution/skills/lib/unrelated_helper_a.py"
    "execution/skills/lib/unrelated_helper_b.py"
    "docs/unrelated-doc-1.md"
    "docs/unrelated-doc-2.md"
    ".agent/memory/project/missions/other-mission.md"
    ".agent/memory/project/missions/other-mission.touched.json"
    ".claude/settings.local.json.bak"
    "readme-scratch.md"
    "execution/checks/unrelated_check.sh"
    "execution/skills/lib/unrelated_helper_c.py"
)

# Seed + commit a baseline first, THEN dirty every path as a modification.
# `git status --porcelain` collapses an entirely-new untracked directory
# into a single "?? dir/" entry rather than listing files inside it
# individually -- committing a baseline first (so every path below is a
# tracked-file modification, matching the real incident's own dirty set)
# avoids that collapse and keeps each of the 17+ paths independently
# assertable.
for p in "${LEDGER_PATHS[@]}" "${UNRELATED_PATHS[@]}" "$MISSION_PATH"; do
    mkdir -p "$PROJ/$(dirname "$p")"
    printf 'baseline content: %s\n' "$p" > "$PROJ/$p"
done
( cd "$PROJ" && git add -A -- . && git -c user.email=test@test -c user.name=test commit -q -m baseline )

for p in "${LEDGER_PATHS[@]}" "${UNRELATED_PATHS[@]}"; do
    printf 'dirty content: %s\n' "$p" >> "$PROJ/$p"
done

cat > "$PROJ/$MISSION_PATH" <<EOF
---
slug: ${SLUG}
status: close_out
---
# ${SLUG}
Fixture mission for the 2026-08-18 regression scenario.
EOF

TOUCHED_JSON=".agent/memory/project/missions/${SLUG}.touched.json"
python3 -c "
import json, sys
paths = sys.argv[1:]
json.dump(
    {'schema': 'athanor.mission-touched-files/v1', 'slug': '$SLUG',
     'pending_baselines': {}, 'paths': paths},
    open('$PROJ/$TOUCHED_JSON', 'w'), indent=2,
)
" "${LEDGER_PATHS[@]}"

DIRTY_BEFORE_COUNT="$(cd "$PROJ" && git status --porcelain | wc -l | tr -d ' ')"
if [ "$DIRTY_BEFORE_COUNT" -lt 17 ]; then
    echo "FAIL: fixture setup did not produce >=17 unrelated+ledger dirty paths (got $DIRTY_BEFORE_COUNT) -- test scenario is not faithful to the incident" >&2
    exit 1
fi

OUT_FILE="$(mktemp /tmp/f2-regression-out.XXXXXX)"
trap 'rm -rf "$FIXTURE_ROOT" "$OUT_FILE"' EXIT

RC=0
( cd "$PROJ" && python3 "$SCOPED_STAGE" --mission "$MISSION_PATH" ) > "$OUT_FILE" 2>&1 || RC=$?
if [ "$RC" -ne 0 ]; then
    echo "FAIL: scoped_stage.py exited $RC" >&2
    cat "$OUT_FILE" >&2
    exit 1
fi

STAGED="$(cd "$PROJ" && git diff --cached --name-only | sort)"
STILL_DIRTY="$(cd "$PROJ" && git status --porcelain | awk '{print $2}' | sort)"

# TOUCHED_JSON itself lives under missions/, not under the spec dir and not
# equal to the mission path, and is not in LEDGER_PATHS -- it is correctly
# NOT part of what scoped_stage.py resolves as owned.
EXPECTED_STAGED="$(printf '%s\n' "${LEDGER_PATHS[@]}" "$MISSION_PATH" | sort -u)"

if [ "$STAGED" != "$EXPECTED_STAGED" ]; then
    echo "FAIL: staged set does not match the mission's own ledger+always-owned paths" >&2
    echo "--- expected ---" >&2
    echo "$EXPECTED_STAGED" >&2
    echo "--- actual ---" >&2
    echo "$STAGED" >&2
    exit 1
fi

for unrelated in "${UNRELATED_PATHS[@]}"; do
    if ! printf '%s\n' "$STILL_DIRTY" | grep -qxF "$unrelated"; then
        echo "FAIL: unrelated path '$unrelated' was NOT left dirty (it was staged, or vanished) -- regression!" >&2
        echo "--- staged ---" >&2
        echo "$STAGED" >&2
        exit 1
    fi
    if printf '%s\n' "$STAGED" | grep -qxF "$unrelated"; then
        echo "FAIL: unrelated path '$unrelated' was staged -- exact regression of commit 59e70a11" >&2
        exit 1
    fi
done

for named in "backlog.md" ".agent/memory/project/missions/active.json" ".agent/memory/project/handoff/reboot.md"; do
    if printf '%s\n' "$STAGED" | grep -qxF "$named"; then
        echo "FAIL: named incident file '$named' was staged -- exact regression of commit 59e70a11" >&2
        exit 1
    fi
done

echo "PASS: scoped_stage.py staged exactly the ${SLUG} mission's own ${#LEDGER_PATHS[@]} ledger+mission-file paths, leaving all ${#UNRELATED_PATHS[@]} unrelated dirty files (including backlog.md, active.json, reboot.md) untouched"
