#!/usr/bin/env bash
# verify_codi_last_match_template.sh -- golden-file behavioral check for the
# #1287 QA-pass backlog item: "template/execution/hooks/full_boot.sh directive
# extraction finds FIRST CODI block, not LAST (most recent)".
#
# Bug: execution/hooks/full_boot.sh (the canonical, already-correct copy)
# locates the MOST RECENT "## [CODI" directive in comms.md via
#   grep -n "^## \[CODI" comms.md | tail -1 | cut -d: -f1
# (find the LAST matching header line), then extracts everything after it
# with `awk -v startline=... 'NR > startline {...}'` until the next "## ["
# header or a 40-line cap.
#
# template/execution/hooks/full_boot.sh instead uses a single-pass awk state
# machine:
#   awk '/^## \[CODI ->/||/^## \[CODI ->/{if(found){exit} found=1; ...} ...'
# which sets found=1 on the FIRST "## [CODI" header it sees and EXITS as soon
# as it hits the SECOND "## [CODI" (or any other "## [") header -- i.e. it
# extracts the FIRST block, not the last. When comms.md accumulates multiple
# "## [CODI ->" blocks over time (the normal, expected long-running state),
# template/ injects the STALE/OLDEST directive at boot instead of the most
# recent one -- the opposite of the intended behavior.
#
# This script drives the REAL execution/hooks/full_boot.sh (or its template/
# twin with --template) end-to-end in an isolated fixture directory with a
# controlled comms.md, and greps stdout for the "LATEST DIRECTIVE" block body
# -- same fixture-isolation convention as
# execution/checks/verify_boot_context_dedup_1287.sh -- so no real repo state
# is ever touched.
#
# Usage: verify_codi_last_match_template.sh <case> [--template]
#   multi_block   - comms.md has THREE "## [CODI ->" blocks in chronological
#                    order -> the LAST (most recent) block's marker text must
#                    be the one printed; earlier blocks' marker text must NOT
#                    appear in the printed directive body.
#   single_block  - comms.md has exactly ONE "## [CODI ->" block -> that
#                    block's marker text must be printed (regression guard;
#                    both extraction strategies agree on a single block).
#   no_block      - comms.md has NO "## [CODI ->" block at all -> no LATEST
#                    DIRECTIVE block may be printed at all (regression guard).
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
printf 'GoldenFixtureProject-CODI\n' > "$WS/WORKSPACE"
printf 'test\n' > "$WS/.agent/version"
cat > "$WS/.agent/profile.json" <<'JSON'
{"project_name": "GoldenFixtureProject-CODI", "template_version": "test", "onboarding_complete": true, "autonomy": {"level": "medium"}, "identity": {"agent_name": "TestAgent", "project_role": "tester"}}
JSON
touch "$WS/.agent/memory/project/goals.md" "$WS/.agent/memory/project/learned.md"

COMMS_FILE="$WS/.agent/memory/project/comms.md"
CACHE_FILE="$WS/.agent/memory/scratch/.comms_last_hash"

write_comms_multi_block() {
  # Three "## [CODI ->" blocks, chronological order (oldest first, as they
  # would naturally accumulate in a real comms.md). Distinct marker text per
  # block so the golden can assert on exactly which one was extracted.
  cat > "$COMMS_FILE" <<'EOF'
# Comms Log

## [CODI -> OPENCODE] 2026-06-01 — FIRST DIRECTIVE
DIRECTIVE-MARKER: oldest-block
This is the oldest directive. Must NOT be the one injected at boot.

## [CODI -> OPENCODE] 2026-06-15 — SECOND DIRECTIVE
DIRECTIVE-MARKER: middle-block
This is the middle directive. Must NOT be the one injected at boot.

## [CODI -> OPENCODE] 2026-06-20 — THIRD DIRECTIVE
DIRECTIVE-MARKER: newest-block
This is the newest/most recent directive. MUST be the one injected at boot.
EOF
}

write_comms_single_block() {
  cat > "$COMMS_FILE" <<'EOF'
# Comms Log

## [CODI -> OPENCODE] 2026-06-20 — ONLY DIRECTIVE
DIRECTIVE-MARKER: only-block
This is the only directive in the file.
EOF
}

write_comms_no_block() {
  cat > "$COMMS_FILE" <<'EOF'
# Comms Log

(no CODI directive sections at all -- just prose notes)
Some unrelated log line.
EOF
}

run_boot() {
  rm -f "$CACHE_FILE"   # always a first boot -- dedup caching (#1287) is out of scope here
  (cd "$WS" && bash "$TARGET" 2>&1)
}

case "$CASE" in
  multi_block)
    write_comms_multi_block
    OUT="$(run_boot)"
    if ! echo "$OUT" | grep -q "DIRECTIVE-MARKER: newest-block"; then
      echo "FAIL: multi_block -- the LAST (most recent) CODI block's marker ('newest-block') was NOT found in the printed directive. Extraction did not select the most recent block." >&2
      echo "$OUT" >&2
      exit 1
    fi
    if echo "$OUT" | grep -q "DIRECTIVE-MARKER: oldest-block"; then
      echo "FAIL: multi_block -- the OLDEST CODI block's marker ('oldest-block') was found in the printed directive. This is the #1287-QA headline bug: extraction returned the first/stale block instead of the last." >&2
      echo "$OUT" >&2
      exit 1
    fi
    if echo "$OUT" | grep -q "DIRECTIVE-MARKER: middle-block"; then
      echo "FAIL: multi_block -- the MIDDLE CODI block's marker ('middle-block') was found in the printed directive; only the last block's body should be injected." >&2
      echo "$OUT" >&2
      exit 1
    fi
    echo "PASS: multi_block -- last (most recent) CODI block's marker printed, earlier blocks excluded"
    ;;

  single_block)
    write_comms_single_block
    OUT="$(run_boot)"
    if ! echo "$OUT" | grep -q "DIRECTIVE-MARKER: only-block"; then
      echo "FAIL: single_block -- the only CODI block's marker ('only-block') was NOT found in the printed directive" >&2
      echo "$OUT" >&2
      exit 1
    fi
    echo "PASS: single_block -- single CODI block's marker printed (regression guard)"
    ;;

  no_block)
    write_comms_no_block
    OUT="$(run_boot)"
    if echo "$OUT" | grep -q "LATEST DIRECTIVE"; then
      echo "FAIL: no_block -- a LATEST DIRECTIVE block header was printed even though comms.md has no CODI directive section at all" >&2
      echo "$OUT" >&2
      exit 1
    fi
    echo "PASS: no_block -- no directive block printed when comms.md has no CODI section (regression guard)"
    ;;

  *)
    echo "FAIL: unknown case '$CASE' (expected multi_block|single_block|no_block)" >&2
    exit 1
    ;;
esac
