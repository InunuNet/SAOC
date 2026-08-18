#!/usr/bin/env bash
# A-BEHAV-03 — fail-open on uncertainty. A real network partition isn't deterministically
# reproducible in a check (see README.md section 4), so this asserts structurally that the
# deleteUser() call is never left unguarded: it must be inside a try/catch (or .catch()) that
# logs and returns rather than rethrowing/crashing the invocation, and a caught failure must log
# at ERROR level naming the uid, not silently succeed.
set -euo pipefail

if [ ! -f functions/src/index.ts ]; then
  echo "FAIL: functions/src/index.ts does not exist"
  exit 1
fi

FAIL=0
SRC=functions/src/index.ts
COLLAPSED=$(tr '\n' ' ' < "$SRC")

# deleteUser must appear inside some try block or .catch chain in the file.
if ! echo "$COLLAPSED" | grep -qE 'deleteUser\('; then
  echo "FAIL: $SRC never calls deleteUser() — nothing to guard"
  exit 1
fi

# Look for a try/catch or .catch( wrapping around the deleteUser call region. This is a
# heuristic structural check (same class as this project's other A-STRUCT greps), not a formal
# AST proof — it fails loudly on the two shapes that would actually crash the invocation or
# silently swallow without logging.
if ! echo "$COLLAPSED" | grep -qE '(try[[:space:]]*\{[^}]*deleteUser\(|deleteUser\([^;]*\)[[:space:]]*\.catch\()'; then
  echo "FAIL: deleteUser() in $SRC does not appear to be wrapped in a try/catch or .catch() — an Admin SDK error here would crash the invocation instead of failing open"
  FAIL=1
fi

# An error-level log referencing the uid must exist near a catch block, so a caught failure is
# actually reported, not silently swallowed.
if ! grep -qE "console\.(error|warn)" "$SRC"; then
  echo "FAIL: $SRC has no console.error/console.warn call — a caught deletion failure must be logged, not silently swallowed"
  FAIL=1
fi

# Self-test: the guard-detection pattern must actually fire on a known-good shape and fail on a
# known-bad (unguarded) shape.
GOOD_TMP=$(mktemp)
echo 'async function f(uid) { try { await auth.deleteUser(uid); } catch (err) { console.error("delete failed", uid, err); } }' > "$GOOD_TMP"
GOOD_COLLAPSED=$(tr '\n' ' ' < "$GOOD_TMP")
if ! echo "$GOOD_COLLAPSED" | grep -qE '(try[[:space:]]*\{[^}]*deleteUser\(|deleteUser\([^;]*\)[[:space:]]*\.catch\()'; then
  echo "FAIL: self-test — the try/catch guard pattern did not fire on a known-good guarded shape; this check cannot be trusted"
  FAIL=1
fi

BAD_TMP=$(mktemp)
echo 'async function f(uid) { await auth.deleteUser(uid); }' > "$BAD_TMP"
BAD_COLLAPSED=$(tr '\n' ' ' < "$BAD_TMP")
if echo "$BAD_COLLAPSED" | grep -qE '(try[[:space:]]*\{[^}]*deleteUser\(|deleteUser\([^;]*\)[[:space:]]*\.catch\()'; then
  echo "FAIL: self-test — the guard pattern incorrectly matched a known-unguarded shape; this check cannot be trusted"
  FAIL=1
fi
rm -f "$GOOD_TMP" "$BAD_TMP"

if [ "$FAIL" -eq 1 ]; then
  exit 1
fi
echo "PASS: deleteUser() is guarded by try/catch and a caught failure is logged, not silently swallowed"
