#!/usr/bin/env bash
# verify_reboot_boot_wiring_112.sh -- golden-file behavioral check for GitHub issue #112.
#
# Bug: execution/brain.py's wrap_up() already calls write_reboot() on every session close,
# producing a lightweight .agent/memory/project/reboot.md (<=20 lines: "What happened last
# session", optional "Top priorities" / "Critical facts" / "Do NOT touch", each capped at 5
# items -- see write_reboot() in execution/brain.py). But execution/hooks/full_boot.sh (and its
# un-synced template/ twin, template/execution/hooks/full_boot.sh -- confirmed by this session's
# #1287/#1288 lesson that these two files are never auto-synced) NEVER reads reboot.md at all.
# It unconditionally dumps the FULL goals.md, a tail-20 of learned.md, and an awk-filtered view
# of backlog.md on every single boot, regardless of whether a fresh, relevant reboot.md exists.
#
# Fix contract (locked convention this script enforces):
#
#   Before the existing "--- GOALS ---" / "--- LEARNED ---" / "--- MISSION QUEUE ---" steps,
#   check .agent/memory/project/reboot.md:
#
#     - reboot.md EXISTS and is non-empty (size > 0 bytes) -> print a "--- REBOOT CONTEXT ---"
#       section containing its full content as the PRIMARY boot context, THEN print a SHORT
#       pointer line (something like "Full goals/learned/backlog available on request -- see
#       .agent/memory/project/*.md"). The full goals.md dump, the learned.md tail-20, and the
#       backlog.md awk-filtered dump must ALL be suppressed in this case -- their section
#       headers ("--- GOALS ---", "--- LEARNED (last 20 lines) ---", "--- MISSION QUEUE ---")
#       must NOT appear in output at all.
#
#     - reboot.md is MISSING (does not exist) OR is unreadable/corrupt (defined narrowly, since
#       markdown can't really be "corrupt" like JSON: EMPTY / zero-byte is the only corrupt state
#       this contract recognizes) -> fall back to EXACTLY today's existing behavior: full
#       goals.md dump, learned.md tail-20 (with over-cap notice when >20 lines), backlog.md
#       awk-filtered dump. This is the safe default -- never show LESS context than today when
#       reboot.md can't be trusted.
#
#   Design decision on staleness (encoded here, not re-litigated by the implementer): presence
#   of a non-empty reboot.md is treated as "fresh enough" with NO additional mtime/timestamp
#   staleness check. Rationale: write_reboot() is ONLY ever called from wrap_up(), which itself
#   only runs at explicit session close (brain.py wrap-up). There is no code path that writes a
#   stale reboot.md and leaves it in place across multiple skipped sessions without the operator
#   noticing (missions/backlog checks and the workflow reminder already surface staleness signals
#   elsewhere in full_boot.sh). Adding a hard time threshold would require picking an arbitrary
#   number (1 day? 7 days?) with no principled basis, and risks the opposite failure mode: a
#   reboot.md from 2 hours ago being treated as "stale" and needlessly falling back to the full
#   dump, defeating the entire point of the fix. "Presence = fresh enough" is therefore the
#   chosen behavior; this script's goldens encode it precisely and do NOT test any mtime-based
#   threshold logic.
#
#   Trap (explicitly tested): the reboot.md wiring must NOT suppress or duplicate any OTHER boot
#   section unrelated to goals/learned/backlog -- ACTIVE MISSION, BLOCKERS, comms.md LATEST
#   DIRECTIVE, PULSE HEARTBEAT, and GITHUB AUTH sections must all print exactly as they do today,
#   in both the reboot.md-present and reboot.md-absent paths.
#
# This script drives the REAL execution/hooks/full_boot.sh (or its template/ twin with
# --template) end-to-end in an isolated fixture directory with controlled reboot.md / goals.md /
# learned.md / backlog.md state, and greps stdout -- same fixture-isolation convention as
# execution/checks/verify_boot_context_dedup_1287.sh and
# execution/checks/verify_autonomy_type_guard_1288.sh -- so no real repo state is ever touched.
#
# Usage: verify_reboot_boot_wiring_112.sh <case> [--template]
#   reboot_present_suppresses_dump   - (a) reboot.md exists with real content -> its content is
#                                       printed as primary context; full goals.md / learned.md
#                                       tail / backlog.md dump section headers do NOT appear;
#                                       short pointer line to the full files IS printed.
#   reboot_missing_full_fallback     - (b) reboot.md does not exist at all -> today's exact
#                                       existing behavior: full goals.md, learned.md tail-20,
#                                       backlog.md awk-filtered dump all appear, unaffected.
#   reboot_empty_full_fallback       - (c) reboot.md exists but is zero-byte -> treated as
#                                       missing: same full fallback dump as (b), no crash.
#   other_sections_unaffected        - (d) trap: with reboot.md PRESENT, unrelated boot sections
#                                       (ACTIVE MISSION, BLOCKERS, PULSE HEARTBEAT, GITHUB AUTH,
#                                       comms.md LATEST DIRECTIVE) must still all print normally --
#                                       exactly once each, not suppressed, not duplicated.
#
# Pass --template as a second argument to run the identical case against
# template/execution/hooks/full_boot.sh instead of execution/hooks/full_boot.sh.
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CASE="${1:-}"
VARIANT="${2:-}"

if [ "$VARIANT" = "--template" ]; then
  TARGET="$REPO_ROOT/template/execution/hooks/full_boot.sh"
else
  TARGET="$REPO_ROOT/execution/hooks/full_boot.sh"
fi

if [ ! -f "$TARGET" ]; then
  echo "FAIL: target script not found: $TARGET" >&2
  exit 1
fi

WS="$(mktemp -d)"
cleanup() { /bin/rm -rf "$WS" 2>/dev/null || true; }
trap cleanup EXIT

# --- Minimal fixture project skeleton so full_boot.sh's many non-fatal steps no-op cleanly ---
mkdir -p "$WS/.agent/memory/scratch" "$WS/.agent/memory/project" "$WS/.agent/providers" "$WS/.agent/memory/project/missions"
printf 'GoldenFixtureProject-112\n' > "$WS/WORKSPACE"
printf 'test\n' > "$WS/.agent/version"
cat > "$WS/.agent/profile.json" <<'JSON'
{"project_name": "GoldenFixtureProject-112", "template_version": "test", "onboarding_complete": true, "autonomy": {"level": "medium"}, "identity": {"agent_name": "TestAgent", "project_role": "tester"}}
JSON

GOALS_FILE="$WS/.agent/memory/project/goals.md"
LEARNED_FILE="$WS/.agent/memory/project/learned.md"
BACKLOG_FILE="$WS/.agent/memory/project/backlog.md"
REBOOT_FILE="$WS/.agent/memory/project/reboot.md"

write_goals() {
  printf '# Goals\n\nGOALS-CONTENT-MARKER\n' > "$GOALS_FILE"
}

write_learned() {
  printf 'LEARNED-CONTENT-MARKER\n' > "$LEARNED_FILE"
}

write_backlog() {
  cat > "$BACKLOG_FILE" <<'EOF'
## Open
- [ ] BACKLOG-CONTENT-MARKER
EOF
}

write_reboot_with_content() {
  cat > "$REBOOT_FILE" <<'EOF'
# Reboot Context
_Generated: 2026-07-09T00:00Z_

## What happened last session
REBOOT-CONTENT-MARKER

## Top priorities
- priority one
EOF
}

write_comms_with_directive() {
  cat > "$WS/.agent/memory/project/comms.md" <<'EOF'
# Comms Log

## [CODI -> AGENT] 2026-01-02
DIRECTIVE-MARKER: reboot-112-check
Follow this instruction exactly.
EOF
}

write_active_mission() {
  mkdir -p "$WS/.agent/memory/project/missions"
  cat > "$WS/.agent/memory/project/missions/active.json" <<'EOF'
{"mission": "test-mission-112.md"}
EOF
  cat > "$WS/.agent/memory/project/missions/test-mission-112.md" <<'EOF'
---
status: in_progress
---
# Test Mission 112
EOF
}

run_boot() {
  (cd "$WS" && bash "$TARGET" 2>&1)
}

case "$CASE" in
  reboot_present_suppresses_dump)
    write_goals
    write_learned
    write_backlog
    write_reboot_with_content
    OUT="$(run_boot)"
    if ! echo "$OUT" | grep -q "REBOOT-CONTENT-MARKER"; then
      echo "FAIL: reboot_present_suppresses_dump -- reboot.md content was not printed as primary boot context even though it exists and is non-empty" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if echo "$OUT" | grep -q "GOALS-CONTENT-MARKER"; then
      echo "FAIL: reboot_present_suppresses_dump -- full goals.md content leaked into output even though reboot.md is present; the full dump must be suppressed" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if echo "$OUT" | grep -q "LEARNED-CONTENT-MARKER"; then
      echo "FAIL: reboot_present_suppresses_dump -- learned.md tail content leaked into output even though reboot.md is present; the full dump must be suppressed" >&2
      exit 1
    fi
    if echo "$OUT" | grep -q "BACKLOG-CONTENT-MARKER"; then
      echo "FAIL: reboot_present_suppresses_dump -- backlog.md content leaked into output even though reboot.md is present; the full dump must be suppressed" >&2
      exit 1
    fi
    if echo "$OUT" | grep -qi -- "--- GOALS ---"; then
      echo "FAIL: reboot_present_suppresses_dump -- '--- GOALS ---' section header printed even though reboot.md is present" >&2
      exit 1
    fi
    if echo "$OUT" | grep -qi -- "--- LEARNED"; then
      echo "FAIL: reboot_present_suppresses_dump -- '--- LEARNED' section header printed even though reboot.md is present" >&2
      exit 1
    fi
    if echo "$OUT" | grep -qi -- "--- MISSION QUEUE ---"; then
      echo "FAIL: reboot_present_suppresses_dump -- '--- MISSION QUEUE ---' section header printed even though reboot.md is present" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -qi "goals.md\|learned.md\|backlog.md"; then
      echo "FAIL: reboot_present_suppresses_dump -- no short pointer to the full goals/learned/backlog files was printed" >&2
      exit 1
    fi
    echo "PASS: reboot_present_suppresses_dump -- reboot.md printed as primary context, full dumps suppressed, pointer present"
    ;;

  reboot_missing_full_fallback)
    write_goals
    write_learned
    write_backlog
    rm -f "$REBOOT_FILE"
    OUT="$(run_boot)"
    if ! echo "$OUT" | grep -q "GOALS-CONTENT-MARKER"; then
      echo "FAIL: reboot_missing_full_fallback -- full goals.md was NOT dumped even though reboot.md does not exist (safe fallback must preserve today's exact behavior)" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -q "LEARNED-CONTENT-MARKER"; then
      echo "FAIL: reboot_missing_full_fallback -- learned.md was NOT dumped even though reboot.md does not exist" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -q "BACKLOG-CONTENT-MARKER"; then
      echo "FAIL: reboot_missing_full_fallback -- backlog.md was NOT dumped even though reboot.md does not exist" >&2
      exit 1
    fi
    if echo "$OUT" | grep -q "REBOOT-CONTENT-MARKER"; then
      echo "FAIL: reboot_missing_full_fallback -- reboot.md content appeared in output even though the file does not exist" >&2
      exit 1
    fi
    echo "PASS: reboot_missing_full_fallback -- full goals/learned/backlog dump unaffected when reboot.md is absent"
    ;;

  reboot_empty_full_fallback)
    write_goals
    write_learned
    write_backlog
    : > "$REBOOT_FILE"   # zero-byte file
    if [ -s "$REBOOT_FILE" ]; then
      echo "FAIL: test setup error -- reboot.md fixture is not actually zero-byte" >&2
      exit 1
    fi
    OUT="$(run_boot)"
    RC=$?
    if [ "$RC" -gt 1 ]; then
      echo "FAIL: reboot_empty_full_fallback -- full_boot.sh crashed (exit $RC) on an empty/zero-byte reboot.md" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -q "GOALS-CONTENT-MARKER"; then
      echo "FAIL: reboot_empty_full_fallback -- full goals.md was NOT dumped even though reboot.md is empty (must be treated as missing/untrustworthy -> safe fallback)" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -q "LEARNED-CONTENT-MARKER"; then
      echo "FAIL: reboot_empty_full_fallback -- learned.md was NOT dumped even though reboot.md is empty" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -q "BACKLOG-CONTENT-MARKER"; then
      echo "FAIL: reboot_empty_full_fallback -- backlog.md was NOT dumped even though reboot.md is empty" >&2
      exit 1
    fi
    echo "PASS: reboot_empty_full_fallback -- empty reboot.md treated as missing, safe fallback to full dump, no crash"
    ;;

  other_sections_unaffected)
    write_goals
    write_learned
    write_backlog
    write_reboot_with_content
    write_comms_with_directive
    write_active_mission
    rm -f "$WS/.agent/memory/scratch/.comms_last_hash"
    OUT="$(run_boot)"

    for SECTION in "ACTIVE MISSION" "BLOCKERS" "PULSE HEARTBEAT" "GITHUB AUTH"; do
      COUNT=$(echo "$OUT" | grep -c -- "--- $SECTION ---")
      if [ "$COUNT" -lt 1 ]; then
        echo "FAIL: other_sections_unaffected -- '--- $SECTION ---' section missing from output when reboot.md is present" >&2
        echo "$OUT" >&2
        exit 1
      fi
      if [ "$COUNT" -gt 1 ]; then
        echo "FAIL: other_sections_unaffected -- '--- $SECTION ---' section printed $COUNT times (duplicated) when reboot.md is present" >&2
        exit 1
      fi
    done

    if ! echo "$OUT" | grep -q "DIRECTIVE-MARKER: reboot-112-check"; then
      echo "FAIL: other_sections_unaffected -- comms.md LATEST DIRECTIVE was suppressed by the reboot.md wiring" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -q "REBOOT-CONTENT-MARKER"; then
      echo "FAIL: other_sections_unaffected -- reboot.md content itself was not printed in this combined fixture" >&2
      exit 1
    fi
    echo "PASS: other_sections_unaffected -- mission/blockers/pulse/github-auth/comms sections all present exactly once alongside reboot.md context"
    ;;

  *)
    echo "FAIL: unknown case '$CASE' (expected reboot_present_suppresses_dump|reboot_missing_full_fallback|reboot_empty_full_fallback|other_sections_unaffected)" >&2
    exit 1
    ;;
esac
