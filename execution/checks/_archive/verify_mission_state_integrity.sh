#!/usr/bin/env bash
# verify_mission_state_integrity.sh -- sandboxed behavioral scenarios for
# mission mission-state-integrity F1 (clear_active() ownership check), F2
# (test_mission.py hermeticity), and F3 (cmd_new() must not silently orphan
# an unresolved active mission).
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

  # --- F3: cmd_new() must not silently orphan an unresolved active mission ---
  #
  # Bug (backlog 2026-08-07, found alongside GH #1333): execution/mission.py
  # cmd_new() (mission.py:205-271) calls write_active(str(out_path))
  # unconditionally at the end, regardless of what active.json currently
  # points to. If a prior mission is active and unresolved (most sharply:
  # status == close_out, meaning mission.py gate already flipped its status
  # and wrap_mission.sh needs a retry -- losing the active pointer means the
  # retry path is gone), `mission.py new <goal>` silently overwrites
  # active.json with the brand-new mission's pointer and prints nothing
  # about what it just orphaned. Confirmed live: exit 0, no warning, old
  # mission's active.json entry gone (probed against the real,
  # unmodified cmd_new in a disposable sandbox).

  new_refuses_when_active_mission_close_out)
    # RED now: cmd_new proceeds unconditionally. FIXED behavior: refuse
    # (exit 1), leave active.json untouched, create no new mission file,
    # and say why on stderr -- unless --force is passed (see sibling case).
    SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$SANDBOX"' EXIT
    mkdir -p "$SANDBOX/.agent/memory/project/missions"
    MISSIONS_DIR="$SANDBOX/.agent/memory/project/missions"
    OLD="$MISSIONS_DIR/2026-08-01-old-mission.md"
    minimal_mission_file "$OLD" "old-mission" "close_out"
    cat > "$MISSIONS_DIR/active.json" <<EOF
{"mission": "$OLD", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-08-01T00:00:00+00:00"}
EOF
    BEFORE="$(cat "$MISSIONS_DIR/active.json")"
    BEFORE_COUNT="$(find "$MISSIONS_DIR" -name '*.md' | wc -l | tr -d ' ')"

    set +e
    OUT="$(cd "$SANDBOX" && python3 "$MISSION_PY" new "brand new goal" --slug new-goal 2>&1)"
    RC=$?
    set -e

    if [ "$RC" -eq 0 ]; then
        echo "FAIL: mission.py new exited 0 while an unresolved (close_out) mission was active -- must refuse without --force"
        echo "$OUT"
        exit 1
    fi
    AFTER="$(cat "$MISSIONS_DIR/active.json" 2>/dev/null || echo MISSING)"
    if [ "$AFTER" != "$BEFORE" ]; then
        echo "FAIL: active.json was altered even though cmd_new refused (exit $RC) -- refusal must happen before any write"
        echo "  before: $BEFORE"
        echo "  after:  $AFTER"
        exit 1
    fi
    AFTER_COUNT="$(find "$MISSIONS_DIR" -name '*.md' | wc -l | tr -d ' ')"
    if [ "$AFTER_COUNT" != "$BEFORE_COUNT" ]; then
        echo "FAIL: a new mission .md file was created even though cmd_new refused to activate it (orphan-in-waiting)"
        exit 1
    fi
    echo "$OUT" | grep -qiE "close_out|unresolved|active" || {
        echo "FAIL: refusal produced no explanatory message on stderr/stdout mentioning the blocked/active mission"
        echo "$OUT"
        exit 1
    }
    echo "PASS: new_refuses_when_active_mission_close_out"
    ;;

  new_refuses_when_active_mission_in_progress)
    # RED now, same mechanism as above but with status=in_progress instead
    # of close_out -- proves the guard is a general "is the active mission
    # unresolved" check (membership in a small non-terminal set), not a
    # literal `if status == "close_out"` string match that would leave
    # every other non-terminal status (in_progress, pending, blocked)
    # exposed to the same silent-overwrite bug.
    SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$SANDBOX"' EXIT
    mkdir -p "$SANDBOX/.agent/memory/project/missions"
    MISSIONS_DIR="$SANDBOX/.agent/memory/project/missions"
    OLD="$MISSIONS_DIR/2026-08-01-old-mission.md"
    minimal_mission_file "$OLD" "old-mission" "in_progress"
    cat > "$MISSIONS_DIR/active.json" <<EOF
{"mission": "$OLD", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-08-01T00:00:00+00:00"}
EOF
    BEFORE="$(cat "$MISSIONS_DIR/active.json")"

    set +e
    OUT="$(cd "$SANDBOX" && python3 "$MISSION_PY" new "brand new goal" --slug new-goal-2 2>&1)"
    RC=$?
    set -e

    if [ "$RC" -eq 0 ]; then
        echo "FAIL: mission.py new exited 0 while an in_progress mission was active -- must refuse without --force"
        echo "$OUT"
        exit 1
    fi
    AFTER="$(cat "$MISSIONS_DIR/active.json" 2>/dev/null || echo MISSING)"
    if [ "$AFTER" != "$BEFORE" ]; then
        echo "FAIL: active.json was altered even though cmd_new refused"
        exit 1
    fi
    echo "PASS: new_refuses_when_active_mission_in_progress"
    ;;

  new_force_flag_overwrites_with_warning)
    # RED now: --force does not exist as a flag at all (argparse rejects it,
    # exit 2), so this is RED for a different reason than the two cases
    # above -- it proves the fix ships an explicit override, not just a
    # hard refusal with no escape hatch. FIXED behavior: --force proceeds
    # (exit 0, active.json now points at the new mission) but still prints
    # a warning naming what got orphaned -- the fix must not silently drop
    # the warning once --force is given.
    SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$SANDBOX"' EXIT
    mkdir -p "$SANDBOX/.agent/memory/project/missions"
    MISSIONS_DIR="$SANDBOX/.agent/memory/project/missions"
    OLD="$MISSIONS_DIR/2026-08-01-old-mission.md"
    minimal_mission_file "$OLD" "old-mission" "close_out"
    cat > "$MISSIONS_DIR/active.json" <<EOF
{"mission": "$OLD", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-08-01T00:00:00+00:00"}
EOF

    set +e
    OUT="$(cd "$SANDBOX" && python3 "$MISSION_PY" new "brand new goal" --slug new-goal-3 --force 2>&1)"
    RC=$?
    set -e

    if [ "$RC" -ne 0 ]; then
        echo "FAIL: mission.py new --force exited $RC -- --force must override the refusal"
        echo "$OUT"
        exit 1
    fi
    grep -q "new-goal-3" "$MISSIONS_DIR/active.json" || {
        echo "FAIL: --force did not actually switch active.json to the new mission"
        cat "$MISSIONS_DIR/active.json" 2>/dev/null || echo "  (active.json missing)"
        exit 1
    }
    echo "$OUT" | grep -qiE "old-mission|orphan|warn" || {
        echo "FAIL: --force overwrote the active pointer silently -- must still warn about what got orphaned"
        echo "$OUT"
        exit 1
    }
    echo "PASS: new_force_flag_overwrites_with_warning"
    ;;

  new_proceeds_when_active_mission_terminal)
    # Regression guard (naturally passing today -- the bug is missing
    # refusal, not spurious refusal): if the active mission already reached
    # a terminal status (done), there is nothing to orphan, so cmd_new must
    # proceed exactly as before with no --force needed. This is what keeps
    # the guard from becoming a "can never start a new mission" trap.
    SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$SANDBOX"' EXIT
    mkdir -p "$SANDBOX/.agent/memory/project/missions"
    MISSIONS_DIR="$SANDBOX/.agent/memory/project/missions"
    OLD="$MISSIONS_DIR/2026-08-01-old-mission.md"
    minimal_mission_file "$OLD" "old-mission" "done"
    cat > "$MISSIONS_DIR/active.json" <<EOF
{"mission": "$OLD", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-08-01T00:00:00+00:00"}
EOF

    set +e
    OUT="$(cd "$SANDBOX" && python3 "$MISSION_PY" new "brand new goal" --slug new-goal-4 2>&1)"
    RC=$?
    set -e

    if [ "$RC" -ne 0 ]; then
        echo "FAIL: mission.py new refused even though the active mission was already done -- overcorrection"
        echo "$OUT"
        exit 1
    fi
    grep -q "new-goal-4" "$MISSIONS_DIR/active.json" || {
        echo "FAIL: active.json was not switched to the new mission despite the old one being done"
        exit 1
    }
    echo "PASS: new_proceeds_when_active_mission_terminal"
    ;;

  new_proceeds_when_active_pointer_dangling)
    # Regression guard: active.json points at a mission file that no
    # longer exists on disk (deleted out from under the pointer). There is
    # nothing readable to orphan, so cmd_new must proceed without demanding
    # --force -- an over-broad guard that blocks on "can't read the
    # pointed-to file's status" would create a permanent lockout with no
    # escape short of manually deleting active.json.
    SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$SANDBOX"' EXIT
    mkdir -p "$SANDBOX/.agent/memory/project/missions"
    MISSIONS_DIR="$SANDBOX/.agent/memory/project/missions"
    cat > "$MISSIONS_DIR/active.json" <<EOF
{"mission": "$MISSIONS_DIR/2026-08-01-deleted-mission.md", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-08-01T00:00:00+00:00"}
EOF

    set +e
    OUT="$(cd "$SANDBOX" && python3 "$MISSION_PY" new "brand new goal" --slug new-goal-5 2>&1)"
    RC=$?
    set -e

    if [ "$RC" -ne 0 ]; then
        echo "FAIL: mission.py new refused even though the active pointer referenced a mission file that no longer exists"
        echo "$OUT"
        exit 1
    fi
    grep -q "new-goal-5" "$MISSIONS_DIR/active.json" || {
        echo "FAIL: active.json was not switched to the new mission despite the old pointer being dangling"
        exit 1
    }
    echo "PASS: new_proceeds_when_active_pointer_dangling"
    ;;

  # --- F4: cmd_new() must fail CLOSED on a present-but-corrupt active mission ---
  #
  # Spec correction to F3 (found by @qa 2026-08-15, live against the shipped
  # F3 code): cmd_new()'s `except SystemExit: prior_fm = None` (mission.py
  # ~216-218) collapses "mission file absent" (A10, correctly permissive)
  # and "mission file present but parse_mission_file() can't read it" onto
  # the same fall-through-and-proceed path. A present-but-corrupt file is
  # the case where the user most likely HAS unresolved state; F4 requires
  # cmd_new() to refuse (fail closed) on this branch instead, distinct from
  # A10. See goldens/cmd_new_corrupt_mission_fail_closed.md.

  new_refuses_when_active_mission_malformed_yaml)
    # RED now: cmd_new proceeds unconditionally (same bug as A6/A7, but the
    # mechanism here is a caught SystemExit from a YAML parse error, not a
    # readable non-terminal status).
    SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$SANDBOX"' EXIT
    mkdir -p "$SANDBOX/.agent/memory/project/missions"
    MISSIONS_DIR="$SANDBOX/.agent/memory/project/missions"
    OLD="$MISSIONS_DIR/2026-08-01-corrupt-mission.md"
    cat > "$OLD" <<'EOF'
---
schema: athanor.mission/v1
slug: corrupt-mission
goal: [unterminated list
status: in_progress
---

# Corrupt fixture mission
EOF
    cat > "$MISSIONS_DIR/active.json" <<EOF
{"mission": "$OLD", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-08-01T00:00:00+00:00"}
EOF
    BEFORE="$(cat "$MISSIONS_DIR/active.json")"
    BEFORE_COUNT="$(find "$MISSIONS_DIR" -name '*.md' | wc -l | tr -d ' ')"

    set +e
    OUT="$(cd "$SANDBOX" && python3 "$MISSION_PY" new "brand new goal" --slug new-goal-6 2>&1)"
    RC=$?
    set -e

    if [ "$RC" -eq 0 ]; then
        echo "FAIL: mission.py new exited 0 while active.json pointed at a mission file with malformed YAML -- must refuse without --force"
        echo "$OUT"
        exit 1
    fi
    AFTER="$(cat "$MISSIONS_DIR/active.json" 2>/dev/null || echo MISSING)"
    if [ "$AFTER" != "$BEFORE" ]; then
        echo "FAIL: active.json was altered even though cmd_new refused (exit $RC) on a corrupt active mission file"
        echo "  before: $BEFORE"
        echo "  after:  $AFTER"
        exit 1
    fi
    AFTER_COUNT="$(find "$MISSIONS_DIR" -name '*.md' | wc -l | tr -d ' ')"
    if [ "$AFTER_COUNT" != "$BEFORE_COUNT" ]; then
        echo "FAIL: a new mission .md file was created even though cmd_new refused to activate it"
        exit 1
    fi
    echo "$OUT" | grep -qiE "unread|corrupt|parse|malformed" || {
        echo "FAIL: refusal produced no explanatory message mentioning the file could not be read/parsed"
        echo "$OUT"
        exit 1
    }
    echo "$OUT" | grep -q "corrupt-mission" || {
        echo "FAIL: refusal message did not name the corrupt file"
        echo "$OUT"
        exit 1
    }
    echo "PASS: new_refuses_when_active_mission_malformed_yaml"
    ;;

  new_refuses_when_active_mission_missing_frontmatter_delimiters)
    # RED now, same mechanism as malformed-YAML but the fixture never has
    # --- delimiters at all -- parse_mission_file fails its earlier
    # content.startswith("---") check, proving the fix isn't scoped
    # narrowly to YAML-syntax errors.
    SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$SANDBOX"' EXIT
    mkdir -p "$SANDBOX/.agent/memory/project/missions"
    MISSIONS_DIR="$SANDBOX/.agent/memory/project/missions"
    OLD="$MISSIONS_DIR/2026-08-01-no-delimiters-mission.md"
    cat > "$OLD" <<'EOF'
This mission file has no YAML frontmatter delimiters at all.
Just plain markdown body text.
EOF
    cat > "$MISSIONS_DIR/active.json" <<EOF
{"mission": "$OLD", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-08-01T00:00:00+00:00"}
EOF
    BEFORE="$(cat "$MISSIONS_DIR/active.json")"

    set +e
    OUT="$(cd "$SANDBOX" && python3 "$MISSION_PY" new "brand new goal" --slug new-goal-7 2>&1)"
    RC=$?
    set -e

    if [ "$RC" -eq 0 ]; then
        echo "FAIL: mission.py new exited 0 while active.json pointed at a mission file with no frontmatter delimiters -- must refuse without --force"
        echo "$OUT"
        exit 1
    fi
    AFTER="$(cat "$MISSIONS_DIR/active.json" 2>/dev/null || echo MISSING)"
    if [ "$AFTER" != "$BEFORE" ]; then
        echo "FAIL: active.json was altered even though cmd_new refused on a delimiter-less active mission file"
        exit 1
    fi
    echo "$OUT" | grep -qiE "unread|corrupt|parse|malformed" || {
        echo "FAIL: refusal produced no explanatory message mentioning the file could not be read/parsed"
        echo "$OUT"
        exit 1
    }
    echo "PASS: new_refuses_when_active_mission_missing_frontmatter_delimiters"
    ;;

  new_refuses_when_active_mission_empty_file)
    # RED now, same mechanism but a zero-byte fixture -- hits the same
    # startswith("---") branch as the missing-delimiters case via an
    # empty-string route, proving an "if not content: treat as absent"
    # shortcut wasn't accidentally introduced (that would wrongly conflate
    # this with A10's dangling-pointer case).
    SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$SANDBOX"' EXIT
    mkdir -p "$SANDBOX/.agent/memory/project/missions"
    MISSIONS_DIR="$SANDBOX/.agent/memory/project/missions"
    OLD="$MISSIONS_DIR/2026-08-01-empty-mission.md"
    : > "$OLD"
    cat > "$MISSIONS_DIR/active.json" <<EOF
{"mission": "$OLD", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-08-01T00:00:00+00:00"}
EOF
    BEFORE="$(cat "$MISSIONS_DIR/active.json")"

    set +e
    OUT="$(cd "$SANDBOX" && python3 "$MISSION_PY" new "brand new goal" --slug new-goal-8 2>&1)"
    RC=$?
    set -e

    if [ "$RC" -eq 0 ]; then
        echo "FAIL: mission.py new exited 0 while active.json pointed at a zero-byte mission file -- must refuse without --force"
        echo "$OUT"
        exit 1
    fi
    AFTER="$(cat "$MISSIONS_DIR/active.json" 2>/dev/null || echo MISSING)"
    if [ "$AFTER" != "$BEFORE" ]; then
        echo "FAIL: active.json was altered even though cmd_new refused on an empty active mission file"
        exit 1
    fi
    echo "PASS: new_refuses_when_active_mission_empty_file"
    ;;

  new_force_flag_overwrites_corrupt_mission_with_warning)
    # RED now: the unforced case doesn't even refuse yet, so there is
    # nothing meaningful for --force to override; once A11-A13 are fixed,
    # this proves the F3 --force escape hatch was extended to the
    # corrupt-file branch too, with the warning surviving.
    # NOTE: the fixture filename deliberately avoids the substrings
    # "corrupt"/"unread"/"orphan"/"warn" -- parse_mission_file() prints its
    # OWN diagnostic to stderr before cmd_new() ever catches the
    # SystemExit (see parse_mission_file, mission.py:122-124), and that
    # diagnostic includes the file's path. If the fixture's own filename
    # contained one of those words, a lenient grep against stdout+stderr
    # could pass by accident on parse_mission_file's leaked message alone,
    # without cmd_new() having ever emitted an intentional WARNING -- this
    # bit an earlier draft of this assertion (false PASS at RED time).
    SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$SANDBOX"' EXIT
    mkdir -p "$SANDBOX/.agent/memory/project/missions"
    MISSIONS_DIR="$SANDBOX/.agent/memory/project/missions"
    OLD="$MISSIONS_DIR/2026-08-01-active-force-fixture.md"
    cat > "$OLD" <<'EOF'
---
schema: athanor.mission/v1
slug: active-force-fixture
goal: [unterminated list
status: in_progress
---

# Fixture mission with malformed YAML (force case)
EOF
    cat > "$MISSIONS_DIR/active.json" <<EOF
{"mission": "$OLD", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-08-01T00:00:00+00:00"}
EOF

    set +e
    OUT="$(cd "$SANDBOX" && python3 "$MISSION_PY" new "brand new goal" --slug new-goal-9 --force 2>&1)"
    RC=$?
    set -e

    if [ "$RC" -ne 0 ]; then
        echo "FAIL: mission.py new --force exited $RC on a corrupt active mission file -- --force must override the refusal here too"
        echo "$OUT"
        exit 1
    fi
    grep -q "new-goal-9" "$MISSIONS_DIR/active.json" || {
        echo "FAIL: --force did not actually switch active.json to the new mission"
        cat "$MISSIONS_DIR/active.json" 2>/dev/null || echo "  (active.json missing)"
        exit 1
    }
    # Deliberately strict: only "WARNING" counts as an intentional
    # cmd_new()-authored disclosure. A loose "unread|corrupt|orphan|warn"
    # alternation would accept parse_mission_file's own "ERROR: YAML parse
    # error in ..." diagnostic as a false pass, since it's printed to
    # stderr regardless of what cmd_new() does with the SystemExit.
    echo "$OUT" | grep -q "WARNING" || {
        echo "FAIL: --force overwrote the corrupt-active-mission pointer without an intentional WARNING -- a leaked parse-error message from parse_mission_file does not count as disclosure"
        echo "$OUT"
        exit 1
    }
    echo "$OUT" | grep -q "active-force-fixture" || {
        echo "FAIL: warning did not name the orphaned corrupt file"
        echo "$OUT"
        exit 1
    }
    echo "PASS: new_force_flag_overwrites_corrupt_mission_with_warning"
    ;;

  new_refuses_when_active_mission_unreadable_permissions)
    # Best-effort: chmod 000 the active mission file so Path.read_text()
    # raises PermissionError -- a route that never reaches
    # parse_mission_file's own clean SystemExit(1), since read_text() is
    # called outside its try block (mission.py:106). Only requires exit
    # non-zero and active.json/mission-count untouched, either via a clean
    # refusal or an uncaught traceback -- both satisfy "did not silently
    # orphan the corrupt mission". Skipped (PASS) when running as root,
    # since root ignores POSIX permission bits and the fixture can't be
    # constructed.
    #
    # REGRESSION-GUARD NOTE (verified at RED time, 2026-08-15): this case
    # is NATURALLY PASSING against today's unmodified mission.py, same as
    # F3's A9/A10 -- not because cmd_new() handles it correctly by design,
    # but because the uncaught PermissionError crashes the process (exit 1
    # via Python traceback) BEFORE write_active() is ever reached, so
    # active.json happens to survive untouched by accident. It exists here
    # to catch an over-broad fix -- e.g. wrapping the whole
    # `if prior_path.exists():` block in `except Exception: prior_fm =
    # None` to "fix" A11-A13 -- that would swallow this PermissionError too
    # and start silently orphaning permission-denied mission files, which
    # is strictly worse than today's accidental crash-and-preserve.
    if [ "$(id -u)" = "0" ]; then
        echo "PASS: new_refuses_when_active_mission_unreadable_permissions (skipped -- running as root, permission fixture not constructible)"
        exit 0
    fi

    SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$SANDBOX"' EXIT
    mkdir -p "$SANDBOX/.agent/memory/project/missions"
    MISSIONS_DIR="$SANDBOX/.agent/memory/project/missions"
    OLD="$MISSIONS_DIR/2026-08-01-unreadable-mission.md"
    minimal_mission_file "$OLD" "unreadable-mission" "in_progress"
    chmod 000 "$OLD"
    cat > "$MISSIONS_DIR/active.json" <<EOF
{"mission": "$OLD", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-08-01T00:00:00+00:00"}
EOF
    BEFORE="$(cat "$MISSIONS_DIR/active.json")"
    BEFORE_COUNT="$(find "$MISSIONS_DIR" -name '*.md' | wc -l | tr -d ' ')"

    set +e
    OUT="$(cd "$SANDBOX" && python3 "$MISSION_PY" new "brand new goal" --slug new-goal-10 2>&1)"
    RC=$?
    set -e
    chmod 644 "$OLD" 2>/dev/null || true

    if [ "$RC" -eq 0 ]; then
        echo "FAIL: mission.py new exited 0 while active.json pointed at a permission-denied mission file -- must not silently orphan it"
        echo "$OUT"
        exit 1
    fi
    AFTER="$(cat "$MISSIONS_DIR/active.json" 2>/dev/null || echo MISSING)"
    if [ "$AFTER" != "$BEFORE" ]; then
        echo "FAIL: active.json was altered even though cmd_new failed on a permission-denied active mission file"
        echo "  before: $BEFORE"
        echo "  after:  $AFTER"
        exit 1
    fi
    AFTER_COUNT="$(find "$MISSIONS_DIR" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
    if [ "$AFTER_COUNT" != "$BEFORE_COUNT" ]; then
        echo "FAIL: a new mission .md file was created even though cmd_new failed to activate it"
        exit 1
    fi
    echo "PASS: new_refuses_when_active_mission_unreadable_permissions"
    ;;

  new_force_does_not_override_unreadable_permissions)
    # A15's unforced case and this --force case are NOT interchangeable:
    # PermissionError is not SystemExit, so it is never caught by cmd_new's
    # `except SystemExit:` arm at all, in either the forced or unforced
    # invocation -- the crash happens inside parse_mission_file() itself,
    # before cmd_new ever reaches its `getattr(args, "force", False)`
    # check. That means A15 (unforced) provides ZERO coverage for a
    # mutation that widens `except SystemExit:` to `except Exception:` --
    # under that mutation, the unforced case still refuses (matches A15),
    # but the FORCED case would newly succeed (exit 0, WARNING, active.json
    # repointed) because the widened except now swallows the
    # PermissionError and falls into the same forced-proceed branch as
    # A14's corrupt-YAML case. This case is what actually detects that
    # mutation. Skipped (PASS) when running as root, same as A15.
    #
    # Position (adjudicated 2026-08-15, per @qa's finding and team-lead's
    # proposed resolution, evaluated and adopted by @architect): --force
    # must NOT override a permission-denied file. --force means "I
    # understand what I am orphaning and choose to" -- a file we cannot
    # read at all gives the user nothing to base that understanding on.
    # This is consistent with (not a new restriction beyond) cmd_abandon/
    # cmd_close_out, which have ZERO override for ANY corrupt file, not
    # just permission-denied ones -- a user hitting this needs the same
    # manual-repair fallback (chmod +r, or delete/re-point active.json by
    # hand) that already applies to every other unrecoverable-file case in
    # this spec family. Verified today's unforced AND forced behavior are
    # already identical (both crash uncaught, active.json untouched) --
    # this is a naturally-passing regression guard, not a RED assertion.
    if [ "$(id -u)" = "0" ]; then
        echo "PASS: new_force_does_not_override_unreadable_permissions (skipped -- running as root, permission fixture not constructible)"
        exit 0
    fi

    SANDBOX="$(mktemp -d)"
    trap 'rm -rf "$SANDBOX"' EXIT
    mkdir -p "$SANDBOX/.agent/memory/project/missions"
    MISSIONS_DIR="$SANDBOX/.agent/memory/project/missions"
    OLD="$MISSIONS_DIR/2026-08-01-unreadable-force-mission.md"
    minimal_mission_file "$OLD" "unreadable-force-mission" "in_progress"
    chmod 000 "$OLD"
    cat > "$MISSIONS_DIR/active.json" <<EOF
{"mission": "$OLD", "checkpoint": {"milestone": null, "feature": null}, "activated_at": "2026-08-01T00:00:00+00:00"}
EOF
    BEFORE="$(cat "$MISSIONS_DIR/active.json")"
    BEFORE_COUNT="$(find "$MISSIONS_DIR" -name '*.md' | wc -l | tr -d ' ')"

    set +e
    OUT="$(cd "$SANDBOX" && python3 "$MISSION_PY" new "brand new goal" --slug new-goal-16 --force 2>&1)"
    RC=$?
    set -e
    chmod 644 "$OLD" 2>/dev/null || true

    if [ "$RC" -eq 0 ]; then
        echo "FAIL: mission.py new --force exited 0 while active.json pointed at a permission-denied mission file -- --force must not be able to override state that was never read (only readable-but-inconvenient state)"
        echo "$OUT"
        exit 1
    fi
    AFTER="$(cat "$MISSIONS_DIR/active.json" 2>/dev/null || echo MISSING)"
    if [ "$AFTER" != "$BEFORE" ]; then
        echo "FAIL: active.json was altered by --force even though the active mission file was permission-denied and never actually read"
        echo "  before: $BEFORE"
        echo "  after:  $AFTER"
        exit 1
    fi
    AFTER_COUNT="$(find "$MISSIONS_DIR" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
    if [ "$AFTER_COUNT" != "$BEFORE_COUNT" ]; then
        echo "FAIL: a new mission .md file was created despite --force being refused on a permission-denied active mission"
        exit 1
    fi
    echo "PASS: new_force_does_not_override_unreadable_permissions"
    ;;

  *)
    echo "FAIL: unknown case '$CASE'"
    exit 2
    ;;

esac
