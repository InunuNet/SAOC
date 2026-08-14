#!/usr/bin/env bash
# verify_f4_scope_guard.sh -- golden-file behavioral check for mission
# verification-integrity F4.
#
# Bug (observed LIVE 2026-07-30): execution/skills/wrap_mission.sh runs an
# unscoped `git add -A`, so a mission close-out commit sweeps in whatever
# else happens to be dirty in the working tree. Real repro commit
# 2347e31767f1e0fd34eb2635edddfbc519639cfd ("chore(auto): mission complete
# -- 2026-07-28-harness-integrity-hardening") committed .anti/agents.json
# and .claude/settings.json alongside the mission state -- both files
# belonging to OTHER, concurrently-running sessions, not this mission.
#
# Fix contract this script enforces: wrap_mission.sh must
#   (a) NEVER stage or commit .claude/worktrees/** -- these are OTHER
#       agents' live git worktree checkouts, always structurally present
#       during concurrent multi-agent sessions, and never legitimate
#       commit content. Silently excluded: never blocks, never staged.
#   (b) REFUSE (exit nonzero, no brain wrap-up, no stage, no commit) when
#       any file on a small denylist of shared/generated harness
#       infrastructure (.claude/settings.json, .claude/settings.local.json,
#       .gemini/settings.json, .anti/agents.json) is dirty, UNLESS the
#       caller explicitly opts in via WRAP_ALLOW_OUT_OF_SCOPE=1. This is the
#       exact set that caused the live incident.
#   (c) otherwise behave exactly as before -- `git add -A` (minus the
#       worktrees exclusion) still sweeps up the mission's own broad,
#       multi-directory change set (code, tests, docs, specs, memory) in one
#       commit. This is NOT a narrow allowlist -- real close-out commits
#       routinely touch execution/, tests/, .agent/memory/, .gemini/, etc.
#       (see git history), so scoping staging down to only
#       .agent/memory/** would break ordinary close-outs.
#
# This drives the REAL execution/skills/wrap_mission.sh and, for the
# rollback case, execution/mission.py, end-to-end in an isolated sandbox
# with a stub execution/brain.py (counts invocations) and a local throwaway
# git repo. Never touches the real Athanor repo, never runs `git stash`,
# never touches the live working tree.
#
# Usage: verify_f4_scope_guard.sh <case>
#   out_of_scope_blocks          -- a denylisted file (.claude/settings.json)
#                                    dirty alongside a legitimate mission
#                                    file. wrap_mission.sh must exit
#                                    nonzero, make ZERO commits, and leave
#                                    the working tree's dirty files
#                                    unstaged.
#   worktree_noise_excluded      -- .claude/worktrees/agent-xxx/foo (an
#                                    untracked "other session's worktree"
#                                    file) dirty alongside a legitimate
#                                    mission file. wrap_mission.sh must
#                                    succeed, commit exactly once, and the
#                                    resulting commit's file list
#                                    (git show --name-only) must NOT
#                                    contain the worktrees path.
#   broad_sweep_unaffected       -- dirty files spread across several
#                                    ordinary repo directories (execution/,
#                                    tests/, docs/, .agent/memory/), none of
#                                    them denylisted or under worktrees.
#                                    wrap_mission.sh must commit ALL of them
#                                    together in one commit -- proves the
#                                    fix is not a narrow allowlist.
#   allow_override_works         -- same as out_of_scope_blocks, but with
#                                    WRAP_ALLOW_OUT_OF_SCOPE=1 set.
#                                    wrap_mission.sh must succeed and the
#                                    denylisted file must be present in the
#                                    resulting commit.
#   abort_before_brain_call      -- same as out_of_scope_blocks. Asserts
#                                    ZERO brain.py invocations occurred --
#                                    the scope check must run BEFORE the
#                                    unconditional brain wrap-up call, not
#                                    after (mirrors the F3 ordering fix;
#                                    an abort AFTER the brain call would
#                                    reintroduce the stuck-state/duplicate-
#                                    entry failure mode F3 fixed).
#   close_out_rollback_on_scope_abort -- run `mission.py close-out` (not
#                                    wrap_mission.sh directly) with a
#                                    denylisted file dirty. Asserts
#                                    close-out exits nonzero, ZERO brain
#                                    calls, mission file status rolled back
#                                    to close_out (not left at done), and
#                                    an immediately-following close-out
#                                    retry (denylisted file removed)
#                                    succeeds cleanly -- proves F3's
#                                    existing rollback-on-delegate-failure
#                                    path already generalizes to this new
#                                    abort reason with no mission.py change
#                                    required.
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CASE="${1:-}"

setup_sandbox() {
  SANDBOX="$(mktemp -d)"
  mkdir -p "$SANDBOX/execution/skills/lib" "$SANDBOX/.agent/memory/project/missions" \
           "$SANDBOX/.agent/memory/project" "$SANDBOX/execution/tests" \
           "$SANDBOX/tests" "$SANDBOX/docs"

  # Real, unmodified harness files under test -- always copied live from the
  # repo so this script reflects whatever state wrap_mission.sh (and, for
  # the rollback case, mission.py) are ACTUALLY in right now (RED pre-fix,
  # GREEN post-fix).
  cp "$REPO_ROOT/execution/mission.py" "$SANDBOX/execution/mission.py"
  cp "$REPO_ROOT/execution/skills/wrap_mission.sh" "$SANDBOX/execution/skills/wrap_mission.sh"
  cp "$REPO_ROOT/execution/skills/lib/secret_guard.py" "$SANDBOX/execution/skills/lib/secret_guard.py"
  cp "$REPO_ROOT/execution/skills/lib/mission_complete.py" "$SANDBOX/execution/skills/lib/mission_complete.py"
  chmod +x "$SANDBOX/execution/skills/wrap_mission.sh"

  # Stub brain.py -- counts invocations instead of touching the real
  # semantic memory store.
  cat > "$SANDBOX/execution/brain.py" <<'BRAIN_EOF'
#!/usr/bin/env python3
import sys, pathlib
log = pathlib.Path(__file__).resolve().parent.parent / "brain_calls.log"
with open(log, "a") as f:
    f.write(" ".join(sys.argv[1:]) + "\n")
sys.exit(0)
BRAIN_EOF

  cat > "$SANDBOX/.agent/memory/project/missions/f4-scope-fixture.md" <<'EOF'
---
schema: athanor.mission/v1
slug: f4-scope-fixture
goal: Golden fixture for F4 scope-guard checks.
created_at: "2026-08-05"
status: close_out
autonomy: high
features:
  - id: F1
    name: Fixture feature (done)
    status: done
milestones:
  - id: M1
    name: Fixture milestone (done)
    features: [F1]
    status: done
---

# Mission: f4-scope-fixture

Fixture only. Used by verify_f4_scope_guard.sh.
EOF

  cat > "$SANDBOX/.agent/memory/project/missions/active.json" <<EOF
{"mission": "$SANDBOX/.agent/memory/project/missions/f4-scope-fixture.md", "checkpoint": {"milestone": "M1", "feature": "F1"}, "activated_at": "2026-08-05T00:00:00+00:00"}
EOF

  # Throwaway local git repo. Never the real Athanor repo.
  ( cd "$SANDBOX" \
    && git init -q \
    && git config user.email "fixture@example.com" \
    && git config user.name "Fixture" \
    && mkdir -p .claude .anti \
    && echo '{"placeholder": true}' > .claude/settings.json \
    && echo '{"placeholder": true}' > .anti/agents.json \
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

commit_count() {
  ( cd "$SANDBOX" && git log --oneline | wc -l | tr -d ' [:space:]' )
}

case "$CASE" in
  out_of_scope_blocks)
    setup_sandbox
    # Legitimate mission-relevant dirt.
    echo "learned something" >> "$SANDBOX/.agent/memory/project/learned.md"
    # Denylisted, out-of-scope dirt -- exactly the live-incident file.
    echo '{"changed": true}' > "$SANDBOX/.claude/settings.json"
    BEFORE_COMMITS="$(commit_count)"

    ( cd "$SANDBOX" && bash execution/skills/wrap_mission.sh "test" "test" ) \
      >"$SANDBOX/wrap.out" 2>&1
    RC=$?
    if [ "$RC" -eq 0 ]; then
      echo "FAIL: wrap_mission.sh should have refused (exit nonzero) with .claude/settings.json dirty, but exited 0" >&2
      cat "$SANDBOX/wrap.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    AFTER_COMMITS="$(commit_count)"
    if [ "$AFTER_COMMITS" != "$BEFORE_COMMITS" ]; then
      echo "FAIL: wrap_mission.sh made a commit despite refusing -- expected ZERO new commits" >&2
      cat "$SANDBOX/wrap.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    if ! grep -q "\.claude/settings\.json" "$SANDBOX/wrap.out"; then
      echo "FAIL: wrap_mission.sh's refusal message did not name the specific out-of-scope file" >&2
      cat "$SANDBOX/wrap.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    echo "PASS: out_of_scope_blocks -- refused, zero new commits, offending file named in output"
    rm -rf "$SANDBOX"
    ;;

  worktree_noise_excluded)
    setup_sandbox
    echo "learned something" >> "$SANDBOX/.agent/memory/project/learned.md"
    mkdir -p "$SANDBOX/.claude/worktrees/agent-deadbeef00"
    echo "some other agent's in-progress file" > "$SANDBOX/.claude/worktrees/agent-deadbeef00/scratch.txt"
    BEFORE_COMMITS="$(commit_count)"

    ( cd "$SANDBOX" && WRAP_NO_PUSH=1 bash execution/skills/wrap_mission.sh "test" "test" ) \
      >"$SANDBOX/wrap.out" 2>&1
    RC=$?
    if [ "$RC" -ne 0 ]; then
      echo "FAIL: wrap_mission.sh should succeed with only worktrees noise + legitimate dirt present, exited $RC" >&2
      cat "$SANDBOX/wrap.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    AFTER_COMMITS="$(commit_count)"
    if [ "$AFTER_COMMITS" != "$((BEFORE_COMMITS + 1))" ]; then
      echo "FAIL: expected exactly 1 new commit, went from $BEFORE_COMMITS to $AFTER_COMMITS" >&2
      cat "$SANDBOX/wrap.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    LAST_FILES="$(cd "$SANDBOX" && git show --name-only --pretty=format: HEAD)"
    if echo "$LAST_FILES" | grep -q "worktrees"; then
      echo "FAIL: the committed file list includes a .claude/worktrees/ path -- must be silently excluded" >&2
      echo "$LAST_FILES" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi
    if ! echo "$LAST_FILES" | grep -q "learned.md"; then
      echo "FAIL: the legitimate mission file (learned.md) was not committed" >&2
      echo "$LAST_FILES" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    echo "PASS: worktree_noise_excluded -- committed successfully, worktrees path absent from commit, legitimate file present"
    rm -rf "$SANDBOX"
    ;;

  broad_sweep_unaffected)
    setup_sandbox
    echo "code change" >> "$SANDBOX/execution/mission.py"
    echo "test change" > "$SANDBOX/execution/tests/new_test.txt"
    echo "test change" > "$SANDBOX/tests/new_test.txt"
    echo "doc change" > "$SANDBOX/docs/new_doc.md"
    echo "memory change" >> "$SANDBOX/.agent/memory/project/learned.md"
    BEFORE_COMMITS="$(commit_count)"

    ( cd "$SANDBOX" && WRAP_NO_PUSH=1 bash execution/skills/wrap_mission.sh "test" "test" ) \
      >"$SANDBOX/wrap.out" 2>&1
    RC=$?
    if [ "$RC" -ne 0 ]; then
      echo "FAIL: wrap_mission.sh should succeed with only ordinary, non-denylisted dirt present, exited $RC" >&2
      cat "$SANDBOX/wrap.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    AFTER_COMMITS="$(commit_count)"
    if [ "$AFTER_COMMITS" != "$((BEFORE_COMMITS + 1))" ]; then
      echo "FAIL: expected exactly 1 new commit, went from $BEFORE_COMMITS to $AFTER_COMMITS" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    LAST_FILES="$(cd "$SANDBOX" && git show --name-only --pretty=format: HEAD)"
    for f in "execution/mission.py" "execution/tests/new_test.txt" "tests/new_test.txt" "docs/new_doc.md" ".agent/memory/project/learned.md"; do
      if ! echo "$LAST_FILES" | grep -qF "$f"; then
        echo "FAIL: expected $f in the single close-out commit -- fix must not narrow staging to a fixed subtree allowlist" >&2
        echo "$LAST_FILES" >&2
        rm -rf "$SANDBOX"
        exit 1
      fi
    done

    echo "PASS: broad_sweep_unaffected -- all 5 ordinary, cross-directory dirty files landed in the single commit"
    rm -rf "$SANDBOX"
    ;;

  allow_override_works)
    setup_sandbox
    echo "learned something" >> "$SANDBOX/.agent/memory/project/learned.md"
    echo '{"changed": true}' > "$SANDBOX/.claude/settings.json"
    BEFORE_COMMITS="$(commit_count)"

    ( cd "$SANDBOX" && WRAP_NO_PUSH=1 WRAP_ALLOW_OUT_OF_SCOPE=1 bash execution/skills/wrap_mission.sh "test" "test" ) \
      >"$SANDBOX/wrap.out" 2>&1
    RC=$?
    if [ "$RC" -ne 0 ]; then
      echo "FAIL: WRAP_ALLOW_OUT_OF_SCOPE=1 should let wrap_mission.sh proceed, exited $RC" >&2
      cat "$SANDBOX/wrap.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    AFTER_COMMITS="$(commit_count)"
    if [ "$AFTER_COMMITS" != "$((BEFORE_COMMITS + 1))" ]; then
      echo "FAIL: expected exactly 1 new commit with the override set" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    LAST_FILES="$(cd "$SANDBOX" && git show --name-only --pretty=format: HEAD)"
    if ! echo "$LAST_FILES" | grep -qF ".claude/settings.json"; then
      echo "FAIL: with WRAP_ALLOW_OUT_OF_SCOPE=1, the denylisted file should be included in the commit" >&2
      echo "$LAST_FILES" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    echo "PASS: allow_override_works -- WRAP_ALLOW_OUT_OF_SCOPE=1 lets the operator explicitly include out-of-scope dirt"
    rm -rf "$SANDBOX"
    ;;

  abort_before_brain_call)
    setup_sandbox
    echo "learned something" >> "$SANDBOX/.agent/memory/project/learned.md"
    echo '{"changed": true}' > "$SANDBOX/.claude/settings.json"

    ( cd "$SANDBOX" && bash execution/skills/wrap_mission.sh "test" "test" ) \
      >"$SANDBOX/wrap.out" 2>&1
    RC=$?
    if [ "$RC" -eq 0 ]; then
      echo "FAIL: wrap_mission.sh should have refused with .claude/settings.json dirty" >&2
      cat "$SANDBOX/wrap.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    N="$(count_brain_calls)"
    if [ "$N" != "0" ]; then
      echo "FAIL: expected ZERO brain.py invocations when the scope guard refuses, got $N -- the scope check must run BEFORE the unconditional brain wrap-up call" >&2
      cat "$SANDBOX/brain_calls.log" 2>/dev/null >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    echo "PASS: abort_before_brain_call -- scope guard refuses before any brain.py invocation"
    rm -rf "$SANDBOX"
    ;;

  close_out_rollback_on_scope_abort)
    setup_sandbox
    MISSION_FILE="$SANDBOX/.agent/memory/project/missions/f4-scope-fixture.md"
    echo '{"changed": true}' > "$SANDBOX/.claude/settings.json"

    ( cd "$SANDBOX" && WRAP_NO_PUSH=1 python3 execution/mission.py close-out "$MISSION_FILE" ) \
      >"$SANDBOX/close_out_fail.out" 2>&1
    FAIL_RC=$?
    if [ "$FAIL_RC" -eq 0 ]; then
      echo "FAIL: mission.py close-out should have exited nonzero when wrap_mission.sh's scope guard refuses" >&2
      cat "$SANDBOX/close_out_fail.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    N="$(count_brain_calls)"
    if [ "$N" != "0" ]; then
      echo "FAIL: expected ZERO brain calls from the failed close-out attempt, got $N" >&2
      cat "$SANDBOX/close_out_fail.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    if ! grep -q "^status: close_out$" "$MISSION_FILE"; then
      echo "FAIL: mission file status was not rolled back to close_out after the scope-guard refusal" >&2
      cat "$MISSION_FILE" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    if grep -q "^completed_at:" "$MISSION_FILE"; then
      echo "FAIL: completed_at was not removed on rollback after the scope-guard refusal" >&2
      cat "$MISSION_FILE" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    # Resolve the out-of-scope dirt and retry -- must now succeed cleanly.
    rm -f "$SANDBOX/.claude/settings.json"
    ( cd "$SANDBOX" && git checkout -- .claude/settings.json 2>/dev/null || true )

    ( cd "$SANDBOX" && WRAP_NO_PUSH=1 python3 execution/mission.py close-out "$MISSION_FILE" ) \
      >"$SANDBOX/close_out_retry.out" 2>&1
    RETRY_RC=$?
    if [ "$RETRY_RC" -ne 0 ]; then
      echo "FAIL: retry close-out (out-of-scope dirt resolved) should have succeeded, exited $RETRY_RC" >&2
      cat "$SANDBOX/close_out_retry.out" >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    if grep -q "expected 'close_out'" "$SANDBOX/close_out_retry.out"; then
      echo "FAIL: retry close-out hit the status==close_out guard -- rollback did not restore status correctly" >&2
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

    N2="$(count_brain_calls)"
    if [ "$N2" != "1" ]; then
      echo "FAIL: expected exactly 1 brain call total (0 from the failed attempt, 1 from the retry), got $N2" >&2
      cat "$SANDBOX/brain_calls.log" 2>/dev/null >&2
      rm -rf "$SANDBOX"
      exit 1
    fi

    echo "PASS: close_out_rollback_on_scope_abort -- rolled back on scope-guard refusal, retry after resolving the dirt succeeds cleanly with mission.py unmodified"
    rm -rf "$SANDBOX"
    ;;

  *)
    echo "FAIL: unknown case '$CASE' (expected out_of_scope_blocks|worktree_noise_excluded|broad_sweep_unaffected|allow_override_works|abort_before_brain_call|close_out_rollback_on_scope_abort)" >&2
    exit 1
    ;;
esac
