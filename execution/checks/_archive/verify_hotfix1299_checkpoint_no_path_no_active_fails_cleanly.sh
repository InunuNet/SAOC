#!/usr/bin/env bash
# GH #1299 — checkpoint with no positional path AND no active mission must
# fail loudly with a helpful, non-zero-exit error. It must never silently
# no-op (e.g. printing nothing, or exiting 0 without touching anything).
set -euo pipefail
REPO_ROOT="${1:?usage: verify_hotfix1299_checkpoint_no_path_no_active_fails_cleanly.sh <repo_root>}"

SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT

mkdir -p "$SANDBOX/.agent/memory/project/missions"
# Deliberately no active.json.

cd "$SANDBOX"
set +e
OUTPUT=$(python3 "$REPO_ROOT/execution/mission.py" checkpoint --feature F1 --status done 2>&1)
RC=$?
set -e

if [ "$RC" -eq 0 ]; then
  echo "FAIL: checkpoint with no path and no active mission exited 0 (silent no-op) instead of failing"
  echo "$OUTPUT"
  exit 1
fi

if [ -z "$OUTPUT" ]; then
  echo "FAIL: checkpoint with no path and no active mission produced no error message at all"
  exit 1
fi

if ! echo "$OUTPUT" | grep -qi "no active mission"; then
  echo "FAIL: error message is not helpful — expected it to mention 'no active mission'"
  echo "$OUTPUT"
  exit 1
fi

echo "PASS: checkpoint with no path and no active mission fails cleanly with a helpful error"
