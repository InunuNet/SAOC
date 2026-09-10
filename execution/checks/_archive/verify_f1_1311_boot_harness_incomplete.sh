#!/usr/bin/env bash
# verify_f1_1311_boot_harness_incomplete.sh -- golden-file behavioral check for
# mission harness-integrity-hardening F1 (GH #1311, adversarial review Finding 2).
#
# Bug: execution/hooks/full_boot.sh runs
#   python3 execution/mission.py status "..." 2>/dev/null || echo "(stale mission
#   pointer — run: python3 execution/mission.py list)"
# When execution/mission.py is ABSENT entirely (a partially-propagated project --
# the actual GH #1311 root cause), the `||` branch fires for the WRONG reason and
# prints a message that presupposes mission.py exists and the pointer is merely
# stale. This is exactly how the downstream #1311 project concluded "mission.py
# doesn't exist, the system must live in skills" instead of re-running
# `update_template.py --apply`.
#
# Fix contract this script enforces (full_boot.sh only -- non-fatal, boot must
# never abort):
#   1. A loud, actionable top-of-boot HARNESS-completeness check over a minimal
#      critical file subset (execution/mission.py, execution/contract.py) that
#      prints "HARNESS INCOMPLETE" (or similar) plus the concrete missing paths
#      and the fix command (`python3 execution/update_template.py --apply`) when
#      any are missing, and prints NOTHING extra when all are present.
#   2. An explicit `[ -f execution/mission.py ]` guard immediately around the
#      `mission.py status` call so that when mission.py is missing, the ORIGINAL
#      misleading "(stale mission pointer ...)" string is never printed --
#      replaced by the same loud missing-harness wording.
#   3. The TRUE stale-pointer case (mission.py present, but the active.json
#      pointer references a mission file that doesn't parse/exist) must still
#      produce the original "(stale mission pointer ...)" message -- this
#      script must not regress that diagnosis.
#
# Drives the REAL execution/hooks/full_boot.sh end-to-end in an isolated
# fixture directory (same fixture-isolation convention as
# execution/checks/verify_boot_context_dedup_1287.sh) -- no real repo state
# is ever touched.
#
# Usage: verify_f1_1311_boot_harness_incomplete.sh <case>
#   mission_py_missing        -- execution/mission.py absent, active.json present
#                                 -> loud missing-harness message, NOT "stale
#                                 mission pointer".
#   critical_files_missing    -- execution/mission.py AND execution/contract.py
#                                 both absent -> top-of-boot warning names both
#                                 missing paths.
#   harness_complete          -- both critical files present, no active mission
#                                 -> no HARNESS INCOMPLETE warning at all
#                                 (false-positive regression check).
#   stale_pointer_still_works -- mission.py present, active.json points at a
#                                 mission file that does not exist -> original
#                                 "(stale mission pointer ...)" message is
#                                 preserved.
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CASE="${1:-}"
TARGET="$REPO_ROOT/execution/hooks/full_boot.sh"

if [ ! -f "$TARGET" ]; then
  echo "FAIL: target script not found: $TARGET" >&2
  exit 1
fi

WS="$(mktemp -d)"
cleanup() { /bin/rm -rf "$WS" 2>/dev/null || true; }
trap cleanup EXIT

# --- Minimal fixture project skeleton so full_boot.sh's many non-fatal steps
#     no-op cleanly (mirrors verify_boot_context_dedup_1287.sh's convention). ---
mkdir -p "$WS/.agent/memory/scratch" "$WS/.agent/memory/project" "$WS/.agent/providers" "$WS/.agent/memory/project/missions" "$WS/execution"
printf 'GoldenFixtureProject-1311\n' > "$WS/WORKSPACE"
printf 'test\n' > "$WS/.agent/version"
cat > "$WS/.agent/profile.json" <<'JSON'
{"project_name": "GoldenFixtureProject-1311", "template_version": "test", "onboarding_complete": true, "autonomy": {"level": "medium"}, "identity": {"agent_name": "TestAgent", "project_role": "tester"}}
JSON
touch "$WS/.agent/memory/project/goals.md" "$WS/.agent/memory/project/learned.md"

run_boot() {
  (cd "$WS" && bash "$TARGET" 2>&1)
}

assert_no_harness_warning() {
  local out="$1"
  if echo "$out" | grep -qi "HARNESS INCOMPLETE"; then
    echo "FAIL: harness_complete -- a HARNESS INCOMPLETE warning was printed even though all critical files are present (false positive)" >&2
    echo "$out" >&2
    return 1
  fi
  return 0
}

case "$CASE" in
  mission_py_missing)
    # execution/mission.py deliberately absent.
    MISSION_FILE="$WS/.agent/memory/project/missions/2026-07-28-fixture.md"
    cat > "$MISSION_FILE" <<'EOF'
---
schema: athanor.mission/v1
slug: fixture
status: in_progress
---
# fixture
EOF
    cat > "$WS/.agent/memory/project/missions/active.json" <<EOF
{"mission": "2026-07-28-fixture.md", "checkpoint": null}
EOF
    # execution/contract.py present (isolate this case to mission.py only)
    printf '# stub\n' > "$WS/execution/contract.py"

    OUT="$(run_boot)"
    if echo "$OUT" | grep -q "stale mission pointer"; then
      echo "FAIL: mission_py_missing -- the misleading '(stale mission pointer ...)' message was still printed when execution/mission.py is entirely absent" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -qi "mission.py"; then
      echo "FAIL: mission_py_missing -- no message referencing the missing execution/mission.py was printed at all" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -Eqi "(MISSING|INCOMPLETE)"; then
      echo "FAIL: mission_py_missing -- output does not loudly say the harness is missing/incomplete" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -q "update_template.py --apply"; then
      echo "FAIL: mission_py_missing -- output does not give the actionable fix command (update_template.py --apply)" >&2
      echo "$OUT" >&2
      exit 1
    fi
    echo "PASS: mission_py_missing -- loud, actionable missing-harness message; stale-pointer message not shown"
    ;;

  critical_files_missing)
    # Neither execution/mission.py nor execution/contract.py present, no active mission.
    OUT="$(run_boot)"
    if ! echo "$OUT" | grep -Eqi "(MISSING|INCOMPLETE)"; then
      echo "FAIL: critical_files_missing -- no HARNESS INCOMPLETE style warning printed" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -q "execution/mission.py"; then
      echo "FAIL: critical_files_missing -- warning does not name execution/mission.py as missing" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -q "execution/contract.py"; then
      echo "FAIL: critical_files_missing -- warning does not name execution/contract.py as missing" >&2
      echo "$OUT" >&2
      exit 1
    fi
    echo "PASS: critical_files_missing -- both missing critical files named in the boot warning"
    ;;

  harness_complete)
    printf '# stub mission.py\n' > "$WS/execution/mission.py"
    printf '# stub contract.py\n' > "$WS/execution/contract.py"
    OUT="$(run_boot)"
    assert_no_harness_warning "$OUT" || exit 1
    echo "PASS: harness_complete -- no false-positive HARNESS INCOMPLETE warning when critical files are present"
    ;;

  stale_pointer_still_works)
    # Real mission.py present -- copy the actual repo file so status behavior
    # (including its genuine failure mode on a bad pointer) is authentic.
    cp "$REPO_ROOT/execution/mission.py" "$WS/execution/mission.py"
    printf '# stub contract.py\n' > "$WS/execution/contract.py"
    # active.json points at a mission file that does NOT exist on disk.
    cat > "$WS/.agent/memory/project/missions/active.json" <<EOF
{"mission": "does-not-exist.md", "checkpoint": null}
EOF
    OUT="$(run_boot)"
    if ! echo "$OUT" | grep -q "stale mission pointer"; then
      echo "FAIL: stale_pointer_still_works -- the genuine stale-pointer case (mission.py present, dangling pointer) no longer produces the '(stale mission pointer ...)' diagnosis -- regression" >&2
      echo "$OUT" >&2
      exit 1
    fi
    echo "PASS: stale_pointer_still_works -- genuine stale-pointer diagnosis preserved when mission.py IS present"
    ;;

  *)
    echo "FAIL: unknown case '$CASE' (expected mission_py_missing|critical_files_missing|harness_complete|stale_pointer_still_works)" >&2
    exit 1
    ;;
esac
