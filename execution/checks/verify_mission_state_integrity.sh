#!/usr/bin/env bash
# verify_mission_state_integrity.sh -- sandboxed behavioral scenarios for
# mission mission-state-integrity F1 (clear_active() ownership check) and F2
# (test_mission.py hermeticity).
#
# Bugs under test (GH #1333, backlog 2026-08-07):
#   F1 -- execution/mission.py:clear_active() unlinks the module-level
#         ACTIVE_JSON unconditionally whenever it is called. cmd_pause()
#         (mission.py:942-947) calls it with ZERO ownership guard, unlike
#         cmd_close_stub() (which already checks Path(...).resolve()
#         equality before clearing -- see verify_mission_close_stub_not_active.sh,
#         which is why close-stub is NOT part of this contract). Pausing
#         mission B while mission A is the live active mission destroys A's
#         active.json.
#   F2 -- execution/tests/test_mission.py:15 MISSIONS_DIR is a bare relative
#         Path(".agent/memory/project/missions"), resolved against whatever
#         CWD the test happens to be invoked from. Run from the repo root
#         (the natural way to run a test suite), it operates on the REAL
#         missions dir, including overwriting/deleting a live active.json.
#
# SAFETY: this check NEVER touches the real .agent/memory/project/missions
# of the invoking repo. F1 cases run the REAL, unmodified execution/mission.py
# but with cwd pointed at a disposable mktemp sandbox -- mission.py's own
# MISSIONS_DIR is relative to CWD, not to the script's location, so pointing
# cwd at a sandbox is sufficient isolation without copying or patching
# mission.py. F2 cases build a disposable "fake repo root" (mktemp dir)
# containing only what test_mission.py needs (execution/mission.py, and a
# COPY of the CURRENT execution/tests/test_mission.py) and run entirely
# inside it. At no point does this script cd into, read active.json from, or
# pass as an argument any path under the real repo's
# .agent/memory/project/missions/.
#
# Usage: verify_mission_state_integrity.sh <case> <repo_root>
set -euo pipefail

CASE="${1:?usage: verify_mission_state_integrity.sh <case> <repo_root>}"
REPO_ROOT="${2:?usage: verify_mission_state_integrity.sh <case> <repo_root>}"
REPO_ROOT="$(cd "$REPO_ROOT" && pwd)"
MISSION_PY="$REPO_ROOT/execution/mission.py"

# minimal_mission_file PATH SLUG STATUS -- writes a schema-valid, feature-less
# mission markdown file (0 features/milestones, valid per mission.py's own
# validate rules) so pause/activate have something real to operate on.
minimal_mission_file() {
    local path="$1" slug="$2" status="$3"
    cat > "$path" <<EOF
---
schema: athanor.mission/v1
slug: $slug
goal: Fixture mission for verify_mission_state_integrity.sh
created_at: '2026-08-01T00:00:00+00:00'
started_at: '2026-08-01T00:00:00+00:00'
last_active_at: '2026-08-01T00:00:00+00:00'
status: $status
cost_estimate: {features: 0, milestones: 0, total_calls: 0}
last_checkpoint: {milestone: null, feature: null, ts: null}
features: []
milestones: []
---

# Fixture mission
EOF
}

case "$CASE" in

  # --- F1: clear_active() ownership -------------------------------------

  pause_non_owner_leaves_other_active_pointer_alone)
    # Mission A is the live active mission. Pausing an UNRELATED mission B
    # must not touch A's active.json at all -- not delete it, not alter it.
    SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$SANDBOX"' EXIT
    mkdir -p "$SANDBOX/.agent/memory/project/missions"
    MISSIONS_DIR="$SANDBOX/.agent/memory/project/missions"

    MISSION_A="$MISSIONS_DIR/mission-a.md"
    MISSION_B="$MISSIONS_DIR/mission-b.md"
    minimal_mission_file "$MISSION_A" "mission-a" "in_progress"
    minimal_mission_file "$MISSION_B" "mission-b" "in_progress"

    cat > "$MISSIONS_DIR/active.json" <<EOF
{"mission": "$MISSION_A", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-08-01T00:00:00+00:00"}
EOF
    BEFORE="$(cat "$MISSIONS_DIR/active.json")"

    ( cd "$SANDBOX" && python3 "$MISSION_PY" pause "$MISSION_B" >/dev/null )

    if [ ! -f "$MISSIONS_DIR/active.json" ]; then
        echo "FAIL: pausing mission B deleted mission A's active.json -- clear_active() is unconditional (GH #1333)"
        exit 1
    fi
    AFTER="$(cat "$MISSIONS_DIR/active.json")"
    if [ "$BEFORE" != "$AFTER" ]; then
        echo "FAIL: pausing mission B altered mission A's active.json content"
        echo "  before: $BEFORE"
        echo "  after:  $AFTER"
        exit 1
    fi
    grep -q "$MISSION_A" "$MISSIONS_DIR/active.json" || {
        echo "FAIL: active.json no longer points at mission A after pausing unrelated mission B"
        exit 1
    }
    echo "PASS: pause_non_owner_leaves_other_active_pointer_alone"
    ;;

  pause_owner_still_clears_active_pointer)
    # Regression guard: pausing the mission that IS the active one must
    # still clear active.json. (Note: this case is a naturally-passing
    # guard even against today's buggy unconditional clear_active() --
    # the bug is over-deletion, not under-deletion, so this alone does not
    # prove correctness. See sibling case above for the RED assertion.)
    SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$SANDBOX"' EXIT
    mkdir -p "$SANDBOX/.agent/memory/project/missions"
    MISSIONS_DIR="$SANDBOX/.agent/memory/project/missions"

    MISSION_A="$MISSIONS_DIR/mission-a.md"
    minimal_mission_file "$MISSION_A" "mission-a" "in_progress"
    cat > "$MISSIONS_DIR/active.json" <<EOF
{"mission": "$MISSION_A", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-08-01T00:00:00+00:00"}
EOF

    ( cd "$SANDBOX" && python3 "$MISSION_PY" pause "$MISSION_A" >/dev/null )

    if [ -f "$MISSIONS_DIR/active.json" ]; then
        echo "FAIL: active.json still exists after pausing the mission it points to -- pause must still clear its own active pointer"
        exit 1
    fi
    echo "PASS: pause_owner_still_clears_active_pointer"
    ;;

  # --- F2: test_mission.py hermeticity ------------------------------------

  sandbox_replay_canary_untouched)
    # Replays "run test_mission.py from the repo root" inside a disposable
    # fake-repo-root that mirrors the real layout (execution/mission.py,
    # execution/tests/test_mission.py, .agent/memory/project/missions/),
    # seeded with a canary active.json standing in for a real, unrelated
    # live mission's pointer. If test_mission.py is hermetic, the canary
    # must be byte-identical after the full suite runs. NEVER touches the
    # real repo's missions dir -- this is a full disposable copy.
    FAKEROOT="$(mktemp -d)"
    trap 'rm -rf "$FAKEROOT"' EXIT
    mkdir -p "$FAKEROOT/execution/tests"
    mkdir -p "$FAKEROOT/.agent/memory/project/missions"
    cp "$MISSION_PY" "$FAKEROOT/execution/mission.py"
    cp "$REPO_ROOT/execution/tests/test_mission.py" "$FAKEROOT/execution/tests/test_mission.py"

    CANARY="$FAKEROOT/.agent/memory/project/missions/active.json"
    cat > "$CANARY" <<EOF
{"mission": ".agent/memory/project/missions/live-mission-not-part-of-test.md", "checkpoint": {"milestone": "M1", "feature": "F1"}, "activated_at": "2026-08-01T00:00:00+00:00"}
EOF
    BEFORE="$(cat "$CANARY")"

    set +e
    ( cd "$FAKEROOT" && python3 execution/tests/test_mission.py > "$FAKEROOT/test_output.log" 2>&1 )
    set -e

    if [ ! -f "$CANARY" ]; then
        echo "FAIL: canary active.json (standing in for a real, unrelated live mission's pointer) was DELETED by test_mission.py when run from a repo-root-shaped CWD"
        echo "--- test_mission.py output (tail) ---"
        tail -30 "$FAKEROOT/test_output.log" || true
        exit 1
    fi
    AFTER="$(cat "$CANARY")"
    if [ "$BEFORE" != "$AFTER" ]; then
        echo "FAIL: canary active.json was OVERWRITTEN by test_mission.py when run from a repo-root-shaped CWD -- test_mission.py's relative MISSIONS_DIR (test_mission.py:15) makes it operate on whatever missions dir happens to sit at CWD"
        echo "  before: $BEFORE"
        echo "  after:  $AFTER"
        exit 1
    fi
    echo "PASS: sandbox_replay_canary_untouched"
    ;;

  arbitrary_cwd_still_succeeds)
    # test_mission.py must be runnable (exit 0) from an arbitrary CWD that
    # has no execution/ or .agent/ tree at all -- proving it resolves its
    # own dependencies (the mission.py CLI it shells out to, and its own
    # scratch missions dir) independently of CWD, not via bare relative
    # strings. This tmp dir is unrelated to the real repo and is never
    # populated with any repo content, so it is inherently safe regardless
    # of pass/fail.
    EMPTY_CWD="$(mktemp -d)"
    trap 'rm -rf "$EMPTY_CWD"' EXIT

    set +e
    ( cd "$EMPTY_CWD" && python3 "$REPO_ROOT/execution/tests/test_mission.py" > "$EMPTY_CWD/test_output.log" 2>&1 )
    exit_code=$?
    set -e

    if [ "$exit_code" -ne 0 ]; then
        echo "FAIL: test_mission.py exited $exit_code when invoked from an arbitrary CWD with no execution/ or .agent/ tree present -- it must not assume CWD == repo root"
        echo "--- test_mission.py output (tail) ---"
        tail -30 "$EMPTY_CWD/test_output.log" || true
        exit 1
    fi
    echo "PASS: arbitrary_cwd_still_succeeds"
    ;;

  # --- F1 addendum: cmd_pause() stdout truthfulness (A5) -----------------

  pause_stdout_truthful)
    # cmd_pause() (mission.py ~954-961) prints "active.json cleared." on the
    # line immediately after clear_active(args.mission), UNCONDITIONALLY --
    # regardless of whether clear_active() actually unlinked anything. The
    # ownership guard exercised by A1/A2 already protects the DATA; this
    # case asserts the OUTPUT must not lie about it. Covers both directions:
    #   (a) pausing a non-owner mission (pointer left untouched) must NOT
    #       claim active.json was cleared.
    #   (b) pausing the genuine owner (pointer actually removed) MUST still
    #       claim it was cleared -- do not fix (a) by deleting the print
    #       statement and going silent on both paths.
    # Wording is not pinned to the current exact string; any phrasing that
    # mentions active.json together with a clearing verb counts (see the
    # grep pattern below and the golden's "wording latitude" section).
    SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$SANDBOX"' EXIT
    mkdir -p "$SANDBOX/.agent/memory/project/missions"
    MISSIONS_DIR="$SANDBOX/.agent/memory/project/missions"
    CLEAR_CLAIM_RE='active\.json[^.]*(cleared|removed|deleted)|(cleared|removed|deleted)[^.]*active\.json'

    MISSION_A="$MISSIONS_DIR/mission-a.md"
    MISSION_B="$MISSIONS_DIR/mission-b.md"
    minimal_mission_file "$MISSION_A" "mission-a" "in_progress"
    minimal_mission_file "$MISSION_B" "mission-b" "in_progress"

    # (a) non-owner: mission A is active, pause unrelated mission B.
    cat > "$MISSIONS_DIR/active.json" <<EOF
{"mission": "$MISSION_A", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-08-01T00:00:00+00:00"}
EOF
    OUT_NONOWNER="$(cd "$SANDBOX" && python3 "$MISSION_PY" pause "$MISSION_B")"

    if [ ! -f "$MISSIONS_DIR/active.json" ]; then
        echo "FAIL: setup broken -- non-owner pause deleted active.json (should be prevented by A1's guard); cannot test stdout truthfulness"
        exit 1
    fi
    if echo "$OUT_NONOWNER" | grep -qiE "$CLEAR_CLAIM_RE"; then
        echo "FAIL: pausing a non-owner mission left active.json untouched, but stdout still claimed it was cleared:"
        echo "$OUT_NONOWNER"
        exit 1
    fi

    # (b) owner: mission A is active, pause mission A itself.
    OUT_OWNER="$(cd "$SANDBOX" && python3 "$MISSION_PY" pause "$MISSION_A")"

    if [ -f "$MISSIONS_DIR/active.json" ]; then
        echo "FAIL: setup broken -- owner pause did not clear active.json; cannot test stdout truthfulness"
        exit 1
    fi
    if ! echo "$OUT_OWNER" | grep -qiE "$CLEAR_CLAIM_RE"; then
        echo "FAIL: pausing the genuine owner mission DID clear active.json, but stdout no longer reports it -- do not fix this by silently deleting the print statement"
        echo "$OUT_OWNER"
        exit 1
    fi

    echo "PASS: pause_stdout_truthful"
    ;;

  *)
    echo "FAIL: unknown case '$CASE'"
    exit 2
    ;;

esac
