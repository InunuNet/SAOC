#!/usr/bin/env bash
# registration-forms: every path given must be identical to the merge-base with origin/main
# (uncommitted edits count). usage: check_untouched.sh <path> [<path> ...]. Exit 0 only when all match.
set -u
[ $# -ge 1 ] || { echo "usage: check_untouched.sh <path>..." >&2; exit 2; }
ROOT="${CHECK_ROOT:-.}"
BASE="$(git -C "$ROOT" merge-base origin/main HEAD 2>/dev/null)" || { echo "FAIL: no merge-base with origin/main"; exit 1; }
if git -C "$ROOT" diff --quiet "$BASE" -- "$@"; then
  echo "PASS: untouched: $*"
else
  echo "FAIL: differs from merge-base:"
  git -C "$ROOT" diff --stat "$BASE" -- "$@"
  exit 1
fi
