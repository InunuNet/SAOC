#!/usr/bin/env bash
# check_wrap_mission_integration.sh — hermetic end-to-end test of wrap_mission.sh.
#
# Builds a fresh throwaway git repo (with a bare "origin" + bare "backup" remote)
# per scenario, copies the REAL wrap_mission.sh + lib/*.py into it, stubs
# execution/brain.py so no real brain writes happen, and drives each scenario
# against the actual script. No production repo state is touched.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

FAILURES=0
fail() {
    echo "FAIL: $1" >&2
    FAILURES=$((FAILURES + 1))
}

SANDBOX=""
ORIGIN_BARE=""
BACKUP_BARE=""

new_sandbox() {
    SANDBOX="$(mktemp -d)"
    ORIGIN_BARE="$(mktemp -d)"
    BACKUP_BARE="$(mktemp -d)"

    # Guard: never fall through to the real repo if mktemp fails. Without set -e
    # a failed `cd "$SANDBOX"` (empty var) would run git commit in REPO_ROOT.
    if [ -z "$SANDBOX" ] || [ ! -d "$SANDBOX" ] \
        || [ -z "$ORIGIN_BARE" ] || [ ! -d "$ORIGIN_BARE" ] \
        || [ -z "$BACKUP_BARE" ] || [ ! -d "$BACKUP_BARE" ]; then
        echo "FATAL: mktemp did not produce a sandbox — refusing to run in the real repo" >&2
        exit 1
    fi

    git init --quiet --bare "$ORIGIN_BARE"
    git init --quiet --bare "$BACKUP_BARE"

    git init --quiet "$SANDBOX"
    (
        cd "$SANDBOX"
        git config user.email "test@example.com"
        git config user.name "Test"
        git config commit.gpgsign false
        git symbolic-ref HEAD refs/heads/main
        git remote add origin "$ORIGIN_BARE"
        git remote add backup "$BACKUP_BARE"
    )

    mkdir -p "$SANDBOX/execution/skills/lib"
    mkdir -p "$SANDBOX/.agent/memory/project/missions"

    cp "$REPO_ROOT/execution/skills/wrap_mission.sh" "$SANDBOX/execution/skills/wrap_mission.sh"
    cp "$REPO_ROOT/execution/skills/lib/secret_guard.py" "$SANDBOX/execution/skills/lib/secret_guard.py"
    cp "$REPO_ROOT/execution/skills/lib/mission_complete.py" "$SANDBOX/execution/skills/lib/mission_complete.py"
    chmod +x "$SANDBOX/execution/skills/wrap_mission.sh"

    cat > "$SANDBOX/execution/brain.py" <<'PYEOF'
#!/usr/bin/env python3
"""Stub brain.py for hermetic wrap_mission.sh integration testing — no-op."""
import sys
sys.exit(0)
PYEOF
    chmod +x "$SANDBOX/execution/brain.py"

    (
        cd "$SANDBOX"
        echo "seed" > README.md
        git add README.md
        git commit --quiet -m "seed"
    )
}

cleanup_sandbox() {
    rm -rf "$SANDBOX" "$ORIGIN_BARE" "$BACKUP_BARE"
}

write_mission_file() {
    # $1 = path, $2 = status
    cat > "$1" <<EOF
---
schema: athanor.mission/v1
slug: fixture
status: $2
milestones: []
features: []
---
# fixture
EOF
}

write_active_json() {
    # $1 = path, $2 = mission pointer (relative path)
    printf '{"mission": "%s", "checkpoint": {"milestone": null, "feature": null}}' "$2" > "$1"
}

WRAP_OUT=""
WRAP_RC=0
run_wrap() {
    WRAP_OUT="$(cd "$SANDBOX" && bash execution/skills/wrap_mission.sh "test summary" "test,tags" 2>&1)"
    WRAP_RC=$?
}

commit_count() {
    git -C "$SANDBOX" rev-list --count HEAD
}

remote_ref_count() {
    # $1 = bare repo path
    git -C "$1" rev-list --all --count 2>/dev/null || echo 0
}

# --- S1: untracked .secrets/creds.env, incomplete mission, WRAP_NO_PUSH=1 ---
scenario_s1() {
    new_sandbox
    mkdir -p "$SANDBOX/.secrets"
    echo "SECRET=1" > "$SANDBOX/.secrets/creds.env"
    write_mission_file "$SANDBOX/.agent/memory/project/missions/mission.md" "pending"
    write_active_json "$SANDBOX/.agent/memory/project/missions/active.json" \
        ".agent/memory/project/missions/mission.md"

    local before after
    before=$(commit_count)
    export WRAP_NO_PUSH=1
    run_wrap
    unset WRAP_NO_PUSH
    after=$(commit_count)

    [ "$WRAP_RC" -eq 1 ] || fail "S1: expected exit 1, got $WRAP_RC"
    [ "$after" -eq "$before" ] || fail "S1: expected no new commit"
    git -C "$SANDBOX" ls-files | grep -q 'creds\.env' && fail "S1: secret file present in git ls-files"
    git -C "$SANDBOX" log --all --name-only 2>/dev/null | grep -q 'creds\.env' \
        && fail "S1: secret file present in git log"
    echo "$WRAP_OUT" | grep -q 'creds.env' || fail "S1: abort message does not name the file"

    cleanup_sandbox
}

# --- S2: nested .secrets/sub/key.json ---
scenario_s2() {
    new_sandbox
    mkdir -p "$SANDBOX/.secrets/sub"
    echo "{}" > "$SANDBOX/.secrets/sub/key.json"
    write_mission_file "$SANDBOX/.agent/memory/project/missions/mission.md" "pending"
    write_active_json "$SANDBOX/.agent/memory/project/missions/active.json" \
        ".agent/memory/project/missions/mission.md"

    local before after
    before=$(commit_count)
    export WRAP_NO_PUSH=1
    run_wrap
    unset WRAP_NO_PUSH
    after=$(commit_count)

    [ "$WRAP_RC" -eq 1 ] || fail "S2: expected exit 1, got $WRAP_RC"
    [ "$after" -eq "$before" ] || fail "S2: expected no new commit"

    cleanup_sandbox
}

# --- S3: service-firebase-adminsdk-x.json ---
scenario_s3() {
    new_sandbox
    echo "{}" > "$SANDBOX/service-firebase-adminsdk-x.json"
    write_mission_file "$SANDBOX/.agent/memory/project/missions/mission.md" "pending"
    write_active_json "$SANDBOX/.agent/memory/project/missions/active.json" \
        ".agent/memory/project/missions/mission.md"

    local before after
    before=$(commit_count)
    export WRAP_NO_PUSH=1
    run_wrap
    unset WRAP_NO_PUSH
    after=$(commit_count)

    [ "$WRAP_RC" -eq 1 ] || fail "S3: expected exit 1, got $WRAP_RC"
    [ "$after" -eq "$before" ] || fail "S3: expected no new commit"

    cleanup_sandbox
}

# --- S4a: .env.local present ---
scenario_s4a() {
    new_sandbox
    echo "SECRET=1" > "$SANDBOX/.env.local"
    write_mission_file "$SANDBOX/.agent/memory/project/missions/mission.md" "pending"
    write_active_json "$SANDBOX/.agent/memory/project/missions/active.json" \
        ".agent/memory/project/missions/mission.md"

    local before after
    before=$(commit_count)
    export WRAP_NO_PUSH=1
    run_wrap
    unset WRAP_NO_PUSH
    after=$(commit_count)

    [ "$WRAP_RC" -eq 1 ] || fail "S4a: expected exit 1, got $WRAP_RC"
    [ "$after" -eq "$before" ] || fail "S4a: expected no new commit"

    cleanup_sandbox
}

# --- S4b: only .env.enc changed -> commits ---
scenario_s4b() {
    new_sandbox
    echo "ENC_DATA" > "$SANDBOX/.env.enc"
    write_mission_file "$SANDBOX/.agent/memory/project/missions/mission.md" "pending"
    write_active_json "$SANDBOX/.agent/memory/project/missions/active.json" \
        ".agent/memory/project/missions/mission.md"

    local before after
    before=$(commit_count)
    export WRAP_NO_PUSH=1
    run_wrap
    unset WRAP_NO_PUSH
    after=$(commit_count)

    [ "$WRAP_RC" -eq 0 ] || fail "S4b: expected exit 0, got $WRAP_RC"
    [ "$after" -eq $((before + 1)) ] || fail "S4b: expected exactly one new commit"
    git -C "$SANDBOX" show --name-only HEAD | grep -q '\.env\.enc' \
        || fail "S4b: .env.enc not present in the new commit"

    cleanup_sandbox
}

# --- S5: already-tracked .env, committed then modified ---
scenario_s5() {
    new_sandbox
    echo "A=1" > "$SANDBOX/.env"
    (cd "$SANDBOX" && git add .env && git commit --quiet -m "pre-existing tracked env")
    echo "A=2" >> "$SANDBOX/.env"
    write_mission_file "$SANDBOX/.agent/memory/project/missions/mission.md" "pending"
    write_active_json "$SANDBOX/.agent/memory/project/missions/active.json" \
        ".agent/memory/project/missions/mission.md"

    local before after
    before=$(commit_count)
    export WRAP_NO_PUSH=1
    run_wrap
    unset WRAP_NO_PUSH
    after=$(commit_count)

    [ "$WRAP_RC" -eq 1 ] || fail "S5: expected exit 1, got $WRAP_RC"
    [ "$after" -eq "$before" ] || fail "S5: expected no NEW commit"

    cleanup_sandbox
}

# --- S6: only README.md changed, incomplete mission -> commit, active.json unchanged ---
scenario_s6() {
    new_sandbox
    echo "updated" >> "$SANDBOX/README.md"
    write_mission_file "$SANDBOX/.agent/memory/project/missions/mission.md" "pending"
    write_active_json "$SANDBOX/.agent/memory/project/missions/active.json" \
        ".agent/memory/project/missions/mission.md"
    local active_before
    active_before="$(cat "$SANDBOX/.agent/memory/project/missions/active.json")"

    local before after
    before=$(commit_count)
    export WRAP_NO_PUSH=1
    run_wrap
    unset WRAP_NO_PUSH
    after=$(commit_count)

    [ "$WRAP_RC" -eq 0 ] || fail "S6: expected exit 0, got $WRAP_RC"
    [ "$after" -eq $((before + 1)) ] || fail "S6: expected exactly one new commit"

    local active_after
    active_after="$(cat "$SANDBOX/.agent/memory/project/missions/active.json")"
    [ "$active_before" = "$active_after" ] || fail "S6: active.json changed unexpectedly"

    cleanup_sandbox
}

# --- S7: mission status pending -> active.json still points to mission ---
scenario_s7() {
    new_sandbox
    echo "updated" >> "$SANDBOX/README.md"
    write_mission_file "$SANDBOX/.agent/memory/project/missions/mission.md" "pending"
    write_active_json "$SANDBOX/.agent/memory/project/missions/active.json" \
        ".agent/memory/project/missions/mission.md"

    export WRAP_NO_PUSH=1
    run_wrap
    unset WRAP_NO_PUSH

    [ "$WRAP_RC" -eq 0 ] || fail "S7: expected exit 0, got $WRAP_RC"
    grep -q '"mission": ".agent/memory/project/missions/mission.md"' \
        "$SANDBOX/.agent/memory/project/missions/active.json" \
        || fail "S7: active.json mission pointer was cleared for a pending mission"

    cleanup_sandbox
}

# --- S8: mission status done -> active.json mission pointer null/cleared ---
scenario_s8() {
    new_sandbox
    echo "updated" >> "$SANDBOX/README.md"
    write_mission_file "$SANDBOX/.agent/memory/project/missions/mission.md" "done"
    write_active_json "$SANDBOX/.agent/memory/project/missions/active.json" \
        ".agent/memory/project/missions/mission.md"

    export WRAP_NO_PUSH=1
    run_wrap
    unset WRAP_NO_PUSH

    [ "$WRAP_RC" -eq 0 ] || fail "S8: expected exit 0, got $WRAP_RC"
    grep -q '"mission": null' "$SANDBOX/.agent/memory/project/missions/active.json" \
        || fail "S8: active.json mission pointer was not cleared for a done mission"

    cleanup_sandbox
}

# --- S9: no active.json -> no crash, commit proceeds, exit 0 ---
scenario_s9() {
    new_sandbox
    echo "updated" >> "$SANDBOX/README.md"
    # deliberately no active.json written

    local before after
    before=$(commit_count)
    export WRAP_NO_PUSH=1
    run_wrap
    unset WRAP_NO_PUSH
    after=$(commit_count)

    [ "$WRAP_RC" -eq 0 ] || fail "S9: expected exit 0, got $WRAP_RC"
    [ "$after" -eq $((before + 1)) ] || fail "S9: expected exactly one new commit"

    cleanup_sandbox
}

# --- S10: detached HEAD, push enabled -> push skipped + warning, no new origin ref ---
scenario_s10() {
    new_sandbox
    (cd "$SANDBOX" && git checkout --quiet --detach HEAD)
    echo "updated" >> "$SANDBOX/README.md"

    local origin_before origin_after
    origin_before=$(remote_ref_count "$ORIGIN_BARE")

    run_wrap

    origin_after=$(remote_ref_count "$ORIGIN_BARE")

    echo "$WRAP_OUT" | grep -qi 'detached' || fail "S10: expected a detached-HEAD push-skip warning"
    [ "$origin_before" -eq "$origin_after" ] || fail "S10: origin gained a ref despite detached HEAD"

    cleanup_sandbox
}

# --- S11: WRAP_EXPECTED_REMOTE mismatch -> push skipped + warning, exit 0 ---
scenario_s11() {
    new_sandbox
    echo "updated" >> "$SANDBOX/README.md"

    export WRAP_EXPECTED_REMOTE="github.com/Other/Repo"
    run_wrap
    unset WRAP_EXPECTED_REMOTE

    [ "$WRAP_RC" -eq 0 ] || fail "S11: expected exit 0, got $WRAP_RC"
    echo "$WRAP_OUT" | grep -qi 'WRAP_EXPECTED_REMOTE' || fail "S11: expected a remote-mismatch warning"

    local origin_refs
    origin_refs=$(remote_ref_count "$ORIGIN_BARE")
    [ "$origin_refs" -eq 0 ] || fail "S11: origin gained a ref despite remote mismatch"

    cleanup_sandbox
}

# --- S12: correct remote, on a branch -> push succeeds, origin ref advances ---
scenario_s12() {
    new_sandbox
    echo "updated" >> "$SANDBOX/README.md"

    local origin_before origin_after
    origin_before=$(remote_ref_count "$ORIGIN_BARE")

    run_wrap

    origin_after=$(remote_ref_count "$ORIGIN_BARE")

    [ "$WRAP_RC" -eq 0 ] || fail "S12: expected exit 0, got $WRAP_RC"
    [ "$origin_after" -gt "$origin_before" ] || fail "S12: origin ref did not advance after push"

    cleanup_sandbox
}

# --- S13: origin+backup, WRAP_REMOTE unset -> pushes only to origin ---
scenario_s13() {
    new_sandbox
    echo "updated" >> "$SANDBOX/README.md"

    run_wrap

    local origin_refs backup_refs
    origin_refs=$(remote_ref_count "$ORIGIN_BARE")
    backup_refs=$(remote_ref_count "$BACKUP_BARE")

    [ "$WRAP_RC" -eq 0 ] || fail "S13: expected exit 0, got $WRAP_RC"
    [ "$origin_refs" -gt 0 ] || fail "S13: expected origin to receive the push"
    [ "$backup_refs" -eq 0 ] || fail "S13: backup remote received an unexpected push"

    cleanup_sandbox
}

# --- S14: active.json points at a mission file that does not exist on disk
# (ghost mission file — GH #1290 qa repro). A normal non-secret change is
# staged. wrap_mission.sh must leave active.json's pointer intact (NOT null
# it out), still exit 0, and still create the commit. ---
scenario_s14() {
    new_sandbox
    echo "updated" >> "$SANDBOX/README.md"
    write_active_json "$SANDBOX/.agent/memory/project/missions/active.json" \
        ".agent/memory/project/missions/GHOST-DOES-NOT-EXIST.md"
    # deliberately never write the mission file itself — it's a ghost pointer
    local active_before
    active_before="$(cat "$SANDBOX/.agent/memory/project/missions/active.json")"

    local before after
    before=$(commit_count)
    export WRAP_NO_PUSH=1
    run_wrap
    unset WRAP_NO_PUSH
    after=$(commit_count)

    [ "$WRAP_RC" -eq 0 ] || fail "S14: expected exit 0, got $WRAP_RC"
    [ "$after" -eq $((before + 1)) ] || fail "S14: expected exactly one new commit"

    local active_after
    active_after="$(cat "$SANDBOX/.agent/memory/project/missions/active.json")"
    [ "$active_before" = "$active_after" ] \
        || fail "S14: active.json was mutated for a ghost mission file (pointer must stay intact)"
    echo "$WRAP_OUT" | grep -qi 'no active mission to clear' \
        || fail "S14: expected a 'no active mission to clear' message"

    cleanup_sandbox
}

# --- S15a: WRAP_EXPECTED_REMOTE="github.com/Foo/Bar" vs an actual remote
# ending in ".../github.com/Foo/BarBaz" — under the old unanchored substring
# match this would have wrongly matched ("Foo/Bar" is a substring of
# "Foo/BarBaz") and pushed to the wrong repo. Exact-slug comparison must
# reject it: push SKIPPED, bare remote ref does not advance. ---
scenario_s15a() {
    new_sandbox
    echo "updated" >> "$SANDBOX/README.md"

    local fake_parent fake_bare
    fake_parent="$(mktemp -d)"
    mkdir -p "$fake_parent/github.com/Foo"
    fake_bare="$fake_parent/github.com/Foo/BarBaz"
    git init --quiet --bare "$fake_bare"
    (cd "$SANDBOX" && git remote set-url origin "$fake_bare")

    export WRAP_EXPECTED_REMOTE="github.com/Foo/Bar"
    run_wrap
    unset WRAP_EXPECTED_REMOTE

    [ "$WRAP_RC" -eq 0 ] || fail "S15a: expected exit 0, got $WRAP_RC"
    echo "$WRAP_OUT" | grep -qi 'WRAP_EXPECTED_REMOTE' || fail "S15a: expected a remote-mismatch warning"

    local refs
    refs=$(remote_ref_count "$fake_bare")
    [ "$refs" -eq 0 ] \
        || fail "S15a: bare remote ref advanced despite Foo/Bar vs Foo/BarBaz mismatch (unanchored substring regression)"

    rm -rf "$fake_parent"
    cleanup_sandbox
}

# --- S15b: WRAP_EXPECTED_REMOTE normalizes to exactly the actual remote
# (".../github.com/Foo/Bar.git" vs expected ".../github.com/Foo/Bar" — the
# trailing ".git" is stripped by normalization) -> push succeeds, bare
# remote ref advances. ---
scenario_s15b() {
    new_sandbox
    echo "updated" >> "$SANDBOX/README.md"

    local fake_parent fake_bare
    fake_parent="$(mktemp -d)"
    mkdir -p "$fake_parent/github.com/Foo"
    fake_bare="$fake_parent/github.com/Foo/Bar.git"
    git init --quiet --bare "$fake_bare"
    (cd "$SANDBOX" && git remote set-url origin "$fake_bare")

    local before after
    before=$(remote_ref_count "$fake_bare")
    export WRAP_EXPECTED_REMOTE="$fake_parent/github.com/Foo/Bar"
    run_wrap
    unset WRAP_EXPECTED_REMOTE
    after=$(remote_ref_count "$fake_bare")

    [ "$WRAP_RC" -eq 0 ] || fail "S15b: expected exit 0, got $WRAP_RC"
    [ "$after" -gt "$before" ] || fail "S15b: expected push to a normalization-equal remote to succeed"

    rm -rf "$fake_parent"
    cleanup_sandbox
}

scenario_s1
scenario_s2
scenario_s3
scenario_s4a
scenario_s4b
scenario_s5
scenario_s6
scenario_s7
scenario_s8
scenario_s9
scenario_s10
scenario_s11
scenario_s12
scenario_s13
scenario_s14
scenario_s15a
scenario_s15b

if [ "$FAILURES" -eq 0 ]; then
    echo "OK: check_wrap_mission_integration.sh (all 17 scenarios passed)"
    exit 0
else
    echo "FAIL: $FAILURES scenario(s) failed" >&2
    exit 1
fi
