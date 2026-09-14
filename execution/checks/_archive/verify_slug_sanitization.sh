#!/usr/bin/env bash
# Live-exercises `mission.py new --slug` against a throwaway scratch CWD to
# verify the injection-shaped-slug rejection added for F2, without touching
# the real .agent/memory/project/missions/ tree.
#
# Usage:
#   verify_slug_sanitization.sh reject "<slug>" ["<goal>"]
#   verify_slug_sanitization.sh accept "<slug>" ["<goal>"]
#
# An empty "<slug>" ("") omits --slug entirely, exercising the
# auto-generated-from-goal path instead of the --slug flag.
#
# reject: exit 0 iff mission.py new exited non-zero, printed an ERROR line to
#         stderr, and created no mission file at all.
# accept: exit 0 iff mission.py new exited 0, printed "Created:", and wrote a
#         mission file under missions/ (whose frontmatter has `slug: <slug>`
#         when <slug> was given).
set -u

MODE="${1:?usage: verify_slug_sanitization.sh <reject|accept> <slug> [goal]}"
SLUG="${2?usage: verify_slug_sanitization.sh <reject|accept> <slug> [goal]}"
GOAL="${3:-Test goal for slug sanitization verification}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR" && git rev-parse --show-toplevel)"
MISSION_PY="$REPO_ROOT/execution/mission.py"

if [[ ! -f "$MISSION_PY" ]]; then
  echo "FAIL: mission.py not found at $MISSION_PY" >&2
  exit 1
fi

SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

pushd "$SCRATCH" >/dev/null

STDOUT_LOG="$SCRATCH/stdout.log"
STDERR_LOG="$SCRATCH/stderr.log"
if [[ -n "$SLUG" ]]; then
  python3 "$MISSION_PY" new "$GOAL" --slug "$SLUG" >"$STDOUT_LOG" 2>"$STDERR_LOG"
else
  python3 "$MISSION_PY" new "$GOAL" >"$STDOUT_LOG" 2>"$STDERR_LOG"
fi
RC=$?

popd >/dev/null

# Scratch CWD starts empty, so at most one mission file can exist after this run.
MISSION_FILE=$(find "$SCRATCH/.agent/memory/project/missions" -name "*.md" 2>/dev/null | head -n1)

case "$MODE" in
  reject)
    if [[ $RC -eq 0 ]]; then
      echo "FAIL: expected non-zero exit for rejected slug '$SLUG', got 0" >&2
      cat "$STDOUT_LOG" >&2
      exit 1
    fi
    if ! grep -qi "^ERROR:" "$STDERR_LOG"; then
      echo "FAIL: expected an ERROR: line on stderr for rejected slug '$SLUG'" >&2
      cat "$STDERR_LOG" >&2
      exit 1
    fi
    if [[ -n "$MISSION_FILE" ]]; then
      echo "FAIL: a mission file was created despite rejection: $MISSION_FILE" >&2
      exit 1
    fi
    echo "OK: slug '$SLUG' correctly rejected"
    exit 0
    ;;
  accept)
    if [[ $RC -ne 0 ]]; then
      echo "FAIL: expected exit 0 for accepted slug '$SLUG', got $RC" >&2
      cat "$STDERR_LOG" >&2
      exit 1
    fi
    if ! grep -q "^Created:" "$STDOUT_LOG"; then
      echo "FAIL: expected 'Created:' on stdout for accepted slug '$SLUG'" >&2
      cat "$STDOUT_LOG" >&2
      exit 1
    fi
    if [[ -z "$MISSION_FILE" ]]; then
      echo "FAIL: no mission file was created for accepted input" >&2
      exit 1
    fi
    if [[ -n "$SLUG" ]] && ! grep -q "^slug: ${SLUG}$" "$MISSION_FILE"; then
      echo "FAIL: mission file $MISSION_FILE does not declare slug: $SLUG" >&2
      cat "$MISSION_FILE" >&2
      exit 1
    fi
    echo "OK: input (slug='$SLUG') correctly accepted"
    exit 0
    ;;
  *)
    echo "FAIL: unknown mode '$MODE' (expected reject|accept)" >&2
    exit 1
    ;;
esac
