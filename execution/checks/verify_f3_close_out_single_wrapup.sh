#!/usr/bin/env bash
# verify_f3_close_out_single_wrapup.sh -- golden-file behavioral check for mission
# harness-integrity-hardening F3 (adversarial review Finding 4).
#
# Bug: two independent close-out procedures each unconditionally did a brain
# wrap-up on the same mission -- execution/mission.py's cmd_close_out (called
# execution/brain.py wrap-up directly, then clear_active() itself) AND
# execution/skills/wrap_mission.sh (also calls execution/brain.py wrap-up
# unconditionally, then commits+pushes, then clears active.json via the
# mission_complete.py three-valued check). The documented workflow
# (wrap-mission.md: "the final step of every mission") had an agent run
# `mission.py close-out` and then `wrap_mission.sh` in sequence -- producing
# TWO brain memory entries for one mission completion.
#
# Fix contract this script enforces: mission.py's cmd_close_out no longer
# calls execution/brain.py itself and no longer calls clear_active() itself.
# It transitions the mission file to status: done FIRST (so wrap_mission.sh's
# mission_complete.py check reads status=done from disk), then delegates to
# `bash execution/skills/wrap_mission.sh "<slug>: <goal>" "mission,<slug>,complete"`
# as the SOLE path that performs brain wrap-up + commit + push (WRAP_NO_PUSH=1
# forced) + active.json-clear. wrap_mission.sh itself is NOT modified. Running
# `mission.py close-out` ALONE is now the complete, documented, self-sufficient
# workflow -- a manual wrap_mission.sh follow-up is no longer part of it (see
# A7) and, if run anyway, would write a second brain entry (not tested here;
# that composition is explicitly out of golden scope).
#
# This drives the REAL execution/mission.py, execution/skills/wrap_mission.sh,
# execution/skills/lib/secret_guard.py and execution/skills/lib/mission_complete.py
# end-to-end in an isolated sandbox with a stub execution/brain.py (counts
# invocations instead of writing to the real semantic memory store) and a
# local throwaway git repo (no real repo state is ever touched).
#
# Usage: verify_f3_close_out_single_wrapup.sh <case>
#   close_out_documented_workflow -- run `mission.py close-out` ALONE, the
#                                     complete documented workflow. Asserts
#                                     exactly ONE brain wrap-up call, mission
#                                     file ends status: done with
#                                     completed_at/last_active_at set,
#                                     active.json cleared once, and stdout
#                                     contains no ERROR: lines.
#   close_out_alone_delegates    -- run `mission.py close-out` ALONE.
#                                    Asserts brain wrap-up was still called
#                                    (via delegation), commit was made
#                                    (wrap_mission.sh's git commit ran), and
#                                    active.json was cleared -- proving
#                                    close-out alone is now a complete,
#                                    self-sufficient terminal step.
#   close_out_never_pushes       -- run `mission.py close-out` ALONE with
#                                    WRAP_NO_PUSH unset in the invoking
#                                    environment and a real, reachable local
#                                    bare remote configured. Asserts exit 0,
#                                    exactly 1 brain call, and ZERO commits
#                                    reach the bare remote -- proving
#                                    mission.py forces WRAP_NO_PUSH=1 into the
#                                    child process itself.
#   close_out_secret_guard_preflight -- run `mission.py close-out` with a
#                                    secret-looking untracked file present.
#                                    Asserts exit nonzero, ZERO brain calls,
#                                    mission file unchanged (status still
#                                    close_out, no completed_at), and
#                                    active.json byte-identical to before the
#                                    call -- the pre-flight refuses before any
#                                    state mutation, rather than cleaning up
#                                    after wrap_mission.sh's own (later,
#                                    post-brain-call) secret guard trips.
#   close_out_rollback_on_delegate_failure -- force the sandbox's delegate to
#                                    fail for a non-secret reason. Asserts the
#                                    first (failing) call exits nonzero and
#                                    rolls the mission file back to status
#                                    close_out with completed_at/last_active_at
#                                    removed, then that an immediately
#                                    following close-out call (real delegate
#                                    restored) passes the status==close_out
#                                    guard and completes cleanly (status done,
#                                    exactly 1 brain call total).
#   boot_treats_nulled_active_as_absent -- run the real execution/hooks/full_boot.sh
#                                    against an active.json already cleared to
#                                    {"mission": null, ...} (the post-close-out
#                                    state). Asserts exit 0, "No active
#                                    mission" is reported, and neither "stale
#                                    mission pointer" nor "Run /mission
#                                    resume" is emitted.
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CASE="${1:-}"
GOLDEN_MISSION="$REPO_ROOT/.agent/memory/project/specs/harness-integrity-hardening/goldens/f3_close_out_mission.md"

if [ ! -f "$GOLDEN_MISSION" ]; then
  echo "FAIL: golden fixture mission not found: $GOLDEN_MISSION" >&2
  exit 1
fi

setup_sandbox() {
  SANDBOX="$(mktemp -d)"
  mkdir -p "$SANDBOX/execution/skills/lib" "$SANDBOX/.agent/memory/project/missions"

  # Real, unmodified harness files under test -- always copied live from the
  # repo so this script reflects whatever state execution/mission.py and
  # execution/skills/wrap_mission.sh are ACTUALLY in right now (RED pre-fix,
  # GREEN post-fix).
  cp "$REPO_ROOT/execution/mission.py" "$SANDBOX/execution/mission.py"
  cp "$REPO_ROOT/execution/skills/wrap_mission.sh" "$SANDBOX/execution/skills/wrap_mission.sh"
  cp "$REPO_ROOT/execution/skills/lib/secret_guard.py" "$SANDBOX/execution/skills/lib/secret_guard.py"
  cp "$REPO_ROOT/execution/skills/lib/mission_complete.py" "$SANDBOX/execution/skills/lib/mission_complete.py"
  chmod +x "$SANDBOX/execution/skills/wrap_mission.sh"

  # Stub brain.py -- counts invocations instead of touching the real
  # semantic memory store. Mirrors the real CLI surface wrap_mission.sh and
  # mission.py depend on: `brain.py wrap-up -s <summary> -t <tags>`.
  cat > "$SANDBOX/execution/brain.py" <<'BRAIN_EOF'
#!/usr/bin/env python3
import sys, pathlib
log = pathlib.Path(__file__).resolve().parent.parent / "brain_calls.log"
with open(log, "a") as f:
    f.write(" ".join(sys.argv[1:]) + "\n")
sys.exit(0)
BRAIN_EOF

  MISSION_FILE="$SANDBOX/.agent/memory/project/missions/f3-close-out-fixture.md"
  cp "$GOLDEN_MISSION" "$MISSION_FILE"
  cat > "$SANDBOX/.agent/memory/project/missions/active.json" <<EOF
{"mission": "$MISSION_FILE", "checkpoint": {"milestone": "M1", "feature": "F1"}, "activated_at": "2026-07-28T00:00:00+00:00"}
EOF

  # Throwaway local git repo so wrap_mission.sh's git add/commit/push steps
  # run harmlessly in isolation -- never touches the real Athanor repo.
  ( cd "$SANDBOX" \
    && git init -q \
    && git config user.email "fixture@example.com" \
    && git config user.name "Fixture" \
    && git add -A \
    && git commit -q -m "sandbox init" )
}

count_brain_calls() {
  if [ -f "$SANDBOX/brain_calls.log" ]; then
    wc -l < "$SANDBOX/brain_calls.log" | tr -d ' [:space:]'
  else
    echo 0
  fi
}

# active.json is "cleared" per the golden if it's either removed entirely or
# emptied to {"mission": null, ...} -- wrap_mission.sh's clear step writes
# null values rather than deleting the file, unlike mission.py's own
# (no-longer-called) clear_active().
active_json_cleared() {
  local f="$SANDBOX/.agent/memory/project/missions/active.json"
  if [ ! -f "$f" ]; then
    return 0
  fi
  grep -q '"mission": *null' "$f"
}

case "$CASE" in
  close_out_documented_workflow)
    setup_sandbox
    MISSION_FILE="$SANDBOX/.agent/memory/project/missions/f3-close-out-fixture.md"

    ( cd "$SANDBOX" && WRAP_NO_PUSH=1 python3 execution/mission.py close-out "$MISSION_FILE" ) \
      >"$SANDBOX/close_out.out" 2>&1
    CLOSE_RC=$?
    if [ "$CLOSE_RC" -ne 0 ]; then
      echo "FAIL: mission.py close-out exited non-zero ($CLOSE_RC)" >&2
      cat "$SANDBOX/close_out.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    N="$(count_brain_calls)"
    if [ "$N" != "1" ]; then
      echo "FAIL: expected exactly 1 brain wrap-up call from the documented close-out workflow, got $N" >&2
      echo "--- brain_calls.log ---" >&2
      cat "$SANDBOX/brain_calls.log" 2>/dev/null >&2
      echo "--- close_out.out ---" >&2; cat "$SANDBOX/close_out.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    if ! grep -q "^status: done$" "$MISSION_FILE"; then
      echo "FAIL: mission file was not left at status: done" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    if ! grep -q "^completed_at:" "$MISSION_FILE"; then
      echo "FAIL: mission file is missing completed_at" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    if ! grep -q "^last_active_at:" "$MISSION_FILE"; then
      echo "FAIL: mission file is missing last_active_at" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    if ! active_json_cleared; then
      echo "FAIL: active.json was not cleared by the documented close-out workflow" >&2
      cat "$SANDBOX/.agent/memory/project/missions/active.json" 2>/dev/null >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    if grep -q "ERROR:" "$SANDBOX/close_out.out"; then
      echo "FAIL: close-out stdout/stderr contains an ERROR: line" >&2
      cat "$SANDBOX/close_out.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    echo "PASS: close_out_documented_workflow -- exactly 1 brain wrap-up, status=done with completed_at/last_active_at, active.json cleared once, no ERROR:"
    rm -rf "$SANDBOX"
    ;;

  close_out_alone_delegates)
    setup_sandbox
    MISSION_FILE="$SANDBOX/.agent/memory/project/missions/f3-close-out-fixture.md"

    ( cd "$SANDBOX" && WRAP_NO_PUSH=1 python3 execution/mission.py close-out "$MISSION_FILE" ) \
      >"$SANDBOX/close_out.out" 2>&1
    CLOSE_RC=$?
    if [ "$CLOSE_RC" -ne 0 ]; then
      echo "FAIL: mission.py close-out exited non-zero ($CLOSE_RC) when run alone" >&2
      cat "$SANDBOX/close_out.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    N="$(count_brain_calls)"
    if [ "$N" != "1" ]; then
      echo "FAIL: mission.py close-out run ALONE must still trigger exactly 1 brain wrap-up (via delegation to wrap_mission.sh), got $N -- close-out is not self-sufficient" >&2
      cat "$SANDBOX/close_out.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    if ! active_json_cleared; then
      echo "FAIL: active.json was not cleared by close-out run alone -- close-out no longer clears it directly and must delegate to wrap_mission.sh" >&2
      cat "$SANDBOX/.agent/memory/project/missions/active.json" 2>/dev/null >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    COMMIT_COUNT="$(cd "$SANDBOX" && git log --oneline | wc -l | tr -d ' [:space:]')"
    if [ "$COMMIT_COUNT" -lt 2 ]; then
      echo "FAIL: no commit was made by close-out run alone -- expected delegation to wrap_mission.sh to commit the close-out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    echo "PASS: close_out_alone_delegates -- close-out alone delegates to wrap_mission.sh (1 brain call, 1 commit, active.json cleared)"
    rm -rf "$SANDBOX"
    ;;

  close_out_never_pushes)
    setup_sandbox
    MISSION_FILE="$SANDBOX/.agent/memory/project/missions/f3-close-out-fixture.md"

    # Real, reachable local bare remote -- proves the no-push guarantee
    # comes from mission.py forcing WRAP_NO_PUSH=1 into the child process,
    # not from "no remote configured" accidentally saving us.
    BARE="$(mktemp -d)/origin.git"
    git init -q --bare "$BARE"
    ( cd "$SANDBOX" && git remote add origin "$BARE" )

    # WRAP_NO_PUSH deliberately UNSET in the invoking environment -- the
    # guarantee must come from mission.py forcing it into the subprocess,
    # not from caller discipline.
    ( cd "$SANDBOX" && env -u WRAP_NO_PUSH python3 execution/mission.py close-out "$MISSION_FILE" ) \
      >"$SANDBOX/close_out.out" 2>&1
    CLOSE_RC=$?
    if [ "$CLOSE_RC" -ne 0 ]; then
      echo "FAIL: mission.py close-out exited non-zero ($CLOSE_RC) with WRAP_NO_PUSH unset and a real remote configured" >&2
      cat "$SANDBOX/close_out.out" >&2
      rm -rf "$SANDBOX" "$(dirname "$BARE")"
      exit 1
    fi

    N="$(count_brain_calls)"
    if [ "$N" != "1" ]; then
      echo "FAIL: expected exactly 1 brain wrap-up call, got $N" >&2
      cat "$SANDBOX/close_out.out" >&2
      rm -rf "$SANDBOX" "$(dirname "$BARE")"
      exit 1
    fi

    BARE_COMMITS="$(git --git-dir="$BARE" log --oneline 2>/dev/null | wc -l | tr -d ' [:space:]')"
    if [ "$BARE_COMMITS" != "0" ]; then
      echo "FAIL: expected ZERO commits pushed to the bare remote, got $BARE_COMMITS -- close-out must never push" >&2
      cat "$SANDBOX/close_out.out" >&2
      rm -rf "$SANDBOX" "$(dirname "$BARE")"
      exit 1
    fi

    echo "PASS: close_out_never_pushes -- WRAP_NO_PUSH=1 forced into the child even with a real reachable remote and no WRAP_NO_PUSH in the caller's env"
    rm -rf "$SANDBOX" "$(dirname "$BARE")"
    ;;

  close_out_secret_guard_preflight)
    # Sub-case (1): secret-looking file merely present/untracked -- would be
    # newly staged by wrap_mission.sh's own `git add -A`.
    setup_sandbox
    MISSION_FILE="$SANDBOX/.agent/memory/project/missions/f3-close-out-fixture.md"
    BEFORE_ACTIVE="$(cat "$SANDBOX/.agent/memory/project/missions/active.json")"
    echo "SUPER_SECRET=1" > "$SANDBOX/.env"

    ( cd "$SANDBOX" && WRAP_NO_PUSH=1 python3 execution/mission.py close-out "$MISSION_FILE" ) \
      >"$SANDBOX/close_out.out" 2>&1
    CLOSE_RC=$?
    if [ "$CLOSE_RC" -eq 0 ]; then
      echo "FAIL: [untracked] mission.py close-out should have refused (exit nonzero) with a secret-looking file present, but exited 0" >&2
      cat "$SANDBOX/close_out.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    N="$(count_brain_calls)"
    if [ "$N" != "0" ]; then
      echo "FAIL: [untracked] expected ZERO brain calls when the secret-guard pre-flight refuses close-out, got $N" >&2
      cat "$SANDBOX/close_out.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    if ! grep -q "^status: close_out$" "$MISSION_FILE"; then
      echo "FAIL: [untracked] mission file status should remain close_out when the secret-guard pre-flight refuses close-out" >&2
      cat "$MISSION_FILE" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    if grep -q "^completed_at:" "$MISSION_FILE"; then
      echo "FAIL: [untracked] mission file should have no completed_at when the secret-guard pre-flight refuses close-out" >&2
      cat "$MISSION_FILE" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    AFTER_ACTIVE="$(cat "$SANDBOX/.agent/memory/project/missions/active.json")"
    if [ "$BEFORE_ACTIVE" != "$AFTER_ACTIVE" ]; then
      echo "FAIL: [untracked] active.json was touched by a close-out call that the secret-guard pre-flight should have refused before any state change" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    rm -rf "$SANDBOX"

    # Sub-case (2): secret-looking file ALREADY staged via `git add` before
    # close-out is invoked (operator ran `git add .` / `git add -f` earlier).
    # `git add -A -n` alone is silent about this -- it only reports what
    # would be NEWLY staged -- so this sub-case is what actually exercises
    # the `git diff --cached --name-only` half of the union fix.
    setup_sandbox
    MISSION_FILE="$SANDBOX/.agent/memory/project/missions/f3-close-out-fixture.md"
    BEFORE_ACTIVE="$(cat "$SANDBOX/.agent/memory/project/missions/active.json")"
    echo "SUPER_SECRET=1" > "$SANDBOX/.env"
    ( cd "$SANDBOX" && git add -f .env )

    ( cd "$SANDBOX" && WRAP_NO_PUSH=1 python3 execution/mission.py close-out "$MISSION_FILE" ) \
      >"$SANDBOX/close_out.out" 2>&1
    CLOSE_RC=$?
    if [ "$CLOSE_RC" -eq 0 ]; then
      echo "FAIL: [already-staged] mission.py close-out should have refused (exit nonzero) with a secret-looking file already staged, but exited 0" >&2
      cat "$SANDBOX/close_out.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    N="$(count_brain_calls)"
    if [ "$N" != "0" ]; then
      echo "FAIL: [already-staged] expected ZERO brain calls when the secret-guard pre-flight refuses close-out, got $N -- git add -A -n alone would miss an already-staged secret" >&2
      cat "$SANDBOX/close_out.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    if ! grep -q "^status: close_out$" "$MISSION_FILE"; then
      echo "FAIL: [already-staged] mission file status should remain close_out when the secret-guard pre-flight refuses close-out" >&2
      cat "$MISSION_FILE" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    if grep -q "^completed_at:" "$MISSION_FILE"; then
      echo "FAIL: [already-staged] mission file should have no completed_at when the secret-guard pre-flight refuses close-out" >&2
      cat "$MISSION_FILE" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    AFTER_ACTIVE="$(cat "$SANDBOX/.agent/memory/project/missions/active.json")"
    if [ "$BEFORE_ACTIVE" != "$AFTER_ACTIVE" ]; then
      echo "FAIL: [already-staged] active.json was touched by a close-out call that the secret-guard pre-flight should have refused before any state change" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    echo "PASS: close_out_secret_guard_preflight -- refused before any mutation in BOTH cases (untracked secret, already-staged secret): 0 brain calls, status still close_out, no completed_at, active.json untouched"
    rm -rf "$SANDBOX"
    ;;

  close_out_rollback_on_delegate_failure)
    setup_sandbox
    MISSION_FILE="$SANDBOX/.agent/memory/project/missions/f3-close-out-fixture.md"

    # Preserve the real (working) wrap_mission.sh, then swap in a stub that
    # fails for a non-secret reason -- simulates any delegate failure that
    # isn't the secret-guard pre-flight's concern (e.g. a downstream git
    # error), entirely within this sandbox copy. The real repo file is never
    # touched (see A5).
    cp "$SANDBOX/execution/skills/wrap_mission.sh" "$SANDBOX/execution/skills/wrap_mission.sh.real"
    cat > "$SANDBOX/execution/skills/wrap_mission.sh" <<'STUB_EOF'
#!/usr/bin/env bash
echo "[stub-wrap-mission] simulated non-secret delegate failure" >&2
exit 7
STUB_EOF
    chmod +x "$SANDBOX/execution/skills/wrap_mission.sh"

    ( cd "$SANDBOX" && WRAP_NO_PUSH=1 python3 execution/mission.py close-out "$MISSION_FILE" ) \
      >"$SANDBOX/close_out_fail.out" 2>&1
    FAIL_RC=$?
    if [ "$FAIL_RC" -eq 0 ]; then
      echo "FAIL: mission.py close-out should have exited nonzero when the delegate fails" >&2
      cat "$SANDBOX/close_out_fail.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    if ! grep -q "^status: close_out$" "$MISSION_FILE"; then
      echo "FAIL: mission file status was not rolled back to close_out after a delegate failure" >&2
      cat "$MISSION_FILE" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    if grep -q "^completed_at:" "$MISSION_FILE"; then
      echo "FAIL: completed_at was not removed on rollback after a delegate failure" >&2
      cat "$MISSION_FILE" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    if grep -q "^last_active_at:" "$MISSION_FILE"; then
      echo "FAIL: last_active_at was not removed on rollback after a delegate failure" >&2
      cat "$MISSION_FILE" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    # Restore the real delegate and confirm an immediately-following close-out
    # run now passes the status==close_out guard and completes cleanly.
    mv "$SANDBOX/execution/skills/wrap_mission.sh.real" "$SANDBOX/execution/skills/wrap_mission.sh"
    chmod +x "$SANDBOX/execution/skills/wrap_mission.sh"

    ( cd "$SANDBOX" && WRAP_NO_PUSH=1 python3 execution/mission.py close-out "$MISSION_FILE" ) \
      >"$SANDBOX/close_out_retry.out" 2>&1
    RETRY_RC=$?
    if [ "$RETRY_RC" -ne 0 ]; then
      echo "FAIL: the retry close-out run (after rollback, with the real delegate restored) should have succeeded but exited $RETRY_RC" >&2
      cat "$SANDBOX/close_out_retry.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    if grep -q "expected 'close_out'" "$SANDBOX/close_out_retry.out"; then
      echo "FAIL: retry close-out run hit the status==close_out guard -- rollback did not restore status correctly" >&2
      cat "$SANDBOX/close_out_retry.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    if ! grep -q "^status: done$" "$MISSION_FILE"; then
      echo "FAIL: mission file was not left at status: done after the successful retry" >&2
      cat "$MISSION_FILE" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    N="$(count_brain_calls)"
    if [ "$N" != "1" ]; then
      echo "FAIL: expected exactly 1 brain call from the successful retry (0 from the failed attempt, 1 from the retry), got $N" >&2
      cat "$SANDBOX/brain_calls.log" 2>/dev/null >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    echo "PASS: close_out_rollback_on_delegate_failure -- rolled back to close_out with timestamps removed on failure, retry with the real delegate then succeeds cleanly"
    rm -rf "$SANDBOX"
    ;;

  boot_treats_nulled_active_as_absent)
    BOOT_SANDBOX="$(mktemp -d)"
    mkdir -p "$BOOT_SANDBOX/.agent/memory/project/missions" "$BOOT_SANDBOX/execution/hooks" "$BOOT_SANDBOX/execution"
    cp "$REPO_ROOT/execution/hooks/full_boot.sh" "$BOOT_SANDBOX/execution/hooks/full_boot.sh"
    cp "$REPO_ROOT/execution/mission.py" "$BOOT_SANDBOX/execution/mission.py"
    cat > "$BOOT_SANDBOX/.agent/memory/project/missions/active.json" <<'EOF'
{"mission": null, "checkpoint": null, "note": "mission complete"}
EOF

    ( cd "$BOOT_SANDBOX" && bash execution/hooks/full_boot.sh ) >"$BOOT_SANDBOX/boot.out" 2>&1
    BOOT_RC=$?
    if [ "$BOOT_RC" -ne 0 ]; then
      echo "FAIL: full_boot.sh exited non-zero ($BOOT_RC) with a nulled active.json" >&2
      cat "$BOOT_SANDBOX/boot.out" >&2
      rm -rf "$BOOT_SANDBOX"
      exit 1
    fi

    if ! grep -q "No active mission" "$BOOT_SANDBOX/boot.out"; then
      echo "FAIL: full_boot.sh did not report 'No active mission' for a nulled active.json" >&2
      cat "$BOOT_SANDBOX/boot.out" >&2
      rm -rf "$BOOT_SANDBOX"
      exit 1
    fi

    if grep -qi "stale mission pointer" "$BOOT_SANDBOX/boot.out"; then
      echo "FAIL: full_boot.sh emitted 'stale mission pointer' for a nulled active.json -- should treat it as absent" >&2
      cat "$BOOT_SANDBOX/boot.out" >&2
      rm -rf "$BOOT_SANDBOX"
      exit 1
    fi

    if grep -q "Run /mission resume" "$BOOT_SANDBOX/boot.out"; then
      echo "FAIL: full_boot.sh emitted 'Run /mission resume to continue.' for a nulled active.json -- should treat it as absent" >&2
      cat "$BOOT_SANDBOX/boot.out" >&2
      rm -rf "$BOOT_SANDBOX"
      exit 1
    fi

    echo "PASS: boot_treats_nulled_active_as_absent -- reports 'No active mission', no stale-pointer/resume messaging"
    rm -rf "$BOOT_SANDBOX"
    ;;

  *)
    echo "FAIL: unknown case '$CASE' (expected close_out_documented_workflow|close_out_alone_delegates|close_out_never_pushes|close_out_secret_guard_preflight|close_out_rollback_on_delegate_failure|boot_treats_nulled_active_as_absent)" >&2
    exit 1
    ;;
esac
