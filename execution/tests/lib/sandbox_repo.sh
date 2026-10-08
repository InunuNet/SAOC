#!/usr/bin/env bash
# sandbox_repo.sh — a fresh, one-commit git repository for a fixture test.
#
# Tests that run a tool against cwd-relative state (contract.py's deletion
# guard walks git history; handoffs.py appends to backlog.md) must not run in
# the host checkout. There, the outcome depends on whatever repository the
# suite happens to run in, and the run writes into that project's live memory
# (reported by Alembic 2026-09-29: 130 "deleted, ungraded" paths from the host's
# history failed the gate fixtures, and a handoff fixture appended a fake
# "Factory loop" item to every backlog it ran in).
#
#   source execution/tests/lib/sandbox_repo.sh
#   SB=$(make_sandbox_repo <name> [relative paths to copy in...])
#   (cd "$SB" && python3 "$HARNESS_ROOT/execution/tool.py" ...)
#
# The copied paths plus WORKSPACE and .agent/profile.json are committed as the
# single base commit, so the sandbox has no history beyond this test.

HARNESS_ROOT="$(git rev-parse --show-toplevel)"

make_sandbox_repo() {
    local name="$1"; shift
    local sb="$HARNESS_ROOT/.tmp/sandbox/tests/$name"
    python3 "$HARNESS_ROOT/execution/safe_delete.py" "$sb" >/dev/null
    mkdir -p "$sb/.agent/memory/project"
    cp "$HARNESS_ROOT/WORKSPACE" "$sb/WORKSPACE"
    cp "$HARNESS_ROOT/.agent/profile.json" "$sb/.agent/profile.json"
    printf '# Backlog\n' > "$sb/.agent/memory/project/backlog.md"
    local rel
    for rel in "$@"; do
        mkdir -p "$sb/$(dirname "$rel")"
        cp -R "$HARNESS_ROOT/$rel" "$sb/$rel"
    done
    GIT_CEILING_DIRECTORIES="$HARNESS_ROOT/.tmp/sandbox" git -C "$sb" init -q -b main
    git -C "$sb" add -A
    git -C "$sb" -c user.email=t@t -c user.name=t commit -qm base
    printf '%s\n' "$sb"
}
