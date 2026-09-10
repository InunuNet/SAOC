#!/usr/bin/env bash
# GH #1297 — arguments containing spaces, quotes, and shell-special
# characters must reach the wrapped command exactly as given. Catches a
# `"$*"` bug (word-splits/reflattens args) masquerading as correct `"$@"`
# passthrough.
#
# Uses FILE redirection (not `$(...)`) for the same reason as
# verify_hotfix1297_stdio_passthrough.sh — a pipe-based capture can hang
# indefinitely if the wrapper leaks an orphaned heartbeat process instead
# of failing fast (see verify_hotfix1297_clean_teardown.sh for that check).
set -uo pipefail
REPO_ROOT="${1:?usage: verify_hotfix1297_args_passthrough.sh <repo_root>}"
WRAPPER="$REPO_ROOT/execution/heartbeat_wrap.sh"

if [ ! -x "$WRAPPER" ]; then
  echo "FAIL: $WRAPPER missing or not executable"
  exit 1
fi

EXPECTED=$(mktemp)
ACTUAL=$(mktemp)
trap 'rm -f "$EXPECTED" "$ACTUAL"' EXIT

printf '%s\n' "hello world" "semi;colon" "quo'te" "dollar\$sign" "trail  space  " > "$EXPECTED"
HEARTBEAT_INTERVAL=1000 "$WRAPPER" printf '%s\n' "hello world" "semi;colon" "quo'te" "dollar\$sign" "trail  space  " > "$ACTUAL"

if ! diff -u "$EXPECTED" "$ACTUAL" >/tmp/hotfix1297_args_diff.$$ 2>&1; then
  echo "FAIL: argument passthrough mismatch — wrapper altered arg boundaries or content"
  cat /tmp/hotfix1297_args_diff.$$
  rm -f /tmp/hotfix1297_args_diff.$$
  exit 1
fi
rm -f /tmp/hotfix1297_args_diff.$$

echo "PASS: multi-word/quoted/special-char arguments passed through unmodified"
