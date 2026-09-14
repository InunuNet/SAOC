#!/usr/bin/env bash
# verify_f1_handoff_purge.sh -- golden-file behavioral check for mission
# handoff-purge-repair F1 (durable-handoff purge repair for
# execution/brain.py wrap_up()).
#
# Root defect: wrap_up() unconditionally rm's every file under
# .agent/memory/scratch/ (except .keep) once no active mission is found.
# .agent/memory/scratch/ is gitignored, so anything the purge deletes and
# that was never committed elsewhere is gone for good. On 2026-08-16 this
# destroyed a cross-session RESUME.md and a relay draft. It also silently
# destroys execution/checks or docs' own baseline store
# (.agent/memory/scratch/template_baselines.json, the template-updater's
# sha256 baseline store per docs/template-update.md:332) on every purge --
# a second, independently-live defect in the same routine.
#
# Fix under test must satisfy ALL of:
#   1. A small, explicit filename allowlist of durable SYSTEM STATE that
#      belongs in scratch by design (currently just
#      template_baselines.json) survives the purge -- always, including
#      under --force.
#   2. Ordinary scratch junk (arbitrary non-allowlisted files) is still
#      cleared -- the purge must not become a no-op.
#   3. A file that merely LOOKS like a durable handoff by name (e.g.
#      RESUME.md, a naive agent's mistake of writing a handoff note
#      straight into scratch instead of the committed
#      .agent/memory/project/handoff/ dir) is NOT specially preserved --
#      the fix must not special-case by name/content pattern matching
#      ("resume", "handoff", etc). The only durable-handoff mechanism is:
#      don't put it in scratch. This is the TRAP case (scenario
#      trap_pattern_match): a naive "if filename contains resume: skip"
#      fix passes scenario 1 but fails this one; the correct allowlist-only
#      fix passes both.
#   4. The already-committed handoff dir (.agent/memory/project/handoff/)
#      is untouched by wrap-up regardless (it is outside scratch and
#      nothing in wrap_up() should ever reach into it).
#   5. The existing active-mission-skip guard (in_progress/pending mission
#      -> purge skipped entirely) still holds -- this is a regression
#      check, not new behavior.
#
# Each scenario builds an isolated temp fixture project root (never the
# real repo), cd's into it, and invokes `python3 <repo>/execution/brain.py
# wrap-up ...` against that fixture. The real repo's
# .agent/memory/scratch/ and .agent/memory/brain/ are never touched.
#
# Usage: verify_f1_handoff_purge.sh <scenario>
#   scenarios: exempt_survives | force_still_exempt | trap_pattern_match |
#              committed_handoff_untouched | active_mission_skip
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BRAIN_PY="$REPO_ROOT/execution/brain.py"
SCENARIO="${1:-}"

fail() { echo "FAIL: $*" >&2; exit 1; }

# Build a fresh fixture project root at $1 with the minimal skeleton
# wrap_up() and its helpers touch: scratch dir, project dir (for
# reboot.md), and no active mission unless the caller adds one.
setup_fixture() {
    local root="$1"
    mkdir -p "$root/.agent/memory/scratch"
    mkdir -p "$root/.agent/memory/project/missions"
    mkdir -p "$root/.agent/memory/project/handoff"
    mkdir -p "$root/.agent/memory/brain"
    : > "$root/.agent/memory/scratch/.keep"
}

run_wrapup() {
    local root="$1"; shift
    ( cd "$root" && python3 "$BRAIN_PY" wrap-up --summary "verify_f1_handoff_purge fixture run" "$@" ) \
        >"$root/.wrapup.out" 2>&1
    return $?
}

case "$SCENARIO" in

  exempt_survives)
    T=$(mktemp -d)
    trap 'rm -rf "$T"' EXIT
    setup_fixture "$T"
    echo '{"sha256": "deadbeef"}' > "$T/.agent/memory/scratch/template_baselines.json"
    echo 'junk' > "$T/.agent/memory/scratch/research-scratch-junk.md"
    run_wrapup "$T" || fail "wrap-up exited nonzero: $(cat "$T/.wrapup.out")"
    [ -f "$T/.agent/memory/scratch/template_baselines.json" ] \
        || fail "template_baselines.json (allowlisted durable state) was purged"
    [ -f "$T/.agent/memory/scratch/research-scratch-junk.md" ] \
        && fail "ordinary scratch junk survived the purge -- purge became a no-op"
    echo "PASS: exempt_survives"
    ;;

  force_still_exempt)
    T=$(mktemp -d)
    trap 'rm -rf "$T"' EXIT
    setup_fixture "$T"
    echo '{"sha256": "deadbeef"}' > "$T/.agent/memory/scratch/template_baselines.json"
    echo 'junk' > "$T/.agent/memory/scratch/research-scratch-junk.md"
    run_wrapup "$T" --force || fail "wrap-up --force exited nonzero: $(cat "$T/.wrapup.out")"
    [ -f "$T/.agent/memory/scratch/template_baselines.json" ] \
        || fail "template_baselines.json was purged under --force -- allowlist must hold even under --force"
    [ -f "$T/.agent/memory/scratch/research-scratch-junk.md" ] \
        && fail "ordinary scratch junk survived --force purge"
    echo "PASS: force_still_exempt"
    ;;

  trap_pattern_match)
    T=$(mktemp -d)
    trap 'rm -rf "$T"' EXIT
    setup_fixture "$T"
    # A naive agent mistake: a durable-looking handoff note written
    # straight into scratch instead of .agent/memory/project/handoff/.
    echo '# RESUME' > "$T/.agent/memory/scratch/RESUME.md"
    run_wrapup "$T" || fail "wrap-up exited nonzero: $(cat "$T/.wrapup.out")"
    [ -f "$T/.agent/memory/scratch/RESUME.md" ] \
        && fail "RESUME.md in scratch survived the purge -- fix must not pattern-match filenames (resume/handoff); only the explicit system-state allowlist may survive, everything else in scratch is purgeable including misplaced handoff notes"
    echo "PASS: trap_pattern_match"
    ;;

  committed_handoff_untouched)
    T=$(mktemp -d)
    trap 'rm -rf "$T"' EXIT
    setup_fixture "$T"
    echo '# committed resume note' > "$T/.agent/memory/project/handoff/RESUME.md"
    echo 'junk' > "$T/.agent/memory/scratch/research-scratch-junk.md"
    run_wrapup "$T" || fail "wrap-up exited nonzero: $(cat "$T/.wrapup.out")"
    [ -f "$T/.agent/memory/project/handoff/RESUME.md" ] \
        || fail "committed .agent/memory/project/handoff/RESUME.md was touched/deleted by wrap-up -- it is outside scratch and must never be reachable by the purge"
    grep -q "committed resume note" "$T/.agent/memory/project/handoff/RESUME.md" \
        || fail "committed handoff file content was altered"
    echo "PASS: committed_handoff_untouched"
    ;;

  active_mission_skip)
    T=$(mktemp -d)
    trap 'rm -rf "$T"' EXIT
    setup_fixture "$T"
    cat > "$T/.agent/memory/project/missions/active.json" <<'EOF'
{"mission": ".agent/memory/project/missions/current.md"}
EOF
    cat > "$T/.agent/memory/project/missions/current.md" <<'EOF'
---
schema: athanor.mission/v1
slug: fixture-mission
status: in_progress
---
# Mission: fixture
EOF
    echo 'junk' > "$T/.agent/memory/scratch/research-scratch-junk.md"
    run_wrapup "$T" || fail "wrap-up exited nonzero: $(cat "$T/.wrapup.out")"
    [ -f "$T/.agent/memory/scratch/research-scratch-junk.md" ] \
        || fail "REGRESSION: scratch was purged despite an in_progress active mission -- the existing active-mission-skip guard must still hold"
    echo "PASS: active_mission_skip"
    ;;

  *)
    echo "usage: $0 {exempt_survives|force_still_exempt|trap_pattern_match|committed_handoff_untouched|active_mission_skip}" >&2
    exit 2
    ;;
esac
